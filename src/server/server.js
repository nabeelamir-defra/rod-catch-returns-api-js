import 'dotenv/config'
import { apiPrefixRoutes, rootRoutes } from './routes/index.js'
import { logRequest, logResponse } from '../utils/server-utils.js'
import { Engine as CatboxRedis } from '@hapi/catbox-redis'
import Hapi from '@hapi/hapi'
import HealthCheck from './plugins/health.js'
import Inert from '@hapi/inert'
import Swagger from './plugins/swagger.js'
import Vision from '@hapi/vision'
import airbrake from '../utils/airbrake.js'
import { envSchema } from '../config.js'
import { failAction } from '../utils/error-utils.js'
import logger from '../utils/logger-utils.js'
import { sequelize } from '../services/database.service.js'
import { tokenService } from '../services/token.service.js'

const CACHE_TTL_MS_DEFAULT = 3600000 // default cache is 1 hour

export default async () => {
  const envValidationResult = envSchema.validate(process.env, {
    abortEarly: false
  })

  if (envValidationResult.error) {
    logger.error('Config validation error(s):')
    envValidationResult.error.details.forEach((detail) => {
      logger.error(`- ${detail.message}`)
    })
    throw new Error('Environment variables validation failed.')
  }

  airbrake.initialise()
  logger.error = airbrake.attachAirbrakeToDebugLogger(logger.error)

  const server = Hapi.server({
    port: process.env.PORT || 5000,
    host: '0.0.0.0',
    cache: [
      {
        provider: {
          constructor: CatboxRedis,
          options: {
            partition: 'rcr-js-api',
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
            db: 0,
            ...(process.env.REDIS_PASSWORD && {
              password: process.env.REDIS_PASSWORD,
              tls: {}
            })
          }
        }
      }
    ],
    routes: {
      validate: {
        failAction,
        options: {
          abortEarly: true // Return on first validation error
        }
      }
    }
  })

  server.ext('onPreAuth', tokenService)

  try {
    await sequelize.authenticate()
    logger.info('Connection has been established successfully.')
  } catch (error) {
    logger.error('Unable to connect to the database:', error)
  }

  server.app.cache = server.cache({
    segment: 'default-cache',
    expiresIn: CACHE_TTL_MS_DEFAULT
  })

  await server.register([Inert, Vision, Swagger])

  await server.register(HealthCheck(server))

  server.route(rootRoutes)

  server.ext('onRequest', logRequest)

  server.ext('onPreResponse', logResponse)

  // prefix the routes below with /api
  server.realm.modifiers.route.prefix = '/api'

  server.route(apiPrefixRoutes)

  await server.start()
  logger.info(
    'Server started at %s. Listening on %s',
    new Date(),
    server.info.uri
  )

  const shutdown = async (code) => {
    await server.stop()
    await airbrake.flush()
    process.exit(code)
  }

  process.on('SIGINT', () => shutdown(130))
  process.on('SIGTERM', () => shutdown(137))

  return server
}
