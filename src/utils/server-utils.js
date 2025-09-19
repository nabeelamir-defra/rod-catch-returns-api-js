import { StatusCodes } from 'http-status-codes'
import logger from './logger-utils.js'

export const handleNotFound = (loggerMessage, h) => {
  logger.error(loggerMessage)
  return h.response().code(StatusCodes.NOT_FOUND)
}

export const handleServerError = (loggerMessage, error, h) => {
  logger.error(loggerMessage, error)
  return h
    .response({ error: loggerMessage })
    .code(StatusCodes.INTERNAL_SERVER_ERROR)
}

export const logRequest = (request, h) => {
  if (request.path.includes('/service-status')) {
    return h.continue
  }

  logger.info(`${request.method.toUpperCase()} ${request.path}`)
  return h.continue
}

export const logResponse = (request, h) => {
  if (request.path.includes('/service-status')) {
    return h.continue
  }

  logger.info(
    `${request.method.toUpperCase()} ${request.path} -> ${request.response?.statusCode}`
  )
  return h.continue
}
