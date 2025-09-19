import {
  createActivity,
  createSubmission
} from '../../../test-utils/server-test-utils.js'
import {
  createActivity as createActivityCRM,
  updateActivity as updateActivityCRM
} from '@defra-fish/dynamics-lib'
import { Submission } from '../../../entities/index.js'
import { deleteSubmissionAndRelatedData } from '../../../test-utils/database-test-utils.js'
import initialiseServer from '../../server.js'

const createExpectedActivity = (
  id,
  daysFishedWithMandatoryRelease,
  daysFishedOther
) => ({
  id,
  daysFishedWithMandatoryRelease,
  daysFishedOther,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
  version: expect.any(String),
  _links: {
    activity: {
      href: expect.stringMatching(`api/activities/${id}`)
    },
    catches: {
      href: expect.stringMatching(`api/activities/${id}/catches`)
    },
    river: {
      href: expect.stringMatching(`api/activities/${id}/river`)
    },
    self: {
      href: expect.stringMatching(`api/activities/${id}`)
    },
    smallCatches: {
      href: expect.stringMatching(`api/activities/${id}/smallCatches`)
    },
    submission: {
      href: expect.stringMatching(`api/activities/${id}/submission`)
    }
  }
})

describe('submissions.integration', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server = null

  beforeAll(async () => {
    server = await initialiseServer({ port: null })
  })

  afterAll(async () => {
    await server.stop()
  })

  const getCreateActivityResponse = () => ({
    '@odata.context':
      'https://dynamics.com/api/data/v9.1/defra_CreateRCRActivityResponse',
    RCRActivityId: 'abc123',
    ReturnStatus: 'success',
    SuccessMessage: 'RCR Activity - created successfully',
    ErrorMessage: null,
    oDataContext:
      'https://dynamics.com/api/data/v9.1/defra_CreateRCRActivityResponse'
  })

  describe('POST /api/submissions', () => {
    const CONTACT_IDENTIFIER_CREATE_SUBMISSION =
      'contact-identifier-create-submission'
    beforeEach(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION
        }
      })
    })

    afterAll(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION
        }
      })
    })

    it('should successfully create a submission with a valid request', async () => {
      createActivityCRM.mockResolvedValue(getCreateActivityResponse())
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(201)
      expect(JSON.parse(result.payload)).toEqual({
        id: expect.any(String),
        contactId: 'contact-identifier-create-submission',
        season: 2023,
        status: 'INCOMPLETE',
        source: 'WEB',
        reportingExclude: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        version: expect.any(String),
        _links: {
          activities: {
            href: expect.stringMatching(/\/api\/submissions\/\d+\/activities/)
          },
          self: {
            href: expect.stringMatching(/\/api\/submissions\/\d+/)
          },
          submission: {
            href: expect.stringMatching(/\/api\/submissions\/\d+/)
          }
        }
      })
    })

    it('should return a 400 and error message if season is missing', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.payload)).toEqual({
        errors: [
          {
            entity: 'Submission',
            message: 'SUBMISSION_SEASON_REQUIRED',
            property: 'season',
            value: undefined
          }
        ]
      })
    })

    it('should return a 400 and error message season is invalid', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '20ab23',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.payload)).toEqual({
        errors: [
          {
            entity: 'Submission',
            message: 'SUBMISSION_SEASON_INVALID',
            property: 'season',
            value: '20ab23'
          }
        ]
      })
    })

    it('should return a 400 and error message if status is missing', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.payload)).toEqual({
        errors: [
          {
            entity: 'Submission',
            message: 'SUBMISSION_STATUS_REQUIRED',
            property: 'status',
            value: undefined
          }
        ]
      })
    })

    it('should return a 400 and error message status is invalid', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          status: 'INVALID',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.payload)).toEqual({
        errors: [
          {
            entity: 'Submission',
            message: '"status" must be one of [INCOMPLETE, SUBMITTED]',
            property: 'status',
            value: 'INVALID'
          }
        ]
      })
    })

    it('should return a 400 and error message if source is missing', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE'
        }
      })

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.payload)).toEqual({
        errors: [
          {
            entity: 'Submission',
            message: 'SUBMISSION_SOURCE_REQUIRED',
            property: 'source',
            value: undefined
          }
        ]
      })
    })

    it('should return a 400 and error message source is invalid', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'INVALID'
        }
      })

      expect(result.statusCode).toBe(400)
      expect(JSON.parse(result.payload)).toEqual({
        errors: [
          {
            entity: 'Submission',
            message: '"source" must be one of [WEB, PAPER]',
            property: 'source',
            value: 'INVALID'
          }
        ]
      })
    })

    it('should successfully create a Submission when the call to create an activity in CRM returns an ErrorMessage', async () => {
      createActivityCRM.mockResolvedValue({
        '@odata.context':
          'https://dynamics.com/api/data/v9.1/defra_CreateRCRActivityResponse',
        RCRActivityId: null,
        ReturnStatus: 'error',
        SuccessMessage: '',
        ErrorMessage: 'Failed to create activity'
      })
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(201)
    })

    it('should return a 500 when the call to create an activity in CRM throws an error', async () => {
      createActivityCRM.mockRejectedValueOnce(new Error('CRM error'))
      const result = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_CREATE_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      expect(result.statusCode).toBe(500)
    })

    it('should return a 409 and error message if a submission exists with the same contactId and season', async () => {
      // create submission
      await createSubmission(server, CONTACT_IDENTIFIER_CREATE_SUBMISSION)

      // create submission again with the same details
      const result = await createSubmission(
        server,
        CONTACT_IDENTIFIER_CREATE_SUBMISSION
      )

      expect(result.statusCode).toBe(409)
      expect(JSON.parse(result.payload)).toEqual({
        error:
          'Submission already exists for contact=contact-identifier-create-submission and season=2023'
      })
    })
  })

  describe('GET /api/submissions/search/findByContactId?contact_id={contactId}', () => {
    const CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT =
      'contact-identifier-get-submissions-by-contact'

    beforeEach(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT
        }
      })
    })

    afterAll(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT
        }
      })
    })

    it('should successfully get submissions with a valid contactId', async () => {
      await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })
      await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT,
          season: '2024',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/search/findByContactId?contact_id=${CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT}`
      })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.payload)).toEqual({
        _embedded: {
          submissions: [
            {
              id: expect.any(String),
              contactId: CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT,
              season: 2023,
              status: 'INCOMPLETE',
              source: 'WEB',
              reportingExclude: false,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              version: expect.any(String),
              _links: {
                activities: {
                  href: expect.stringMatching(
                    /\/api\/submissions\/\d+\/activities/
                  )
                },
                self: {
                  href: expect.stringMatching(/\/api\/submissions\/\d+/)
                },
                submission: {
                  href: expect.stringMatching(/\/api\/submissions\/\d+/)
                }
              }
            },
            {
              id: expect.any(String),
              contactId: CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT,
              season: 2024,
              status: 'INCOMPLETE',
              source: 'WEB',
              reportingExclude: false,
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              version: expect.any(String),
              _links: {
                activities: {
                  href: expect.stringMatching(
                    /\/api\/submissions\/\d+\/activities/
                  )
                },
                self: {
                  href: expect.stringMatching(/\/api\/submissions\/\d+/)
                },
                submission: {
                  href: expect.stringMatching(/\/api\/submissions\/\d+/)
                }
              }
            }
          ]
        }
      })
    })

    it('should return an empty array if no submissions are found', async () => {
      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/search/findByContactId?contact_id=${CONTACT_IDENTIFIER_GET_SUBMISSIONS_BY_CONTACT}`
      })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.payload)).toEqual({
        _embedded: {
          submissions: []
        }
      })
    })

    it('should return an empty array if no submissions are found for a contact id that does not exist', async () => {
      const result = await server.inject({
        method: 'GET',
        url: '/api/submissions/search/findByContactId?contact_id=0'
      })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.payload)).toEqual({
        _embedded: {
          submissions: []
        }
      })
    })
  })

  describe('GET /api/submissions/search/getByContactIdAndSeason?contact_id={contactId}&season={season}', () => {
    const CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON =
      'contact-identifier-get-submission-by-contact-and-season'

    beforeEach(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON
        }
      })
    })

    afterAll(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON
        }
      })
    })

    it('should successfully get as submission with a valid contactId and season', async () => {
      await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/search/getByContactIdAndSeason?contact_id=${CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON}&season=2023`
      })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.payload)).toEqual({
        id: expect.any(String),
        contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON,
        season: 2023,
        status: 'INCOMPLETE',
        source: 'WEB',
        reportingExclude: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        version: expect.any(String),
        _links: {
          activities: {
            href: expect.stringMatching(/\/api\/submissions\/\d+\/activities/)
          },
          self: {
            href: expect.stringMatching(/\/api\/submissions\/\d+/)
          },
          submission: {
            href: expect.stringMatching(/\/api\/submissions\/\d+/)
          }
        }
      })
    })

    it('should return a 404 and an empty body if the contactId does not exist', async () => {
      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/search/getByContactIdAndSeason?contact_id=contact-identifier-unknown&season=2023`
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })

    it('should return a 404 and an empty body if the contact exists, but the season does not exist', async () => {
      await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/search/getByContactIdAndSeason?contact_id=${CONTACT_IDENTIFIER_GET_SUBMISSION_BY_CONTACT_AND_SEASON}&season=2022`
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })
  })

  describe('GET /api/submissions/{submissionId}', () => {
    const CONTACT_IDENTIFIER_GET_SUBMISSION_BY_ID =
      'contact-identifier-get-submission-by-id'

    beforeEach(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_ID
        }
      })
    })

    afterAll(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_ID
        }
      })
    })

    it('should successfully get a submission with a valid id', async () => {
      const createdSubmission = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_ID,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      const submissionId = JSON.parse(createdSubmission.payload).id

      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/${submissionId}`
      })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.payload)).toEqual({
        id: expect.any(String),
        contactId: CONTACT_IDENTIFIER_GET_SUBMISSION_BY_ID,
        season: 2023,
        status: 'INCOMPLETE',
        source: 'WEB',
        reportingExclude: false,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        version: expect.any(String),
        _links: {
          activities: {
            href: expect.stringMatching(
              `api/submissions/${submissionId}/activities`
            )
          },
          self: {
            href: expect.stringMatching(`api/submissions/${submissionId}`)
          },
          submission: {
            href: expect.stringMatching(`api/submissions/${submissionId}`)
          }
        }
      })
    })

    it('should return a 404 and an empty body if the submission does not exist', async () => {
      const result = await server.inject({
        method: 'GET',
        url: '/api/submissions/0'
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })
  })

  describe('GET /api/submissions/{submissionId}/activites', () => {
    const CONTACT_IDENTIFIER_GET_ACTIVITIES_FOR_SUBMISSION =
      'contact-identifier-get-activities-for-submission'

    beforeEach(() =>
      deleteSubmissionAndRelatedData(
        CONTACT_IDENTIFIER_GET_ACTIVITIES_FOR_SUBMISSION
      )
    )

    afterAll(() =>
      deleteSubmissionAndRelatedData(
        CONTACT_IDENTIFIER_GET_ACTIVITIES_FOR_SUBMISSION
      )
    )
    it('should successfully get all activivities for a submission with a valid submission id', async () => {
      // create a submission
      const createdSubmission = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_ACTIVITIES_FOR_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })

      const submissionId = JSON.parse(createdSubmission.payload).id

      // add 2 activities with different rivers
      const createdActivity1 = await createActivity(server, submissionId)
      const createdActivity1Id = JSON.parse(createdActivity1.payload).id

      const createdActivity2 = await createActivity(server, submissionId, {
        river: 'rivers/5',
        daysFishedWithMandatoryRelease: 5,
        daysFishedOther: 3
      })
      const createdActivity2Id = JSON.parse(createdActivity2.payload).id

      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/${submissionId}/activities`,
        payload: {
          submission: `submissions/${submissionId}`,
          daysFishedWithMandatoryRelease: '5',
          daysFishedOther: '3',
          river: 'rivers/1'
        }
      })

      expect(result.statusCode).toBe(200)
      const activities = JSON.parse(result.payload)._embedded.activities
      expect(activities).toEqual(
        expect.arrayContaining([
          createExpectedActivity(createdActivity1Id, 20, 10),
          createExpectedActivity(createdActivity2Id, 5, 3)
        ])
      )
    })

    it('should return a 404 and an empty body if the submission does not exist', async () => {
      const result = await server.inject({
        method: 'GET',
        url: '/api/submissions/0/activities'
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })

    it('should return a 200 and with an empty activity array if the submission exists, but has not activities', async () => {
      const createdSubmission = await server.inject({
        method: 'POST',
        url: '/api/submissions',
        payload: {
          contactId: CONTACT_IDENTIFIER_GET_ACTIVITIES_FOR_SUBMISSION,
          season: '2023',
          status: 'INCOMPLETE',
          source: 'WEB'
        }
      })
      const submissionId = JSON.parse(createdSubmission.payload).id

      const result = await server.inject({
        method: 'GET',
        url: `/api/submissions/${submissionId}/activities`
      })

      expect(result.statusCode).toBe(200)
      expect(JSON.parse(result.payload)).toStrictEqual({
        _embedded: {
          activities: []
        }
      })
    })
  })

  describe('PATCH /api/submissions/{submissionId}', () => {
    const CONTACT_IDENTIFIER_UPDATE_SUBMISSION =
      'contact-identifier-update-submission'

    const getUpdateActivityResponse = () => ({
      '@odata.context':
        'https://dynamics.om/api/data/v9.1/defra_UpdateRCRActivityResponse',
      ReturnStatus: 'success',
      SuccessMessage: 'RCR Activity - updated successfully',
      ErrorMessage: null,
      oDataContext:
        'https://dynamics.com/api/data/v9.1/defra_UpdateRCRActivityResponse'
    })

    beforeEach(async () => {
      createActivityCRM.mockResolvedValue(getCreateActivityResponse())
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_UPDATE_SUBMISSION
        }
      })
    })

    afterAll(async () => {
      await Submission.destroy({
        where: {
          contactId: CONTACT_IDENTIFIER_UPDATE_SUBMISSION
        }
      })
    })

    it('should successfully update a submission with a valid status', async () => {
      updateActivityCRM.mockResolvedValue(getUpdateActivityResponse())
      const createdSubmission = await createSubmission(
        server,
        CONTACT_IDENTIFIER_UPDATE_SUBMISSION
      )
      const submissionId = JSON.parse(createdSubmission.payload).id
      expect(JSON.parse(createdSubmission.payload).status).toBe('INCOMPLETE')

      const updatedSubmission = await server.inject({
        method: 'PATCH',
        url: `/api/submissions/${submissionId}`,
        payload: {
          status: 'SUBMITTED'
        }
      })

      expect(JSON.parse(updatedSubmission.payload).status).toBe('SUBMITTED')
      expect(updatedSubmission.statusCode).toBe(200)
    })

    it('should successfully update a submission when reportingExclude is true', async () => {
      const createdSubmission = await createSubmission(
        server,
        CONTACT_IDENTIFIER_UPDATE_SUBMISSION
      )
      const submissionId = JSON.parse(createdSubmission.payload).id
      expect(JSON.parse(createdSubmission.payload).reportingExclude).toBeFalsy()

      const updatedSubmission = await server.inject({
        method: 'PATCH',
        url: `/api/submissions/${submissionId}`,
        payload: {
          reportingExclude: true
        }
      })

      expect(
        JSON.parse(updatedSubmission.payload).reportingExclude
      ).toBeTruthy()
      expect(updatedSubmission.statusCode).toBe(200)
    })

    it('should not update a field that is not updateable, but still return a 200 and the original submission', async () => {
      const createdSubmission = await createSubmission(
        server,
        CONTACT_IDENTIFIER_UPDATE_SUBMISSION
      )
      const submissionId = JSON.parse(createdSubmission.payload).id
      expect(JSON.parse(createdSubmission.payload).season).toBe(2023)

      const updatedSubmission = await server.inject({
        method: 'PATCH',
        url: `/api/submissions/${submissionId}`,
        payload: {
          season: 2024
        }
      })

      expect(JSON.parse(updatedSubmission.payload).season).toBe(2023)
      expect(updatedSubmission.statusCode).toBe(200)
    })

    it('should return a 404 and an empty body if the submission does not exist', async () => {
      const updatedSubmission = await server.inject({
        method: 'PATCH',
        url: '/api/submissions/0',
        payload: {
          status: 'SUBMITTED'
        }
      })

      expect(updatedSubmission.payload).toBe('')
      expect(updatedSubmission.statusCode).toBe(404)
    })

    it('should successfully update a Submission when the call to update an activity in CRM returns an ErrorMessage', async () => {
      updateActivityCRM.mockResolvedValue({
        '@odata.context':
          'https://dynamics.om/api/data/v9.1/defra_UpdateRCRActivityResponse',
        RCRActivityId: null,
        ReturnStatus: 'error',
        SuccessMessage: '',
        ErrorMessage: 'Failed to update activity',
        oDataContext:
          'https://dynamics.com/api/data/v9.1/defra_UpdateRCRActivityResponse'
      })
      const createdSubmission = await createSubmission(
        server,
        CONTACT_IDENTIFIER_UPDATE_SUBMISSION
      )
      const submissionId = JSON.parse(createdSubmission.payload).id
      expect(JSON.parse(createdSubmission.payload).season).toBe(2023)

      const result = await server.inject({
        method: 'PATCH',
        url: `/api/submissions/${submissionId}`,
        payload: {
          status: 'SUBMITTED'
        }
      })

      expect(result.statusCode).toBe(200)
    })

    it('should return a 500 when the call to create an activity in CRM throws an error', async () => {
      updateActivityCRM.mockRejectedValueOnce(new Error('CRM error'))

      const createdSubmission = await createSubmission(
        server,
        CONTACT_IDENTIFIER_UPDATE_SUBMISSION
      )
      const submissionId = JSON.parse(createdSubmission.payload).id

      const result = await server.inject({
        method: 'PATCH',
        url: `/api/submissions/${submissionId}`,
        payload: {
          status: 'SUBMITTED'
        }
      })

      expect(JSON.parse(result.payload)).toStrictEqual({
        error: 'Error updating submission'
      })
      expect(result.statusCode).toBe(500)
    })
  })

  describe('DELETE /api/submission/{submissionId}', () => {
    const CONTACT_IDENTIFIER_DELETE_SUBMISSION =
      'contact-identifier-delete-submission'
    beforeEach(
      async () =>
        await deleteSubmissionAndRelatedData(
          CONTACT_IDENTIFIER_DELETE_SUBMISSION
        )
    )

    afterAll(
      async () =>
        await deleteSubmissionAndRelatedData(
          CONTACT_IDENTIFIER_DELETE_SUBMISSION
        )
    )

    it('should return a 204 and delete an activity', async () => {
      createActivityCRM.mockResolvedValue(getCreateActivityResponse())
      const submission = await createSubmission(
        server,
        CONTACT_IDENTIFIER_DELETE_SUBMISSION
      )
      const submissionId = JSON.parse(submission.payload).id
      await createActivity(server, submissionId)

      // make sure submission exists
      const foundSubmission = await server.inject({
        method: 'GET',
        url: `/api/submissions/${submissionId}`
      })
      expect(foundSubmission.statusCode).toBe(200)

      // delete submission
      const deletedSubmission = await server.inject({
        method: 'DELETE',
        url: `/api/submissions/${submissionId}`
      })
      expect(deletedSubmission.statusCode).toBe(204)
      expect(deletedSubmission.body).toBeUndefined()

      // make sure submission has been deleted
      const foundSubmissionAfterDelete = await server.inject({
        method: 'GET',
        url: `/api/submissions/${submissionId}`
      })
      expect(foundSubmissionAfterDelete.statusCode).toBe(404)
    })

    it('should return a 404 and empty body if the submission could not be deleted', async () => {
      const result = await server.inject({
        method: 'DELETE',
        url: '/api/submissions/0'
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })
  })
})
