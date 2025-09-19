import {
  Activity,
  Catch,
  SmallCatch,
  SmallCatchCount,
  Submission
} from '../../../entities/index.js'
import {
  getMockResponseToolkit,
  getServerDetails
} from '../../../test-utils/server-test-utils.js'
import {
  handleCrmActivity,
  isSubmissionExistsByUserAndSeason
} from '../../../services/submissions.service.js'
import {
  handleNotFound,
  handleServerError
} from '../../../utils/server-utils.js'
import { getCreateActivityResponse } from '../../../test-utils/test-data.js'
import logger from '../../../utils/logger-utils.js'
import routes from '../submissions.js'
import { sequelize } from '../../../services/database.service.js'
import { updateActivity as updateActivityCRM } from '@defra-fish/dynamics-lib'

jest.mock('../../../entities/index.js')
jest.mock('../../../utils/logger-utils.js')
jest.mock('../../../utils/server-utils.js')
jest.mock('../../../services/database.service.js', () => ({
  sequelize: {
    transaction: jest.fn(),
    define: jest.fn(() => ({
      associate: jest.fn(),
      hasMany: jest.fn(),
      belongsTo: jest.fn(),
      findAll: jest.fn(),
      findByPk: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn()
    })),
    literal: jest.fn()
  }
}))
jest.mock('../../../services/submissions.service.js')

const [
  {
    options: { handler: postSubmissionHandler }
  },
  {
    options: { handler: getSubmissionsByContactIdHandler }
  },
  {
    options: { handler: getSubmissionByContactIdAndSeasonHandler }
  },
  {
    options: { handler: getActivitiesBySubmissionIdHandler }
  },
  {
    options: { handler: getSubmissionByIdHandler }
  },
  {
    options: { handler: patchSubmissionByIdHandler }
  },
  {
    options: { handler: deleteSubmissionByIdHandler }
  }
] = routes

const NOT_FOUND_SYMBOL = Symbol('NOT_FOUND')
const SERVER_ERROR_SYMBOL = Symbol('SERVER_ERROR')

handleNotFound.mockReturnValue(NOT_FOUND_SYMBOL)
handleServerError.mockReturnValue(SERVER_ERROR_SYMBOL)

