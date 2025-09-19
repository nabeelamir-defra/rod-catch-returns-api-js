import {
  deleteGrilseProbabilitiesForSeasonAndGate,
  generateCsvFromGrilseProbabilities,
  getGrilseProbabilitiesBySeasonRange,
  isGrilseProbabilityExistsForSeasonAndGate,
  processGrilseProbabilities,
  validateAndParseCsvFile
} from '../../services/grilse-probabilities.service.js'
import {
  getGrilseProbabilityRequestParamSchema,
  grilseProbabilityIdSchema,
  postGrilseProbabilityRequestParamSchema,
  postGrilseProbabilityRequestQuerySchema
} from '../../schemas/grilse-probabilities.schema.js'
import { handleNotFound, handleServerError } from '../../utils/server-utils.js'
import { GrilseProbability } from '../../entities/index.js'
import { GrilseValidationError } from '../../models/grilse-validation-error.model.js'
import { StatusCodes } from 'http-status-codes'
import logger from '../../utils/logger-utils.js'
import { mapGrilseProbabilityToResponse } from '../../mappers/grilse-probabilities.mapper.js'

export default [
  {
    method: 'GET',
    path: '/grilseProbabilities',
    options: {
      /**
       * Retrieve all the grilse probabilities in the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link GrilseProbability}
       */
      handler: async (_request, h) => {
        try {
          const foundGrilseProbabilities = await GrilseProbability.findAll()

          const mappedGrilseProbabilities = foundGrilseProbabilities.map(
            (grilseProbability) =>
              mapGrilseProbabilityToResponse(grilseProbability)
          )

          return h
            .response({
              _embedded: {
                grilseProbabilities: mappedGrilseProbabilities
              }
            })
            .code(StatusCodes.OK)
        } catch (error) {
          return handleServerError(
            'Error fetching grilse probabilities',
            error,
            h
          )
        }
      },
      description: 'Retrieve all the grilse probabilities in the database',
      notes: 'Retrieve all the grilse probabilities in the database',
      tags: ['api', 'grilseProbabilities']
    }
  },
  {
    method: 'DELETE',
    path: '/grilseProbabilities/{grilseProbabilityId}',
    options: {
      /**
       * Delete a grilse probability by its id in the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.params.grilseProbabilityId - The ID of the Grilse Probability to be deleted
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link GrilseProbability}
       */
      handler: async (request, h) => {
        try {
          const grilseProbabilityId = request.params.grilseProbabilityId

          logger.info(
            'Deleting grilse probability with id:%s',
            grilseProbabilityId
          )
          const deletedCount = await GrilseProbability.destroy({
            where: { id: grilseProbabilityId }
          })

          logger.info(
            'Deleted %s records for grilse probability with id:%s',
            deletedCount,
            grilseProbabilityId
          )

          if (deletedCount === 0) {
            return h.response().code(StatusCodes.NOT_FOUND)
          }

          return h.response().code(StatusCodes.NO_CONTENT)
        } catch (error) {
          return handleServerError(
            'Error deleting grilse probability',
            error,
            h
          )
        }
      },
      validate: {
        params: grilseProbabilityIdSchema
      },
      description: 'Delete grilse probabilities by id in the database',
      notes: 'Delete grilse probabilities by id in the database',
      tags: ['api', 'grilseProbabilities']
    }
  },
  {
    method: 'POST',
    path: '/reporting/reference/grilse-probabilities/{season}/{gate}',
    options: {
      /**
       * Upload a grilse probabilities csv file to the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.params.season - The year which the grilse probabilities file relates to
       *     @param {string} request.params.gate - The gate which the grilse probabilities file relates to
       *     @param {boolean} request.query.overwrite - A boolean to say whether the grilse probabilities for the specified season and gate should be overridden
       *     @param {string} request.payload - The csv file
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing an empty body
       */
      handler: async (request, h) => {
        try {
          const { season, gate } = request.params
          const { overwrite } = request.query

          logger.info(
            'Validating csv file with season:%s and gate:%s',
            season,
            gate
          )
          const records = await validateAndParseCsvFile(request.payload)

          const exists = await isGrilseProbabilityExistsForSeasonAndGate(
            season,
            gate
          )

          if (exists) {
            if (!overwrite) {
              logger.info(
                'Existing data found for season:%s and gate:%s',
                season,
                gate
              )
              return h
                .response({
                  message:
                    'Existing data found for the given season and gate but overwrite parameter not set'
                })
                .code(StatusCodes.CONFLICT)
            }
            logger.info(
              'Deleting existing data for season:%s and gate:%s',
              season,
              gate
            )
            await deleteGrilseProbabilitiesForSeasonAndGate(season, gate)
          }

          const grilseProbabilities = processGrilseProbabilities(
            records,
            season,
            gate
          )

          // Bulk insert records if there are valid probabilities
          if (grilseProbabilities.length > 0) {
            await GrilseProbability.bulkCreate(grilseProbabilities)
          }

          logger.info('Created data for season:%s and gate:%s', season, gate)

          return h.response().code(StatusCodes.CREATED)
        } catch (error) {
          if (error instanceof GrilseValidationError) {
            return h
              .response({
                timestamp: new Date().toISOString(),
                status: error.status,
                message: error.message,
                path: request.path,
                ...(error.error && { error: error.error }),
                ...(error.errors && { errors: error.errors })
              })
              .code(error.status)
          }
          return handleServerError(
            'Error uploading grilse probabilities file',
            error,
            h
          )
        }
      },
      validate: {
        params: postGrilseProbabilityRequestParamSchema,
        query: postGrilseProbabilityRequestQuerySchema
      },
      description: 'Upload a grilse probabilities csv file to the database',
      notes: 'Upload a grilse probabilities csv file to the database',
      tags: ['api', 'reporting']
    }
  },
  {
    method: 'GET',
    path: '/reporting/reference/grilse-probabilities/{season}',
    options: {
      /**
       * Retrieve the grilse probabilities as a csv file from the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.params.season - The year which the grilse probabilities relates to, either as a single year or range
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing an empty body
       */
      handler: async (request, h) => {
        try {
          const { season } = request.params

          // Split the season if it's a range, otherwise set endSeason to startSeason
          const [startSeason, endSeason] = season.includes('-')
            ? season.split('-').map(Number)
            : [Number(season), Number(season)]

          const grilseProbabilities = await getGrilseProbabilitiesBySeasonRange(
            startSeason,
            endSeason
          )

          if (grilseProbabilities.length === 0) {
            return handleNotFound(
              `Grilse probabilities not found for ${season}`,
              h
            )
          }

          const csv = generateCsvFromGrilseProbabilities(grilseProbabilities)

          return h
            .response(csv)
            .type('text/csv')
            .header(
              'Content-Disposition',
              `attachment; filename="grilse-probabilities-${season}.csv"`
            )
            .code(StatusCodes.OK)
        } catch (error) {
          return handleServerError(
            'Error retrieving grilse probabilities file',
            error,
            h
          )
        }
      },
      validate: {
        params: getGrilseProbabilityRequestParamSchema
      },
      description:
        'Retrieve the grilse probabilities as a csv file from the database',
      notes:
        'Retrieve the grilse probabilities as a csv file from the database',
      tags: ['api', 'reporting']
    }
  }
]
