import {
  handleNotFound,
  handleServerError,
  logRequest,
  logResponse
} from '../server-utils.js'
import { getMockResponseToolkit } from '../../test-utils/server-test-utils.js'
import logger from '../logger-utils.js'

jest.mock('../logger-utils.js')

describe('logger-utils.unit', () => {
  describe('handleNotFound', () => {
    it('should log the message', () => {
      const loggerMessage = 'Resource not found'
      const h = getMockResponseToolkit()

      handleNotFound(loggerMessage, h)

      expect(logger.error).toHaveBeenCalledWith(loggerMessage)
    })

    it('should return a 404 response and empty body', () => {
      const loggerMessage = 'Resource not found'
      const h = getMockResponseToolkit()

      const result = handleNotFound(loggerMessage, h)

      expect(result.payload).toBeUndefined()
      expect(result.statusCode).toBe(404)
    })
  })

  describe('handleServerError', () => {
    it('should log the message', () => {
      const loggerMessage = 'Server error'
      const error = new Error('Database error')
      const h = getMockResponseToolkit()

      handleServerError(loggerMessage, error, h)

      expect(logger.error).toHaveBeenCalledWith(loggerMessage, error)
    })

    it('should return a 500 response and the error', () => {
      const loggerMessage = 'Server error'
      const error = new Error('Database error')
      const h = getMockResponseToolkit()

      const result = handleServerError(loggerMessage, error, h)

      expect(result.payload).toStrictEqual({
        error: 'Server error'
      })
      expect(result.statusCode).toBe(500)
    })
  })

  describe('logRequest', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const getMockRequest = (overrides = {}) => ({
      method: 'get',
      path: '/test',
      ...overrides
    })

    it('should log the request', () => {
      logRequest(getMockRequest(), getMockResponseToolkit())

      expect(logger.info).toHaveBeenCalledWith('GET /test')
    })

    it('should return h.continue', () => {
      const h = getMockResponseToolkit()
      const result = logRequest(getMockRequest(), h)

      expect(result).toBe(h.continue)
    })

    it('should not log if path includes /service-status', () => {
      const request = getMockRequest({
        path: '/service-status'
      })

      logRequest(request, getMockResponseToolkit())

      expect(logger.info).not.toHaveBeenCalled()
    })
  })

  describe('logResponse', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    const getMockRequest = (overrides = {}) => ({
      method: 'get',
      path: '/test',
      response: {
        statusCode: 200
      },
      ...overrides
    })

    it('should log the response', () => {
      logResponse(getMockRequest(), getMockResponseToolkit())

      expect(logger.info).toHaveBeenCalledWith('GET /test -> 200')
    })

    it('should return h.continue', () => {
      const h = getMockResponseToolkit()
      const result = logResponse(getMockRequest(), h)

      expect(result).toBe(h.continue)
    })

    it('should not log if path includes /service-status', () => {
      const request = getMockRequest({
        path: '/service-status'
      })

      logResponse(request, getMockResponseToolkit())

      expect(logger.info).not.toHaveBeenCalled()
    })
  })
})