describe('submissions.unit', () => {
  const getFoundSubmission = () => ({
    toJSON: jest.fn().mockReturnValue({
      id: '1',
      contactId: 'contact-identifier-111',
      season: '2024',
      status: 'SUBMITTED',
      source: 'WEB',
      version: '2024-10-10T13:13:11.000Z',
      reportingExclude: false,
      createdAt: '2024-10-10T13:13:11.000Z',
      updatedAt: '2024-10-10T13:13:11.000Z'
    })
  })

  describe('POST /submissions', () => {
    const getSubmissionRequest = () =>
      getServerDetails({
        payload: {
          contactId: 'contact-identifier-111',
          season: '2024',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

    const getCreatedSubmission = () => ({
      toJSON: jest.fn().mockReturnValue({
        id: '1',
        contactId: 'contact-identifier-111',
        season: '2024',
        status: 'INCOMPLETE',
        source: 'WEB',
        version: '2024-10-10T13:13:11.000Z',
        reportingExclude: true,
        createdAt: '2024-10-10T13:13:11.000Z',
        updatedAt: '2024-10-10T13:13:11.000Z'
      })
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return a 201 status code if the submission is created successfully', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(false)
      Submission.create.mockResolvedValueOnce(getCreatedSubmission())
      handleCrmActivity.mockResolvedValueOnce(getCreateActivityResponse())

      const result = await postSubmissionHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(201)
    })

    it('should return the created submission in the response body', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(false)
      handleCrmActivity.mockResolvedValueOnce(getCreateActivityResponse())
      Submission.create.mockResolvedValueOnce(getCreatedSubmission())

      const result = await postSubmissionHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toStrictEqual({
        contactId: 'contact-identifier-111',
        createdAt: '2024-10-10T13:13:11.000Z',
        id: '1',
        reportingExclude: true,
        season: '2024',
        source: 'WEB',
        status: 'INCOMPLETE',
        updatedAt: '2024-10-10T13:13:11.000Z',
        version: '2024-10-10T13:13:11.000Z',
        _links: {
          activities: {
            href: 'http://localhost:5000/api/submissions/1/activities'
          },
          self: {
            href: 'http://localhost:5000/api/submissions/1'
          },
          submission: {
            href: 'http://localhost:5000/api/submissions/1'
          }
        }
      })
    })

    it('should call handleServerError if submission creation fails', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(false)
      const error = new Error('Database error')
      Submission.create.mockRejectedValueOnce(error)

      const h = getMockResponseToolkit()

      await postSubmissionHandler(getSubmissionRequest(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error creating submission',
        error,
        h
      )
    })

    it('should return a error response if an error occurs while creating submission', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(false)
      const error = new Error('Database error')
      Submission.create.mockRejectedValueOnce(error)

      const result = await postSubmissionHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })

    it('should call handleServerError when the call to create an activity in CRM returns an error', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(false)
      Submission.create.mockResolvedValueOnce(getCreatedSubmission())
      const error = new Error('CRM')
      handleCrmActivity.mockRejectedValueOnce(error)

      const h = getMockResponseToolkit()
      await postSubmissionHandler(getSubmissionRequest(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error creating submission',
        error,
        h
      )
    })

    it('should return an error response when the call to create an activity in CRM returns an error', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(false)
      Submission.create.mockResolvedValueOnce(getCreatedSubmission())
      const error = new Error('CRM')
      handleCrmActivity.mockRejectedValueOnce(error)

      const result = await postSubmissionHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })

    it('should return a 409 and error message if a submission exists for a given contactId and season', async () => {
      isSubmissionExistsByUserAndSeason.mockResolvedValueOnce(true)

      const result = await postSubmissionHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(409)
      expect(result.payload).toStrictEqual({
        error:
          'Submission already exists for contact=contact-identifier-111 and season=2024'
      })
    })
  })

  describe('GET /submissions/search/findByContactId', () => {
    const getSubmissionRequest = () =>
      getServerDetails({
        query: {
          contact_id: 'contact-identifier-111'
        }
      })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return a 200 status code if the submissions are found', async () => {
      Submission.findAll.mockResolvedValueOnce([getFoundSubmission()])

      const result = await getSubmissionsByContactIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
    })

    it('should return the found submissions in the response body', async () => {
      Submission.findAll.mockResolvedValueOnce([getFoundSubmission()])

      const result = await getSubmissionsByContactIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toMatchSnapshot()
    })

    it('should return an empty array if no submissions are found', async () => {
      Submission.findAll.mockResolvedValueOnce([])

      const result = await getSubmissionsByContactIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toMatchSnapshot()
    })

    it('should call handleServerError if fetching a submission fails', async () => {
      const error = new Error('Database error')
      Submission.findAll.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await getSubmissionsByContactIdHandler(getSubmissionRequest(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error finding submissions',
        error,
        h
      )
    })
  })

  describe('GET /submissions/search/getByContactIdAndSeason', () => {
    const getSubmissionRequest = () =>
      getServerDetails({
        query: {
          contact_id: 'contact-identifier-111',
          season: '2024'
        }
      })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return a 200 status code if the submission is found', async () => {
      Submission.findOne.mockResolvedValueOnce(getFoundSubmission())

      const result = await getSubmissionByContactIdAndSeasonHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
    })

    it('should return the found submission in the response body', async () => {
      Submission.findOne.mockResolvedValueOnce(getFoundSubmission())

      const result = await getSubmissionByContactIdAndSeasonHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toMatchSnapshot()
    })

    it('should call log if the submission is not found', async () => {
      Submission.findOne.mockResolvedValueOnce(null)
      const h = getMockResponseToolkit()

      await getSubmissionByContactIdAndSeasonHandler(getSubmissionRequest(), h)

      expect(logger.info).toHaveBeenCalledWith(
        'Submission not found for contact-identifier-111 and 2024'
      )
    })

    it('should return a 404 status code if the submission is not found', async () => {
      Submission.findOne.mockResolvedValueOnce(null)

      const result = await getSubmissionByContactIdAndSeasonHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(404)
    })

    it('should call handleServerError if fetching a submission fails', async () => {
      const error = new Error('Database error')
      Submission.findOne.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await getSubmissionByContactIdAndSeasonHandler(getSubmissionRequest(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error finding submission',
        error,
        h
      )
    })

    it('should return an error message if an error occurs while fetching submission', async () => {
      const error = new Error('Database error')
      Submission.findOne.mockRejectedValueOnce(error)

      const result = await getSubmissionByContactIdAndSeasonHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })

  describe('GET /submissions/{submissionId}', () => {
    const getSubmissionRequest = () =>
      getServerDetails({
        params: {
          submissionId: '1'
        }
      })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return a 200 status code if the submission is found', async () => {
      Submission.findOne.mockResolvedValueOnce(getFoundSubmission())

      const result = await getSubmissionByIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
    })

    it('should return the found submission in the response body', async () => {
      Submission.findOne.mockResolvedValueOnce(getFoundSubmission())

      const result = await getSubmissionByIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toStrictEqual({
        contactId: 'contact-identifier-111',
        createdAt: '2024-10-10T13:13:11.000Z',
        id: '1',
        reportingExclude: false,
        season: '2024',
        source: 'WEB',
        status: 'SUBMITTED',
        updatedAt: '2024-10-10T13:13:11.000Z',
        version: '2024-10-10T13:13:11.000Z',
        _links: {
          activities: {
            href: 'http://localhost:5000/api/submissions/1/activities'
          },
          self: {
            href: 'http://localhost:5000/api/submissions/1'
          },
          submission: {
            href: 'http://localhost:5000/api/submissions/1'
          }
        }
      })
    })

    it('should call handleNotFound if the submission is not found', async () => {
      Submission.findOne.mockResolvedValueOnce(null)
      const h = getMockResponseToolkit()

      await getSubmissionByIdHandler(getSubmissionRequest(), h)

      expect(handleNotFound).toHaveBeenCalledWith('Submission not found 1', h)
    })

    it('should call a not found response if the submission is not found', async () => {
      Submission.findOne.mockResolvedValueOnce(null)

      const result = await getSubmissionByIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(NOT_FOUND_SYMBOL)
    })

    it('should call handleServerError if fetching submission fails', async () => {
      const error = new Error('Database error')
      Submission.findOne.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await getSubmissionByIdHandler(getSubmissionRequest(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error finding submission',
        error,
        h
      )
    })

    it('should return an error response  if an error occurs while fetching submission', async () => {
      const error = new Error('Database error')
      Submission.findOne.mockRejectedValueOnce(error)

      const result = await getSubmissionByIdHandler(
        getSubmissionRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })

  describe('GET /submissions/{submissionId}/activities', () => {
    const getFoundSubmissionWithActivities = (activities = []) => ({
      id: '1',
      contactId: 'contact-identifier-111',
      season: '2024',
      status: 'SUBMITTED',
      source: 'WEB',
      version: '2024-10-10T13:13:11.000Z',
      Activities: activities,
      createdAt: '2024-10-10T13:13:11.000Z',
      updatedAt: '2024-10-10T13:13:11.000Z'
    })

    const getActivityMock = () => ({
      toJSON: jest.fn().mockReturnValue({
        id: '1',
        daysFishedWithMandatoryRelease: 1,
        daysFishedOther: 2,
        createdAt: '2024-10-10T13:13:11.000Z',
        updatedAt: '2024-10-10T13:13:11.000Z',
        version: '2024-10-10T13:13:11.000Z'
      })
    })

    const getActivitiesRequest = () =>
      getServerDetails({
        params: {
          submissionId: '1'
        }
      })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return 200 with activities if they exist for the submission', async () => {
      const foundSubmissionWithActivities = getFoundSubmissionWithActivities([
        getActivityMock()
      ])
      Submission.findOne.mockResolvedValueOnce(foundSubmissionWithActivities)

      const result = await getActivitiesBySubmissionIdHandler(
        getActivitiesRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toStrictEqual({
        _embedded: {
          activities: [
            {
              id: '1',
              daysFishedWithMandatoryRelease: 1,
              daysFishedOther: 2,
              createdAt: '2024-10-10T13:13:11.000Z',
              updatedAt: '2024-10-10T13:13:11.000Z',
              version: '2024-10-10T13:13:11.000Z',
              _links: {
                self: {
                  href: 'http://localhost:5000/api/activities/1'
                },
                activity: {
                  href: 'http://localhost:5000/api/activities/1'
                },
                submission: {
                  href: 'http://localhost:5000/api/activities/1/submission'
                },
                catches: {
                  href: 'http://localhost:5000/api/activities/1/catches'
                },
                river: {
                  href: 'http://localhost:5000/api/activities/1/river'
                },
                smallCatches: {
                  href: 'http://localhost:5000/api/activities/1/smallCatches'
                }
              }
            }
          ]
        }
      })
      expect(result.statusCode).toBe(200)
    })

    it('should return 200 with an empty activities array if the submission exists but no activities are found', async () => {
      Submission.findOne.mockResolvedValueOnce(
        getFoundSubmissionWithActivities()
      )

      const result = await getActivitiesBySubmissionIdHandler(
        getActivitiesRequest(),
        getMockResponseToolkit()
      )

      expect(result.payload).toStrictEqual({ _embedded: { activities: [] } })
      expect(result.statusCode).toBe(200)
    })

    it('should call handleNotFound if the submission does not exist', async () => {
      Submission.findOne.mockResolvedValueOnce(null)
      const h = getMockResponseToolkit()

      await getActivitiesBySubmissionIdHandler(getActivitiesRequest(), h)

      expect(handleNotFound).toHaveBeenCalledWith(
        'Activities not found for submission with id 1',
        h
      )
    })

    it('should return a not found response if the submission does not exist', async () => {
      Submission.findOne.mockResolvedValueOnce(null)

      const result = await getActivitiesBySubmissionIdHandler(
        getActivitiesRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(NOT_FOUND_SYMBOL)
    })

    it('should log an error if fetching submission with activities fails', async () => {
      const error = new Error('Database error')
      Submission.findOne.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await getActivitiesBySubmissionIdHandler(getActivitiesRequest(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error finding activities for submission',
        error,
        h
      )
    })

    it('should an error response if an error occurs while fetching submission with activities', async () => {
      const error = new Error('Database error')
      Submission.findOne.mockRejectedValueOnce(error)

      const result = await getActivitiesBySubmissionIdHandler(
        getActivitiesRequest(),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })

  describe('PATCH /submissions/{submissionId}', () => {
    const getSubmissionRequest = (payload) =>
      getServerDetails({
        params: {
          submissionId: '1'
        },
        payload
      })

    const getFoundSubmission = () => ({
      id: '1',
      contactId: 'contact-identifier-111',
      season: '2024',
      status: 'SUBMITTED',
      source: 'WEB',
      version: '2024-10-10T13:13:11.000Z',
      reportingExclude: false,
      createdAt: '2024-10-10T13:13:11.000Z',
      updatedAt: '2024-10-10T13:13:11.000Z',
      update: jest.fn().mockResolvedValue({
        toJSON: jest.fn().mockReturnValue({
          id: '1',
          contactId: 'contact-identifier-111',
          season: '2024',
          status: 'SUBMITTED',
          source: 'WEB',
          version: '2024-10-10T13:13:11.000Z',
          reportingExclude: false,
          createdAt: '2024-10-10T13:13:11.000Z',
          updatedAt: '2024-10-10T13:13:11.000Z'
        })
      })
    })

    const getSuccessUpdateActivityCRM = () => ({
      '@odata.context':
        'https://dynamics.om/api/data/v9.1/defra_UpdateRCRActivityResponse',
      ReturnStatus: 'success',
      SuccessMessage: 'RCR Activity - updated successfully',
      ErrorMessage: null,
      oDataContext:
        'https://dynamics.com/api/data/v9.1/defra_UpdateRCRActivityResponse'
    })

    const getErrorUpdateActivityCRM = () => ({
      '@odata.context':
        'https://dynamics.com/api/data/v9.1/defra_CreateRCRActivityResponse',
      RCRActivityId: null,
      ReturnStatus: 'error',
      SuccessMessage: '',
      ErrorMessage: 'Failed to update activity'
    })

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return a 200 status code if the submission is updated successfully', async () => {
      Submission.findByPk.mockResolvedValueOnce(getFoundSubmission())
      updateActivityCRM.mockResolvedValue(getSuccessUpdateActivityCRM())

      const result = await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
    })

    it('should call update with the "status"', async () => {
      const foundSubmission = getFoundSubmission()
      Submission.findByPk.mockResolvedValueOnce(foundSubmission)
      updateActivityCRM.mockResolvedValue(getSuccessUpdateActivityCRM())

      await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(foundSubmission.update).toHaveBeenCalledWith({
        status: 'SUBMITTED',
        reportingExclude: undefined,
        version: expect.any(Date)
      })
    })

    it('should call update with "reportingExclude"', async () => {
      const foundSubmission = getFoundSubmission()
      Submission.findByPk.mockResolvedValueOnce(foundSubmission)
      updateActivityCRM.mockResolvedValue(getSuccessUpdateActivityCRM())

      await patchSubmissionByIdHandler(
        getSubmissionRequest({ reportingExclude: true }),
        getMockResponseToolkit()
      )

      expect(foundSubmission.update).toHaveBeenCalledWith({
        status: undefined,
        reportingExclude: true,
        version: expect.any(Date)
      })
    })

    it('should return the updated submission in the response body', async () => {
      Submission.findByPk.mockResolvedValueOnce(getFoundSubmission())
      updateActivityCRM.mockResolvedValue(getSuccessUpdateActivityCRM())

      const result = await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(result.payload).toMatchSnapshot()
    })

    it('should call handleNotFound if the submission is not found', async () => {
      Submission.findByPk.mockResolvedValueOnce(null)
      const h = getMockResponseToolkit()

      await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        h
      )

      expect(handleNotFound).toHaveBeenCalledWith(
        'Submission not found for 1',
        h
      )
    })

    it('should return a not found response if the submission is not found', async () => {
      Submission.findByPk.mockResolvedValueOnce(null)

      const result = await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(result).toBe(NOT_FOUND_SYMBOL)
    })

    it('should call handleServerError if updating the submission fails', async () => {
      const error = new Error('Database error')
      Submission.findByPk.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        h
      )

      expect(handleServerError).toHaveBeenCalledWith(
        'Error updating submission',
        error,
        h
      )
    })

    it('should return an error response if an error occurs while updating the submission', async () => {
      const error = new Error('Database error')
      Submission.findByPk.mockRejectedValueOnce(error)

      const result = await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })

    it('should still return 200 when the call to update an activity in CRM returns an ErrorMessage', async () => {
      Submission.findByPk.mockResolvedValueOnce(getFoundSubmission())
      updateActivityCRM.mockResolvedValue(getErrorUpdateActivityCRM())

      const result = await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
    })

    it('should log an error when the call to update an activity in CRM returns an ErrorMessage', async () => {
      Submission.findByPk.mockResolvedValueOnce(getFoundSubmission())
      updateActivityCRM.mockResolvedValue(getErrorUpdateActivityCRM())

      await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(logger.error).toHaveBeenCalledWith(
        'failed to update activity in CRM for contact-identifier-111',
        'Failed to update activity'
      )
    })

    it('should call handleServerError when the call to update an activity in CRM returns an error', async () => {
      Submission.findByPk.mockResolvedValueOnce(getFoundSubmission())
      const error = new Error('CRM')
      updateActivityCRM.mockRejectedValueOnce(error)

      const h = getMockResponseToolkit()
      await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        h
      )

      expect(handleServerError).toHaveBeenCalledWith(
        'Error updating submission',
        error,
        h
      )
    })

    it('should return an error response when the call to update an activity in CRM returns an error', async () => {
      Submission.findByPk.mockResolvedValueOnce(getFoundSubmission())
      const error = new Error('CRM')
      updateActivityCRM.mockRejectedValueOnce(error)

      const result = await patchSubmissionByIdHandler(
        getSubmissionRequest({ status: 'SUBMITTED' }),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })

  describe('DELETE /submission/{submissionId}', () => {
    const getDeleteRequest = (submissionId) =>
      getServerDetails({ params: { submissionId } })

    const getTransaction = () => ({ commit: jest.fn(), rollback: jest.fn() })

    const setUpDeleteSuccess = ({
      smallCatchIds = [1, 2, 3],
      activityResults = [{ id: 1 }],
      submissionDestroy = 1,
      transaction
    } = {}) => {
      sequelize.transaction.mockResolvedValueOnce(transaction)
      SmallCatch.findAll.mockResolvedValueOnce(
        smallCatchIds.map((id) => ({ id, toJSON: jest.fn() }))
      )
      SmallCatchCount.destroy.mockResolvedValueOnce(3)
      SmallCatch.destroy.mockResolvedValueOnce(3)
      Catch.destroy.mockResolvedValueOnce(2)
      Activity.destroy.mockResolvedValueOnce(1)
      Submission.destroy.mockResolvedValueOnce(submissionDestroy)
      Submission.findOne.mockResolvedValueOnce({ id: 2 })
      Activity.findAll.mockResolvedValueOnce(activityResults)
    }

    const setUpDeleteFailure = ({
      transaction,
      activityResults = [{ id: 1 }],
      error = new Error('Delete failed')
    } = {}) => {
      sequelize.transaction.mockResolvedValueOnce(transaction)
      Activity.findAll.mockResolvedValueOnce(activityResults)
      Submission.findOne.mockResolvedValueOnce({ id: 2 })
      Submission.destroy.mockRejectedValueOnce(error)
    }

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should call Submission.destroy with the correct parameters', async () => {
      const submissionId = '3'
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      await deleteSubmissionByIdHandler(
        getDeleteRequest(submissionId),
        getMockResponseToolkit()
      )

      expect(Submission.destroy).toHaveBeenCalledWith({
        where: { id: submissionId },
        transaction
      })
    })

    it('should call SmallCatch.findAll to fetch associated small catches', async () => {
      const submissionId = '3'
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      await deleteSubmissionByIdHandler(
        getDeleteRequest(submissionId),
        getMockResponseToolkit()
      )

      expect(SmallCatch.findAll).toHaveBeenCalledWith({
        attributes: ['id'],
        where: { activity_id: 1 },
        transaction
      })
    })

    it('should delete all associated SmallCatchCount records', async () => {
      const smallCatchIds = [1, 2, 3, 4]
      const transaction = getTransaction()
      setUpDeleteSuccess({ smallCatchIds, transaction })

      await deleteSubmissionByIdHandler(
        getDeleteRequest('2'),
        getMockResponseToolkit()
      )

      expect(SmallCatchCount.destroy).toHaveBeenCalledWith({
        where: { small_catch_id: smallCatchIds },
        transaction
      })
    })

    it('should delete all associated SmallCatch records', async () => {
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      await deleteSubmissionByIdHandler(
        getDeleteRequest('2'),
        getMockResponseToolkit()
      )

      expect(SmallCatch.destroy).toHaveBeenCalledWith({
        where: { activity_id: 1 },
        transaction
      })
    })

    it('should delete all associated Catch records', async () => {
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      await deleteSubmissionByIdHandler(
        getDeleteRequest('3'),
        getMockResponseToolkit()
      )

      expect(Catch.destroy).toHaveBeenCalledWith({
        where: { activity_id: 1 },
        transaction
      })
    })

    it('should commit the transaction on successful deletion', async () => {
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      await deleteSubmissionByIdHandler(
        getDeleteRequest('2'),
        getMockResponseToolkit()
      )

      expect(transaction.commit).toHaveBeenCalled()
    })

    it('should return a 204 status code on successful deletion', async () => {
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      const result = await deleteSubmissionByIdHandler(
        getDeleteRequest('3'),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(204)
    })

    it('should return an empty response body on successful deletion', async () => {
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction })

      const result = await deleteSubmissionByIdHandler(
        getDeleteRequest('3'),
        getMockResponseToolkit()
      )

      expect(result.payload).toBeUndefined()
    })

    it('should call handleNotFound if the submission does not exist', async () => {
      const submissionId = 'nonexistent-id'
      const transaction = getTransaction()
      sequelize.transaction.mockResolvedValueOnce(transaction)
      Submission.findOne.mockResolvedValueOnce(null)
      const h = getMockResponseToolkit()

      await deleteSubmissionByIdHandler(getDeleteRequest(submissionId), h)

      expect(handleNotFound).toHaveBeenCalledWith(
        `Submission not found ${submissionId}`,
        h
      )
    })

    it('should rollback the transaction if no submission is deleted', async () => {
      const transaction = getTransaction()
      setUpDeleteSuccess({ transaction, submissionDestroy: 0 })
      const h = getMockResponseToolkit()

      await deleteSubmissionByIdHandler(getDeleteRequest('nonexistent-id'), h)

      expect(transaction.rollback).toHaveBeenCalled()
    })

    it('should call handleServerError if an error occurs during Submission.destroy', async () => {
      const error = new Error('Database error')
      setUpDeleteFailure({
        transaction: getTransaction(),
        error
      })
      const h = getMockResponseToolkit()

      await deleteSubmissionByIdHandler(getDeleteRequest('3'), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error deleting submission',
        error,
        h
      )
    })

    it('should rollback the transaction if an error occurs during deletion', async () => {
      const transaction = getTransaction()
      setUpDeleteFailure({
        transaction
      })
      const h = getMockResponseToolkit()

      await deleteSubmissionByIdHandler(getDeleteRequest('3'), h)

      expect(transaction.rollback).toHaveBeenCalled()
    })

    it('should return SERVER_ERROR_SYMBOL if an error occurs during deletion', async () => {
      const error = new Error('Database error')
      setUpDeleteFailure({
        transaction: getTransaction(),
        error
      })
      const h = getMockResponseToolkit()

      const result = await deleteSubmissionByIdHandler(getDeleteRequest('3'), h)

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })
})
