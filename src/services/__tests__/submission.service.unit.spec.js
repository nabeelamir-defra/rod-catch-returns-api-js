import { Catch, Submission } from '../../entities/index.js'
import {
  getSubmission,
  getSubmissionByCatchId,
  handleCrmActivity,
  isSubmissionExistsById,
  isSubmissionExistsByUserAndSeason
} from '../submissions.service.js'
import { createActivity as createActivityCRM } from '@defra-fish/dynamics-lib'
import { getCreateActivityResponse } from '../../test-utils/test-data.js'
import logger from '../../utils/logger-utils.js'

jest.mock('../../entities/index.js')
jest.mock('../../utils/logger-utils.js')

describe('submission.service.unit', () => {
  describe('isSubmissionExistsById', () => {
    const mockSubmissionId = 'abc123'

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return true if submission exists', async () => {
      Submission.count.mockResolvedValue(1)

      const result = await isSubmissionExistsById(mockSubmissionId)

      expect(result).toBe(true)
    })

    it('should return false if submission does not exist', async () => {
      Submission.count.mockResolvedValue(0)

      const result = await isSubmissionExistsById(mockSubmissionId)

      expect(result).toBe(false)
    })

    it('should handle errors thrown by Submission.count', async () => {
      Submission.count.mockRejectedValue(new Error('Database error'))

      await expect(isSubmissionExistsById(mockSubmissionId)).rejects.toThrow(
        'Database error'
      )
    })
  })

  describe('isSubmissionExistsByUserAndSeason', () => {
    const mockContactId = 'abc123'
    const mockSeason = '2024'

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return true if submission exists', async () => {
      Submission.count.mockResolvedValue(1)

      const result = await isSubmissionExistsByUserAndSeason(
        mockContactId,
        mockSeason
      )

      expect(result).toBe(true)
    })

    it('should return false if submission does not exist', async () => {
      Submission.count.mockResolvedValue(0)

      const result = await isSubmissionExistsByUserAndSeason(
        mockContactId,
        mockSeason
      )

      expect(result).toBe(false)
    })

    it('should handle errors thrown by Submission.count', async () => {
      Submission.count.mockRejectedValue(new Error('Database error'))

      await expect(
        isSubmissionExistsByUserAndSeason(mockContactId, mockSeason)
      ).rejects.toThrow('Database error')
    })
  })

  describe('getSubmission', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return submission if found', async () => {
      const mockSubmission = {
        id: '1',
        contactId: 'contact-identifier-111',
        season: '2024',
        status: 'INCOMPLETE',
        source: 'WEB',
        version: '2024-10-10T13:13:11.000Z',
        reportingExclude: false,
        createdAt: '2024-10-10T13:13:11.000Z',
        updatedAt: '2024-10-10T13:13:11.000Z'
      }
      Submission.findOne.mockResolvedValue(mockSubmission)

      const result = await getSubmission('123')

      expect(result).toEqual({
        id: '1',
        contactId: 'contact-identifier-111',
        season: '2024',
        status: 'INCOMPLETE',
        source: 'WEB',
        version: '2024-10-10T13:13:11.000Z',
        reportingExclude: false,
        createdAt: '2024-10-10T13:13:11.000Z',
        updatedAt: '2024-10-10T13:13:11.000Z'
      })
    })

    it('should return null if submission is not found', async () => {
      Submission.findOne.mockResolvedValue(null)

      const result = await getSubmission('123')

      expect(result).toBeNull()
    })

    it('should handle errors thrown by Submission.findOne', async () => {
      Submission.findOne.mockRejectedValue(new Error('Database error'))

      await expect(getSubmission('123')).rejects.toThrow('Database error')
    })
  })

  describe('getSubmissionByCatchId', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return the submission if the catch with submission exists', async () => {
      Catch.findOne.mockResolvedValue({
        Activity: {
          daysFishedWithMandatoryRelease: 5,
          daysFishedOther: 3,
          river: 'rivers/456',
          Submission: {
            id: '1',
            contactId: 'contact-identifier-111',
            season: '2024',
            status: 'INCOMPLETE',
            source: 'WEB',
            version: '2024-10-10T13:13:11.000Z',
            reportingExclude: false,
            createdAt: '2024-10-10T13:13:11.000Z',
            updatedAt: '2024-10-10T13:13:11.000Z'
          }
        }
      })

      const result = await getSubmissionByCatchId('1')

      expect(result).toStrictEqual({
        id: '1',
        contactId: 'contact-identifier-111',
        season: '2024',
        status: 'INCOMPLETE',
        source: 'WEB',
        version: '2024-10-10T13:13:11.000Z',
        reportingExclude: false,
        createdAt: '2024-10-10T13:13:11.000Z',
        updatedAt: '2024-10-10T13:13:11.000Z'
      })
    })

    it('should throw an error if no catch is found for the catch ID', async () => {
      Catch.findOne.mockResolvedValue(null)

      await expect(getSubmissionByCatchId('2')).rejects.toThrow(
        'Failed to fetch submission for catch ID 2: Error: No Catch found for catch ID 2'
      )
    })

    it('should throw an error if no activity is found for the catch ID', async () => {
      Catch.findOne.mockResolvedValue({})

      await expect(getSubmissionByCatchId('2')).rejects.toThrow(
        'Failed to fetch submission for catch ID 2: Error: No Activity found for catch ID 2'
      )
    })

    it('should throw an error if Catch.findOne fails', async () => {
      Catch.findOne.mockRejectedValue(new Error('Database error'))

      await expect(getSubmissionByCatchId('2')).rejects.toThrow(
        'Failed to fetch submission for catch ID 2: Error: Database error'
      )
    })
  })

  describe('handleCrmActivity', () => {
    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should log info and return the result if the call to create an activity in CRM is successful', async () => {
      const crmResponse = getCreateActivityResponse()
      createActivityCRM.mockResolvedValue(crmResponse)

      const result = await handleCrmActivity('contact-identifier-111', 2024)

      expect(result).toBe(crmResponse)
      expect(logger.info).toHaveBeenCalledWith(
        'Created CRM activity with result:',
        crmResponse
      )
    })

    it('should log an error and return the result when the call to create an activity in CRM returns an ErrorMessage', async () => {
      const crmResponse = {
        '@odata.context':
          'https://dynamics.com/api/data/v9.1/defra_CreateRCRActivityResponse',
        RCRActivityId: null,
        ReturnStatus: 'error',
        SuccessMessage: '',
        ErrorMessage: 'Failed to create activity'
      }
      createActivityCRM.mockResolvedValue(crmResponse)

      const result = await handleCrmActivity('contact-identifier-111', 2024)

      expect(result).toBe(crmResponse)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create activity in CRM for contact-identifier-111',
        'Failed to create activity'
      )
    })

    it('should log info and return the result when the call to create an activity in CRM returns "RCR Activity Already Exists For the Given Contact and Activity Status"', async () => {
      const crmResponse = {
        '@odata.context':
          'https://dynamics.com/api/data/v9.1/defra_CreateRCRActivityResponse',
        RCRActivityId: null,
        ReturnStatus: 'error',
        SuccessMessage: '',
        ErrorMessage:
          'RCR Activity Already Exists For the Given Contact and Activity Status'
      }
      createActivityCRM.mockResolvedValue(crmResponse)

      const result = await handleCrmActivity('contact-identifier-111', 2024)

      expect(result).toBe(crmResponse)
      expect(logger.info).toHaveBeenCalledWith(
        'Failed to create activity in CRM for contact-identifier-111',
        'RCR Activity Already Exists For the Given Contact and Activity Status'
      )
    })

    it('should throw an error when the call to create an activity in CRM returns an error', async () => {
      const error = new Error('CRM')
      createActivityCRM.mockRejectedValueOnce(error)

      await expect(
        handleCrmActivity('contact-identifier-111', 2024)
      ).rejects.toThrow(error)
    })
  })
})
