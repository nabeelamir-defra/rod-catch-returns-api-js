import {
  activityIdSchema,
  createActivitySchema,
  updateActivitySchema
} from '../activities.schema.js'
import {
  getSubmission,
  isSubmissionExistsById
} from '../../services/submissions.service.js'
import {
  getSubmissionByActivityId,
  isActivityExists
} from '../../services/activities.service.js'
import { isFMTOrAdmin } from '../../utils/auth-utils.js'
import { isRiverInternal } from '../../services/rivers.service.js'

jest.mock('../../services/activities.service.js')
jest.mock('../../services/rivers.service.js')
jest.mock('../../services/submissions.service.js')
jest.mock('../../utils/auth-utils.js')

describe('activities.schema.unit', () => {
  describe('createActivitySchema', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const getDefaultPayload = ({
      submission = 'submissions/123',
      daysFishedWithMandatoryRelease = 5,
      daysFishedOther = 3,
      river = 'rivers/456'
    } = {}) => ({
      submission,
      daysFishedWithMandatoryRelease,
      daysFishedOther,
      river
    })

    const setupMocks = ({
      season = 2024,
      submissionExists = true,
      riverInternal = false,
      activityExists = false,
      fmtOrAdmin = false
    } = {}) => {
      getSubmission.mockResolvedValue({ season })
      isSubmissionExistsById.mockResolvedValue(submissionExists)
      isRiverInternal.mockResolvedValue(riverInternal)
      isActivityExists.mockResolvedValue(activityExists)
      isFMTOrAdmin.mockReturnValue(fmtOrAdmin)
    }

    it('should validate successfully when all fields are provided and valid', async () => {
      setupMocks()
      const payload = getDefaultPayload()

      await expect(
        createActivitySchema.validateAsync(payload)
      ).resolves.toStrictEqual(payload)
    })

    it('should return an error if the activity already exists for the same submission and river', async () => {
      setupMocks({ activityExists: true })
      const payload = getDefaultPayload()

      await expect(createActivitySchema.validateAsync(payload)).rejects.toThrow(
        'ACTIVITY_RIVER_DUPLICATE_FOUND'
      )
    })

    describe('submission', () => {
      it('should return an error if "submission" is missing', async () => {
        setupMocks()
        const payload = { ...getDefaultPayload(), submission: undefined }

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_SUBMISSION_REQUIRED')
      })

      it('should return an error if "submission" is an empty string', async () => {
        setupMocks()
        const payload = getDefaultPayload({ submission: '' })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_SUBMISSION_REQUIRED')
      })

      it('should return an error if "submission" does not start with "submissions/"', async () => {
        setupMocks()
        const payload = getDefaultPayload({ submission: 'invalid/123' })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_SUBMISSION_PATTERN_INVALID')
      })

      it('should return an error if submission does not exist', async () => {
        isSubmissionExistsById.mockResolvedValue(false)
        const payload = getDefaultPayload()

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_SUBMISSION_NOT_FOUND')
      })
    })

    describe('river', () => {
      it('should return an error if "river" is missing', async () => {
        setupMocks()
        const payload = { ...getDefaultPayload(), river: undefined }

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_RIVER_REQUIRED')
      })

      it('should return an error if "river" is an empty string', async () => {
        setupMocks()
        const payload = getDefaultPayload({ river: '' })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_RIVER_REQUIRED')
      })

      it('should return an error if "river" does not start with "rivers/"', async () => {
        setupMocks()
        const payload = getDefaultPayload({ river: 'invalid/456' })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_RIVER_PATTERN_INVALID')
      })

      it('should return an error if river is restricted and the user is not an admin or fmt', async () => {
        setupMocks({ riverInternal: true })
        const payload = getDefaultPayload()

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_RIVER_FORBIDDEN')
      })

      it('should continue if river is restricted and the user is an admin or fmt', async () => {
        setupMocks({ riverInternal: true, fmtOrAdmin: true })
        const payload = getDefaultPayload()

        await expect(
          createActivitySchema.validateAsync(payload)
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if the river could not be found', async () => {
        getSubmission.mockResolvedValue({ season: 2024 })
        isSubmissionExistsById.mockResolvedValue(true)
        const error = new Error('RIVER_NOT_FOUND')
        isRiverInternal.mockRejectedValueOnce(error)
        const payload = getDefaultPayload()

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_RIVER_NOT_FOUND')
      })

      it('should return an error if there is an error retrieving the river', async () => {
        getSubmission.mockResolvedValue({ season: 2024 })
        isSubmissionExistsById.mockResolvedValue(true)
        const error = new Error('Database error')
        isRiverInternal.mockRejectedValueOnce(error)
        const payload = getDefaultPayload()

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('Database error')
      })
    })

    describe('daysFishedWithMandatoryRelease', () => {
      it('should validate successfully if "daysFishedWithMandatoryRelease" is 0 and "daysFishedOther is more than 0', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedOther: 2,
          daysFishedWithMandatoryRelease: 0
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if "daysFishedWithMandatoryRelease" is not a number', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 'five'
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_NOT_A_NUMBER'
        )
      })

      it('should return an error if "daysFishedWithMandatoryRelease" is negative', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: -1
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_NEGATIVE'
        )
      })

      it('should validate successfully when daysFishedWithMandatoryRelease is within the limit for a non-leap year', async () => {
        setupMocks({ season: 2023 }) // 2023 is not a leap year
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 167
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if daysFishedWithMandatoryRelease exceeds 167 for a non-leap year', async () => {
        setupMocks({ season: 2023 }) // 2023 is not a leap year
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 168
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_MAX_EXCEEDED'
        )
      })

      it('should validate successfully when daysFishedWithMandatoryRelease is within the limit for a leap year', async () => {
        setupMocks({ season: 2024 }) // 2024 is a leap year
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 168
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if daysFishedWithMandatoryRelease exceeds 168 for a leap year', async () => {
        setupMocks({ season: 2024 }) // 2024 is a leap year

        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 169
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_MAX_EXCEEDED'
        )
      })

      it('should return an error if "daysFishedWithMandatoryRelease" is missing', async () => {
        setupMocks()
        const payload = {
          ...getDefaultPayload(),
          daysFishedWithMandatoryRelease: undefined
        }

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_REQUIRED'
        )
      })

      it('should return an error if "daysFishedWithMandatoryRelease" is a non-integer number', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 1.5
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_WITH_MANDATORY_NOT_AN_INTEGER')
      })
    })

    describe('daysFishedOther', () => {
      it('should validate successfully if "daysFishedOther" is 0 and "daysFishedWithMandatoryRelease is more than 0', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedOther: 0,
          daysFishedWithMandatoryRelease: 3
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if "daysFishedOther" is not a number', async () => {
        setupMocks()
        const payload = getDefaultPayload({ daysFishedOther: 'three' })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_NOT_A_NUMBER')
      })

      it('should return an error if "daysFishedOther" is negative', async () => {
        setupMocks()
        const payload = getDefaultPayload({ daysFishedOther: -1 })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_NEGATIVE')
      })

      it('should return an error if "daysFishedOther" is missing', async () => {
        setupMocks()
        const payload = { ...getDefaultPayload(), daysFishedOther: undefined }

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_REQUIRED')
      })

      it('should return an error if "daysFishedOther" is a non-integer number', async () => {
        setupMocks()
        const payload = getDefaultPayload({ daysFishedOther: 3.5 })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_NOT_AN_INTEGER')
      })

      it('should return an error if "daysFishedWithMandatoryRelease" is 0 and "daysFishedOther" is 0, if the user is not an admin or fmt', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 0,
          daysFishedOther: 0
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_NOT_GREATER_THAN_ZERO')
      })

      it('should validate successfully if "daysFishedWithMandatoryRelease" is 0 and "daysFishedOther" is 0, if the user is an admin or fmt', async () => {
        setupMocks({ fmtOrAdmin: true })
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 0,
          daysFishedOther: 0
        })

        await expect(
          createActivitySchema.validateAsync(payload)
        ).resolves.toStrictEqual(payload)
      })
    })
  })

  describe('updateActivitySchema', () => {
    afterEach(() => {
      jest.resetAllMocks()
    })

    const getDefaultPayload = ({
      daysFishedWithMandatoryRelease = 5,
      daysFishedOther = 3,
      river = 'rivers/456'
    } = {}) => ({
      daysFishedWithMandatoryRelease,
      daysFishedOther,
      river
    })

    const getDefaultContext = () => ({
      context: {
        params: {
          activityId: '12345'
        }
      }
    })

    const setupMocks = ({
      season = 2024,
      submissionExists = true,
      riverInternal = false,
      activityExists = false,
      submission = { id: '1', season },
      fmtOrAdmin = false
    } = {}) => {
      getSubmission.mockResolvedValue({ season })
      isSubmissionExistsById.mockResolvedValue(submissionExists)
      isRiverInternal.mockResolvedValue(riverInternal)
      isActivityExists.mockResolvedValue(activityExists)
      getSubmissionByActivityId.mockResolvedValue(submission)
      isFMTOrAdmin.mockReturnValue(fmtOrAdmin)
    }

    it('should validate successfully when all fields are provided and valid', async () => {
      setupMocks()
      const payload = getDefaultPayload()

      await expect(
        updateActivitySchema.validateAsync(payload, getDefaultContext())
      ).resolves.toStrictEqual(payload)
    })

    describe('river', () => {
      it('should validate successfully if "river" is missing', async () => {
        setupMocks()
        const payload = { ...getDefaultPayload(), river: undefined }

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if "river" is an empty string', async () => {
        setupMocks()
        const payload = getDefaultPayload({ river: '' })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_RIVER_REQUIRED')
      })

      it('should return an error if "river" does not start with "rivers/"', async () => {
        setupMocks()
        const payload = getDefaultPayload({ river: 'invalid/456' })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_RIVER_PATTERN_INVALID')
      })

      it('should return an error if river is restricted', async () => {
        setupMocks({ riverInternal: true })
        const payload = getDefaultPayload()

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_RIVER_FORBIDDEN')
      })

      it('should return an error if an activity with the same river is found', async () => {
        setupMocks({ activityExists: true })
        const payload = getDefaultPayload()

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_RIVER_DUPLICATE_FOUND')
      })
    })

    describe('daysFishedWithMandatoryRelease', () => {
      it('should validate successfully if "daysFishedWithMandatoryRelease" is missing', async () => {
        setupMocks()
        const payload = {
          ...getDefaultPayload(),
          daysFishedWithMandatoryRelease: undefined
        }

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).resolves.toStrictEqual(payload)
      })

      it('should validate successfully when daysFishedWithMandatoryRelease is within the limit for a non-leap year', async () => {
        setupMocks({ season: 2023 }) // 2023 is not a leap year
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 167
        })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if daysFishedWithMandatoryRelease exceeds 167 for a non-leap year', async () => {
        setupMocks({ season: 2023 }) // 2023 is not a leap year
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 168
        })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_MAX_EXCEEDED'
        )
      })

      it('should validate successfully when daysFishedWithMandatoryRelease is within the limit for a leap year', async () => {
        setupMocks({ season: 2024 }) // 2024 is a leap year
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 168
        })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if daysFishedWithMandatoryRelease exceeds 168 for a leap year', async () => {
        setupMocks({ season: 2024 }) // 2024 is a leap year

        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 169
        })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow(
          'ACTIVITY_DAYS_FISHED_WITH_MANDATORY_RELEASE_MAX_EXCEEDED'
        )
      })

      it('should return an error if if the activity could not be found', async () => {
        setupMocks({ submission: null })
        const payload = getDefaultPayload()

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_SUBMISSION_NOT_FOUND')
      })
    })

    describe('daysFishedOther', () => {
      it('should validate successfully if "daysFishedOther" is missing', async () => {
        setupMocks()
        const payload = { ...getDefaultPayload(), daysFishedOther: undefined }

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).resolves.toStrictEqual(payload)
      })

      it('should validate successfully if "daysFishedOther" is 0 and "daysFishedWithMandatoryRelease is more than 0', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedOther: 0,
          daysFishedWithMandatoryRelease: 3
        })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).resolves.toStrictEqual(payload)
      })

      it('should return an error if "daysFishedOther" is not a number', async () => {
        setupMocks()
        const payload = getDefaultPayload({ daysFishedOther: 'three' })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_NOT_A_NUMBER')
      })

      it('should return an error if "daysFishedOther" is negative', async () => {
        setupMocks()
        const payload = getDefaultPayload({ daysFishedOther: -1 })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_NEGATIVE')
      })

      it('should return an error if "daysFishedOther" is a non-integer number', async () => {
        setupMocks()
        const payload = getDefaultPayload({ daysFishedOther: 3.5 })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_OTHER_NOT_AN_INTEGER')
      })

      it('should return an error if "daysFishedWithMandatoryRelease" is 0 and "daysFishedOther" is 0, if the user is not an admin or fmt', async () => {
        setupMocks()
        const payload = getDefaultPayload({
          daysFishedWithMandatoryRelease: 0,
          daysFishedOther: 0
        })

        await expect(
          updateActivitySchema.validateAsync(payload, getDefaultContext())
        ).rejects.toThrow('ACTIVITY_DAYS_FISHED_NOT_GREATER_THAN_ZERO')
      })
    })

    it('should validate successfully if "daysFishedWithMandatoryRelease" is 0 and "daysFishedOther" is 0, if the user is an admin or fmt', async () => {
      setupMocks({ fmtOrAdmin: true })
      const payload = getDefaultPayload({
        daysFishedWithMandatoryRelease: 0,
        daysFishedOther: 0
      })

      await expect(
        updateActivitySchema.validateAsync(payload, getDefaultContext())
      ).resolves.toStrictEqual(payload)
    })
  })

  describe('activityIdSchema', () => {
    it('should validate successfully when "activityId" is provided and valid', () => {
      const params = { activityId: 123 }
      const { error } = activityIdSchema.validate(params)

      expect(error).toBeUndefined()
    })

    it('should return an error if "activityId" is missing', () => {
      const params = { activityId: undefined }
      const { error } = activityIdSchema.validate(params)

      expect(error.details[0].message).toContain('"activityId" is required')
    })

    it('should return an error if "activityId" is not a number', () => {
      const params = { activityId: 'abc' }
      const { error } = activityIdSchema.validate(params)

      expect(error.details[0].message).toContain(
        '"activityId" must be a number'
      )
    })
  })
})
