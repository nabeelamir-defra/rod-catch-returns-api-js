import { Activity, Catch, Submission } from '../entities/index.js'
import { createActivity as createActivityCRM } from '@defra-fish/dynamics-lib'
import logger from '../utils/logger-utils.js'

/**
 * Checks if a submission exists in the database by its ID.
 *
 * @param {number|string} submissionId - The ID of the submission to check.
 * @returns {Promise<boolean>} - A promise that resolves to `true` if the submission exists, otherwise `false`.
 */
export const isSubmissionExistsById = async (submissionId) => {
  const count = await Submission.count({ where: { id: submissionId } })
  return count > 0
}

/**
 * Checks if a submission exists in the database by the contactId and season.
 *
 * @param {string} contactId - The ID of the contact retrieved from CRM
 * @param {string} season - The season of the submission
 * @returns {Promise<boolean>} - A promise that resolves to `true` if the submission exists, otherwise `false`.
 */
export const isSubmissionExistsByUserAndSeason = async (contactId, season) => {
  const count = await Submission.count({ where: { contactId, season } })
  return count > 0
}

/**
 * Retrieves a submission from the database by its ID.
 *
 * @param {number|string} submissionId - The ID of the submission to retrieve.
 * @returns {Promise<Submission|null>} - A promise that resolves to the submission object if found, otherwise `null`.
 */
export const getSubmission = async (submissionId) => {
  return Submission.findOne({
    where: {
      id: submissionId
    }
  })
}

/**
 * Fetches the associated Submission by the given catch ID.
 *
 * This function traverses the relationships between the `Catch`, `Activity`,
 * and `Submission` models to find the `Submission` corresponding to the given `Catch` ID.
 *
 * @param {number} catch - The ID of the catch for which to fetch the submission.
 * @returns {Promise<Submission>} - A promise that resolves to the Submission associated with the given catch ID.
 * @throws {Error} - Throws an error if no submission is found or if the query fails.
 */
export const getSubmissionByCatchId = async (catchId) => {
  try {
    const catchWithActivityAndSubmission = await Catch.findOne({
      where: { id: catchId },
      include: {
        model: Activity,
        include: Submission
      }
    })

    if (!catchWithActivityAndSubmission) {
      throw new Error(`No Catch found for catch ID ${catchId}`)
    }

    if (!catchWithActivityAndSubmission.Activity) {
      throw new Error(`No Activity found for catch ID ${catchId}`)
    }

    return catchWithActivityAndSubmission.Activity.Submission
  } catch (error) {
    throw new Error(
      `Failed to fetch submission for catch ID ${catchId}: ${error}`
    )
  }
}

/**
 * Handle CRM activity creation with logging
 * @param {string} contactId
 * @param {string|number} season
 */
export const handleCrmActivity = async (contactId, season) => {
  logger.info('Creating CRM activity with request:', contactId, season)

  const result = await createActivityCRM(contactId, season)

  if (result?.ErrorMessage) {
    const logFn =
      result.ErrorMessage ===
      'RCR Activity Already Exists For the Given Contact and Activity Status'
        ? logger.info
        : logger.error

    logFn(
      `Failed to create activity in CRM for ${contactId}`,
      result.ErrorMessage
    )
  } else {
    logger.info('Created CRM activity with result:', result)
  }

  return result
}
