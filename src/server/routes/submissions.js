import {
  Activity,
  Catch,
  SmallCatch,
  SmallCatchCount,
  Submission
} from '../../entities/index.js'
import {
  createSubmissionSchema,
  getBySubmissionIdSchema,
  getSubmissionByContactAndSeasonSchema,
  getSubmissionsByContactSchema,
  updateSubmissionSchema
} from '../../schemas/submission.schema.js'
import {
  handleCrmActivity,
  isSubmissionExistsByUserAndSeason
} from '../../services/submissions.service.js'
import { handleNotFound, handleServerError } from '../../utils/server-utils.js'
import { STATUSES } from '../../utils/constants.js'
import { StatusCodes } from 'http-status-codes'
import logger from '../../utils/logger-utils.js'
import { mapActivityToResponse } from '../../mappers/activities.mapper.js'
import { mapSubmissionToResponse } from '../../mappers/submission.mapper.js'
import { sequelize } from '../../services/database.service.js'
import { updateActivity } from '@defra-fish/dynamics-lib'

const BASE_SUBMISSIONS_URL = '/submissions/{submissionId}'

export default [
  {
    method: 'POST',
    path: '/submissions',
    options: {
      /**
       * Create a new submission in the database
       *
       * @param {import('@hapi/hapi').Request} request - The Hapi request object
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const { contactId, season, status, source, reportingExclude } =
          request.payload
        try {
          const submissionData = {
            contactId,
            season,
            status,
            source,
            reportingExclude,
            version: new Date()
          }

          logger.info('Checking if submission exists', submissionData)

          const foundSubmission = await isSubmissionExistsByUserAndSeason(
            contactId,
            season
          )

          if (foundSubmission) {
            const errorMessage = `Submission already exists for contact=${contactId} and season=${season}`
            logger.error(errorMessage)
            return h
              .response({ error: errorMessage })
              .code(StatusCodes.CONFLICT)
          }

          logger.info('Creating submission with details', submissionData)

          const createdSubmission = await Submission.create(submissionData)

          await handleCrmActivity(contactId, season)

          const response = mapSubmissionToResponse(createdSubmission.toJSON())

          return h.response(response).code(StatusCodes.CREATED)
        } catch (error) {
          return handleServerError('Error creating submission', error, h)
        }
      },
      validate: {
        payload: createSubmissionSchema,
        options: { entity: 'Submission' }
      },
      description: 'Create a submission',
      notes: 'Create a submission',
      tags: ['api', 'submissions']
    }
  },
  {
    method: 'GET',
    path: '/submissions/search/findByContactId',
    options: {
      /**
       * Get all submissions by contactId from the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.query.contact_id - The ID of the contact for which the submission is being retrieved.
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const contactId = request.query.contact_id

        try {
          const foundSubmissions = await Submission.findAll({
            where: {
              contactId
            }
          })

          let response = []
          if (foundSubmissions.length > 0) {
            response = foundSubmissions.map((foundSubmission) =>
              mapSubmissionToResponse(foundSubmission.toJSON())
            )
          }

          return h
            .response({ _embedded: { submissions: response } })
            .code(StatusCodes.OK)
        } catch (error) {
          return handleServerError('Error finding submissions', error, h)
        }
      },
      validate: {
        query: getSubmissionsByContactSchema
      },
      description: 'Get all submissions by contactId',
      notes: 'Get all submissions by contactId',
      tags: ['api', 'submissions']
    }
  },
  {
    method: 'GET',
    path: '/submissions/search/getByContactIdAndSeason',
    options: {
      /**
       * Get a submission by contactId and season from the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.query.contact_id - The ID of the contact for which the submission is being retrieved.
       *     @param {string} request.query.season - The season year for which the submission is being retrieved.
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const contactId = request.query.contact_id
        const season = request.query.season

        try {
          const foundSubmission = await Submission.findOne({
            where: {
              contactId,
              season
            }
          })

          if (foundSubmission) {
            const response = mapSubmissionToResponse(foundSubmission.toJSON())
            return h.response(response).code(StatusCodes.OK)
          }

          logger.info(`Submission not found for ${contactId} and ${season}`)
          return h.response().code(StatusCodes.NOT_FOUND)
        } catch (error) {
          return handleServerError('Error finding submission', error, h)
        }
      },
      validate: {
        query: getSubmissionByContactAndSeasonSchema
      },
      description: 'Get a submission by contactId and season',
      notes: 'Get a submission by contactId and season',
      tags: ['api', 'submissions']
    }
  },
  {
    method: 'GET',
    path: `${BASE_SUBMISSIONS_URL}/activities`,
    options: {
      /**
       * Get all activities associated with a submission by its submission id from the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.param.submissionId - The submission id of the associated activities
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const submissionId = request.params.submissionId

        try {
          // Fetch the submission and associated activities in one call
          const submissionWithActivities = await Submission.findOne({
            where: {
              id: submissionId
            },
            include: [
              {
                model: Activity,
                required: false // Allows for submissions with no activities
              }
            ]
          })

          // If the submission does not exist, return 404
          if (!submissionWithActivities) {
            return handleNotFound(
              `Activities not found for submission with id ${submissionId}`,
              h
            )
          }

          // If no activities, return 200 with an empty array
          const foundActivities = submissionWithActivities.Activities
          if (!foundActivities || foundActivities.length === 0) {
            return h
              .response({ _embedded: { activities: [] } })
              .code(StatusCodes.OK)
          }

          const response = foundActivities.map((activity) =>
            mapActivityToResponse(activity.toJSON())
          )

          return h
            .response({ _embedded: { activities: response } })
            .code(StatusCodes.OK)
        } catch (error) {
          return handleServerError(
            'Error finding activities for submission',
            error,
            h
          )
        }
      },
      validate: {
        params: getBySubmissionIdSchema
      },
      description: 'Get all activities associated with a submission',
      notes: 'Get all activities associated with a submission',
      tags: ['api', 'submissions']
    }
  },
  {
    method: 'GET',
    path: BASE_SUBMISSIONS_URL,
    options: {
      /**
       * Get a submission by its submissionId from the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.params.submissionId - The ID of the submission to be retrieved
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const submissionId = request.params.submissionId

        try {
          const foundSubmission = await Submission.findOne({
            where: {
              id: submissionId
            }
          })

          if (foundSubmission) {
            const response = mapSubmissionToResponse(foundSubmission.toJSON())
            return h.response(response).code(StatusCodes.OK)
          }
          return handleNotFound(`Submission not found ${submissionId}`, h)
        } catch (error) {
          return handleServerError('Error finding submission', error, h)
        }
      },
      validate: {
        params: getBySubmissionIdSchema
      },
      description: 'Get a submission by submissionId',
      notes: 'Get a submission by submissionId',
      tags: ['api', 'submissions']
    }
  },
  {
    method: 'PATCH',
    path: BASE_SUBMISSIONS_URL,
    options: {
      /**
       * Update a submission in the database using the submission ID
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.params.submissionId - The ID of the submission to update
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const { submissionId } = request.params
        const { status, reportingExclude } = request.payload

        try {
          const submission = await Submission.findByPk(submissionId)

          if (!submission) {
            return handleNotFound(`Submission not found for ${submissionId}`, h)
          }

          const submissionData = {
            status,
            reportingExclude,
            version: new Date()
          }

          logger.info(
            `Updating submission ${submissionId} with details`,
            submissionData
          )

          // if a value is undefined, it is not updated by Sequelize
          const updatedSubmission = await submission.update(submissionData)

          // Update CRM Activity if status is SUBMITTED
          if (status === STATUSES.SUBMITTED) {
            logger.info(
              'Updating CRM activity with request:',
              submission.contactId,
              submission.season
            )

            const updateCrmActivityResult = await updateActivity(
              submission.contactId,
              submission.season
            )

            if (updateCrmActivityResult.ErrorMessage) {
              logger.error(
                `failed to update activity in CRM for ${submission.contactId}`,
                updateCrmActivityResult.ErrorMessage
              )
            } else {
              logger.info(
                'Updated CRM activity with result:',
                updateCrmActivityResult
              )
            }
          }

          const mappedSubmission = mapSubmissionToResponse(
            updatedSubmission.toJSON()
          )

          return h.response(mappedSubmission).code(StatusCodes.OK)
        } catch (error) {
          return handleServerError('Error updating submission', error, h)
        }
      },
      validate: {
        params: getBySubmissionIdSchema,
        payload: updateSubmissionSchema,
        options: { entity: 'Submission' }
      },
      description: 'Update a submission',
      notes: 'Update a submission',
      tags: ['api', 'submissions']
    }
  },
  {
    method: 'DELETE',
    path: BASE_SUBMISSIONS_URL,
    options: {
      /**
       * Delete a submission by its submissionId from the database
       *
       * @param {import('@hapi/hapi').Request request - The Hapi request object
       *     @param {string} request.params.submissionId - The ID of the submission to be deleted
       * @param {import('@hapi/hapi').ResponseToolkit} h - The Hapi response toolkit
       * @returns {Promise<import('@hapi/hapi').ResponseObject>} - A response containing the target {@link Submission}
       */
      handler: async (request, h) => {
        const submissionId = request.params.submissionId
        // Begin transaction for atomic operation
        const transaction = await sequelize.transaction()

        try {
          const foundSubmission = await Submission.findOne({
            where: { id: submissionId }
          })

          if (!foundSubmission) {
            await transaction.rollback()
            return handleNotFound(`Submission not found ${submissionId}`, h)
          }

          logger.info(
            'Deleting submission with id:%s and related records',
            submissionId
          )

          const activities = await Activity.findAll({
            where: { submission_id: submissionId }
          })

          for (const activity of activities) {
            const smallCatchIds = (
              await SmallCatch.findAll({
                attributes: ['id'],
                where: { activity_id: activity.id },
                transaction
              })
            )?.map((smallCatch) => smallCatch.id)

            // Delete associated SmallCatchCount
            await SmallCatchCount.destroy({
              where: { small_catch_id: smallCatchIds },
              transaction
            })

            // Delete associated SmallCatches
            await SmallCatch.destroy({
              where: { activity_id: activity.id },
              transaction
            })

            // Delete associated Catches
            await Catch.destroy({
              where: { activity_id: activity.id },
              transaction
            })

            // Delete the Activity
            await Activity.destroy({
              where: { id: activity.id },
              transaction
            })
          }

          // Delete the submission
          const deletedCount = await Submission.destroy({
            where: { id: submissionId },
            transaction
          })

          if (deletedCount === 0) {
            await transaction.rollback()
            return handleServerError(
              'Error deleting submission',
              new Error('Unable to delete submission'),
              h
            )
          }

          // Commit transaction
          await transaction.commit()

          logger.info(
            'Deleted submission with id: %s and related records',
            submissionId
          )
          return h.response().code(StatusCodes.NO_CONTENT)
        } catch (error) {
          await transaction.rollback()
          return handleServerError('Error deleting submission', error, h)
        }
      },
      validate: {
        params: getBySubmissionIdSchema
      },
      description: 'Delete a submission by submissionId',
      notes: 'Delete a submission by submissionId',
      tags: ['api', 'submissions']
    }
  }
]
