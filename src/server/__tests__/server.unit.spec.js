import { logRequest, logResponse } from '../../utils/server-utils.js'
import { Engine as CatboxRedis } from '@hapi/catbox-redis'
import Hapi from '@hapi/hapi'
import HealthCheck from '../plugins/health.js'
import Inert from '@hapi/inert'
import Swagger from '../plugins/swagger.js'
import Vision from '@hapi/vision'
import airbrake from '../../utils/airbrake.js'
import initialiseServer from '../server.js'
import logger from '../../utils/logger-utils.js'
import { sequelize } from '../../services/database.service.js'
import { tokenService } from '../../services/token.service.js'

jest.mock('../../services/database.service.js', () => ({
  sequelize: {
    authenticate: jest.fn(),
    define: jest.fn(() => ({
      associate: jest.fn(),
      hasMany: jest.fn(),
      belongsTo: jest.fn()
    })),
    init: jest.fn(),
    sync: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn(),
    query: jest.fn(),
    literal: jest.fn()
  }
}))
jest.mock('../../utils/logger-utils.js')
jest.mock('../../utils/airbrake.js', () => ({
  initialise: jest.fn(),
  attachAirbrakeToDebugLogger: jest.fn(() => jest.fn()),
  flush: jest.fn()
}))
jest.mock('../plugins/swagger.js')
jest.mock('../plugins/health.js')
jest.mock('@hapi/inert')
jest.mock('@hapi/vision')
jest.mock('@hapi/hapi', () => {
  const Hapi = {
    server: jest.fn(() => ({
      route: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      info: {
        uri: 'http://localhost:5000'
      },
      register: jest.fn(),
      app: {},
      realm: { modifiers: { route: {} } },
      cache: jest.fn(),
      ext: jest.fn()
    }))
  }
  return Hapi
})

describe('server.unit', () => {
  const originalEnv = process.env
  let originalErrorMethod

  beforeEach(() => {
    jest.resetModules()
    originalErrorMethod = logger.error
    process.env = {
      ...originalEnv
    }
  })

  afterEach(() => {
    // logger.error doesn't reset properly, so have to do it manually
    logger.error = originalErrorMethod

    // Remove all listeners to prevent memory leaks in subsequent tests
    process.removeAllListeners('SIGINT')
    process.removeAllListeners('SIGTERM')
    jest.restoreAllMocks()
  })

  it('should log a message saying the server has started successfully', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    await initialiseServer()

    expect(logger.info).toHaveBeenCalledWith(
      'Server started at %s. Listening on %s',
      expect.any(Date),
      expect.any(String)
    )
  })

  it('should configure root routes correctly', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.route).toHaveBeenCalledWith([
      expect.objectContaining({ method: 'GET', path: '/{param*}' })
    ])
  })

  it('should configure the cache correctly with a default expiry of 1 hour', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.cache).toHaveBeenCalledWith({
      segment: 'default-cache',
      expiresIn: 3600000
    })
  })

  it('should configure CatboxRedis as the cache provider', async () => {
    process.env.REDIS_HOST = 'redis-host'
    process.env.REDIS_PORT = '6379'
    sequelize.authenticate.mockResolvedValueOnce()

    await initialiseServer()

    expect(Hapi.server).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: [
          {
            provider: {
              constructor: CatboxRedis,
              options: {
                partition: 'rcr-js-api',
                host: expect.any(String),
                port: expect.any(String),
                db: 0
              }
            }
          }
        ]
      })
    )
  })

  it('should add the redis password if it is present to the cache provider', async () => {
    process.env.REDIS_HOST = 'redis-host'
    process.env.REDIS_PORT = '6379'
    process.env.REDIS_PASSWORD = 'abc123'
    sequelize.authenticate.mockResolvedValueOnce()

    await initialiseServer()

    expect(Hapi.server).toHaveBeenCalledWith(
      expect.objectContaining({
        cache: [
          {
            provider: {
              constructor: CatboxRedis,
              options: {
                partition: 'rcr-js-api',
                host: expect.any(String),
                port: expect.any(String),
                db: 0,
                password: expect.any(String),
                tls: {}
              }
            }
          }
        ]
      })
    )
  })

  it('should configure server with Inert, Vision and Swagger plugins', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.register).toHaveBeenNthCalledWith(1, [Inert, Vision, Swagger])
  })

  it('should configure server with HealthCheck plugin', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.register).toHaveBeenNthCalledWith(2, HealthCheck(server))
  })

  it('should add the token service as an interceptor', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.ext).toHaveBeenCalledWith('onPreAuth', tokenService)
  })

  it('should add an interceptor to log all incoming requests', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.ext).toHaveBeenCalledWith('onRequest', logRequest)
  })

  it('should add an interceptor to log all outgoing responses', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    const server = await initialiseServer()

    expect(server.ext).toHaveBeenCalledWith('onPreResponse', logResponse)
  })

  it('should log successful connection message when database connection is successful', async () => {
    sequelize.authenticate.mockResolvedValueOnce()

    await initialiseServer()

    expect(logger.info).toHaveBeenCalledWith(
      'Connection has been established successfully.'
    )
  })

  it('should log an error message when database connection fails', async () => {
    const errorMessage = 'Unable to connect to the database'

    sequelize.authenticate.mockRejectedValueOnce(new Error(errorMessage))

    await initialiseServer()

    expect(logger.error).toHaveBeenCalledWith(
      'Unable to connect to the database:',
      expect.any(Error)
    )
  })

  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 137]
  ])(
    'should stop the server and exit with code %s when receiving %d signal',
    async (signal, code) => {
      const server = await initialiseServer()
      const serverStopSpy = jest.spyOn(server, 'stop').mockResolvedValueOnce()
      const processStopSpy = jest
        .spyOn(process, 'exit')
        .mockImplementation(jest.fn())

      process.emit(signal)

      // Wait for the next event loop cycle
      await new Promise((resolve) => setImmediate(resolve))

      expect(serverStopSpy).toHaveBeenCalled()
      expect(airbrake.flush).toHaveBeenCalled()
      expect(processStopSpy).toHaveBeenCalledWith(code)
    }
  )

  it('should initialise airbrake', async () => {
    await initialiseServer()

    expect(airbrake.initialise).toHaveBeenCalled()
  })

  it('should attach airbrake to the logger', async () => {
    const ATTACH_SYMBOL = Symbol('ATTACHED')
    airbrake.attachAirbrakeToDebugLogger.mockReturnValueOnce(ATTACH_SYMBOL)

    await initialiseServer()

    expect(logger.error).toBe(ATTACH_SYMBOL)
  })

  it('should log and throw an error if a required environment variable is missing', async () => {
    delete process.env.DATABASE_HOST
    sequelize.authenticate.mockResolvedValueOnce()

    expect(initialiseServer()).rejects.toThrow(
      'Environment variables validation failed.'
    )

    expect(logger.error).toHaveBeenCalledWith('Config validation error(s):')
    expect(logger.error).toHaveBeenCalledWith('- "DATABASE_HOST" is required')
  })

  it('should use the default port if it is not set', async () => {
    delete process.env.PORT
    sequelize.authenticate.mockResolvedValueOnce()

    await initialiseServer()

    expect(Hapi.server).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 5000,
        host: '0.0.0.0'
      })
    )
  })
})
