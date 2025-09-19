import { extractRiverId, extractSubmissionId } from '../utils/entity-utils.js'
import {
  getSubmission,
  isSubmissionExistsById
} from '../services/submissions.service.js'
import {
  getSubmissionByActivityId,
  isActivityExists
} from '../services/activities.service.js'
import Joi from 'joi'
import { isFMTOrAdmin } from '../utils/auth-utils.js'
import { isLeapYear } from '../utils/date-utils.js'
import { isRiverInternal } from '../services/rivers.service.js'

const MAX_DAYS_LEAP_YEAR = 168
const MAX_DAYS_NON_LEAP_YEAR = 167

const validateDaysFished = (daysFishedOther, helper) => {
  const fmtOrAdmin = isFMTOrAdmin(helper?.prefs?.context?.auth?.role)

  const daysFishedWithMandatoryRelease =
    helper.state.ancestors[0].daysFishedWithMandatoryRelease

  if (
    !fmtOrAdmin &&
    daysFishedOther < 1 &&
    daysFishedWithMandatoryRelease < 1
  ) {
    return helper.message('ACTIVITY_DAYS_FISHED_NOT_GREATER_THAN_ZERO')
  }

  return daysFishedOther
}

const validateDaysFishedWithMandatoryRelease = async (
  value,
  helper,
  submission
) => {
  if (!submission) {
    return helper.message('ACTIVITY_SUBMISSION_NOT_FOUND')
  }

  const maxDaysFished = isLeapYear(submission.season)
    ? MAX_DAYS_LEAP_YEAR
    : MAX_DAYS_NON_LEAP_YEAR

  if (value > maxDaysFished) {
    return helper.message(
      'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_MAX_EXCEEDED'
    )
  }
  return value
}

const validateSubmission = async (value, helper) => {
  const submissionId = extractSubmissionId(value)
  const submissionExists = await isSubmissionExistsById(submissionId)
  return submissionExists
    ? value
    : helper.message('ACTIVITY_SUBMISSION_NOT_FOUND')
}

const validateRiver = async (value, helper) => {
  try {
    const riverId = extractRiverId(value)
    const riverInternal = await isRiverInternal(riverId)
    const fmtOrAdmin = isFMTOrAdmin(helper?.prefs?.context?.auth?.role)

    if (riverInternal && !fmtOrAdmin) {
      return helper.message('ACTIVITY_RIVER_FORBIDDEN')
    }

    return value
  } catch (error) {
    // Handle the case where the river does not exist
    if (error.message === 'RIVER_NOT_FOUND') {
      return helper.message('ACTIVITY_RIVER_NOT_FOUND')
    }

    // Re-throw unexpected errors
    throw error
  }
}

const daysFishedWithMandatoryReleaseField = Joi.number()
  .integer()
  .min(0)
  .description('The number of days fished during the mandatory release period')
  .messages({
    'any.required': 'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_REQUIRED',
    'number.min': 'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_NEGATIVE',
    'number.base': 'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_NOT_A_NUMBER',
    'number.integer': 'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_NOT_AN_INTEGER'
  })

const daysFishedOtherField = Joi.number()
  .integer()
  .min(0)
  .max(198)
  .required()
  .description('The number of days fished at other times during the season')
  .messages({
    'any.required': 'ACTIVITY_DAYS_FISHED_OTHER_REQUIRED',
    'number.min': 'ACTIVITY_DAYS_FISHED_OTHER_NEGATIVE',
    'number.max': 'ACTIVITY_DAYS_FISHED_OTHER_MAX_EXCEEDED',
    'number.base': 'ACTIVITY_DAYS_FISHED_OTHER_NOT_A_NUMBER',
    'number.integer': 'ACTIVITY_DAYS_FISHED_OTHER_NOT_AN_INTEGER'
  })
  .external(validateDaysFished)

const riverField = Joi.string()

  .pattern(/^rivers\//)
  .description('The river id prefixed with rivers/')
  .messages({
    'any.required': 'ACTIVITY_RIVER_REQUIRED',
    'string.empty': 'ACTIVITY_RIVER_REQUIRED',
    'string.pattern.base': 'ACTIVITY_RIVER_PATTERN_INVALID'
  })

export const createActivitySchema = Joi.object({
  submission: Joi.string()
    .required()
    .external(validateSubmission)
    .pattern(/^submissions\//)
    .description('The submission id prefixed with submissions/')
    .messages({
      'any.required': 'ACTIVITY_SUBMISSION_REQUIRED',
      'string.empty': 'ACTIVITY_SUBMISSION_REQUIRED',
      'string.pattern.base': 'ACTIVITY_SUBMISSION_PATTERN_INVALID'
    }),

  daysFishedWithMandatoryRelease: daysFishedWithMandatoryReleaseField
    .required()
    .external(async (value, helper) => {
      const submissionId = extractSubmissionId(
        helper.state.ancestors[0].submission
      )
      const submission = await getSubmission(submissionId)
      return validateDaysFishedWithMandatoryRelease(value, helper, submission)
    }),
  daysFishedOther: daysFishedOtherField.required(),

  river: riverField
    .required()
    .external(validateRiver)
    .external(async (value, helper) => {
      const submissionId = extractSubmissionId(
        helper.state.ancestors[0].submission
      )
      const riverId = extractRiverId(value)

      const activityExists = await isActivityExists(submissionId, riverId)

      if (activityExists) {
        return helper.message('ACTIVITY_RIVER_DUPLICATE_FOUND')
      }
      return value
    })
})

export const updateActivitySchema = Joi.object({
  daysFishedWithMandatoryRelease: daysFishedWithMandatoryReleaseField
    .optional()
    .external(async (value, helper) => {
      // Skip validation if the field is undefined (Joi runs external validation, even if the field is not supplied)
      if (value === undefined) {
        return value
      }

      const activityId = helper.prefs.context.params.activityId
      const submission = await getSubmissionByActivityId(activityId)
      return validateDaysFishedWithMandatoryRelease(value, helper, submission)
    }),
  daysFishedOther: daysFishedOtherField.optional(),
  river: riverField
    .optional()
    .external(async (value, helper) => {
      // Skip validation if the field is undefined (Joi runs external validation, even if the field is not supplied)
      if (value === undefined) {
        return value
      }
      return validateRiver(value, helper)
    })
    .external(async (value, helper) => {
      // Skip validation if the field is undefined (Joi runs external validation, even if the field is not supplied)
      if (value === undefined) {
        return value
      }
      // Get activityId from the request context
      const activityId = helper.prefs.context.params.activityId

      const riverId = extractRiverId(value)
      const submission = await getSubmissionByActivityId(activityId)

      const activityExists = await isActivityExists(
        submission.id,
        riverId,
        activityId
      )

      if (activityExists) {
        return helper.message('ACTIVITY_RIVER_DUPLICATE_FOUND')
      }
      return value
    })
}).unknown()

export const activityIdSchema = Joi.object({
  activityId: Joi.number().required().description('The id of the activity')
})
