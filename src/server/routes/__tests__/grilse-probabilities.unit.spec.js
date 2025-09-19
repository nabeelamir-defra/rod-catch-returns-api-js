import {
  deleteGrilseProbabilitiesForSeasonAndGate,
  generateCsvFromGrilseProbabilities,
  getGrilseProbabilitiesBySeasonRange,
  isGrilseProbabilityExistsForSeasonAndGate,
  processGrilseProbabilities,
  validateAndParseCsvFile
} from '../../../services/grilse-probabilities.service.js'
import {
  getMockResponseToolkit,
  getServerDetails
} from '../../../test-utils/server-test-utils.js'
import {
  handleNotFound,
  handleServerError
} from '../../../utils/server-utils.js'
import { GrilseProbability } from '../../../entities/index.js'
import { GrilseValidationError } from '../../../models/grilse-validation-error.model.js'

import routes from '../grilse-probabilities.js'

jest.mock('../../../services/grilse-probabilities.service.js')
jest.mock('../../../entities/index.js')
jest.mock('../../../utils/logger-utils.js')
jest.mock('../../../utils/server-utils.js')

const [
  {
    options: { handler: getAllGrilseProbabilitiesHandler }
  },
  {
    options: { handler: deleteGrilseProbabilityByIdHandler }
  },
  {
    options: { handler: uploadGrilseProbabilitiesHandler }
  },
  {
    options: { handler: getGrilseProbabilitiesHandler }
  }
] = routes

const NOT_FOUND_SYMBOL = Symbol('NOT_FOUND')
const SERVER_ERROR_SYMBOL = Symbol('SERVER_ERROR')

handleNotFound.mockReturnValue(NOT_FOUND_SYMBOL)
handleServerError.mockReturnValue(SERVER_ERROR_SYMBOL)

describe('grilse-probabilities.unit', () => {
  describe('GET /grilseProbabilities', () => {
    const getGrilseProbabilitiesData = () => [
      {
        id: '2',
        season: 2025,
        month: 4,
        massInPounds: 6,
        probability: '1.0000000000000000',
        createdAt: '2025-09-01T08:57:34.479Z',
        updatedAt: '2025-09-01T08:57:34.479Z',
        version: '2025-09-01T08:57:34.479Z',
        gate_id: '2'
      },
      {
        id: '2',
        season: 2025,
        month: 5,
        massInPounds: 6,
        probability: '0.9920000000000000',
        createdAt: '2025-09-01T08:57:34.479Z',
        updatedAt: '2025-09-01T08:57:34.479Z',
        version: '2025-09-01T08:57:34.479Z',
        gate_id: '2'
      }
    ]

    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return a 200 status code and the species if the call to fetch all species is successful', async () => {
      GrilseProbability.findAll.mockResolvedValueOnce(
        getGrilseProbabilitiesData()
      )

      const result = await getAllGrilseProbabilitiesHandler(
        getServerDetails(),
        getMockResponseToolkit()
      )

      expect(result.payload).toMatchSnapshot()
      expect(result.statusCode).toBe(200)
    })

    it('should call handleServerError if an error occurs while fetching species', async () => {
      const error = new Error('Database error')
      GrilseProbability.findAll.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await getAllGrilseProbabilitiesHandler(getServerDetails(), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error fetching grilse probabilities',
        error,
        h
      )
    })

    it('should return an error response if an error occurs while fetching species', async () => {
      const error = new Error('Database error')
      GrilseProbability.findAll.mockRejectedValueOnce(error)

      const result = await getAllGrilseProbabilitiesHandler(
        getServerDetails(),
        getMockResponseToolkit()
      )

      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })

  describe('DELETE /grilseProbabilities/{grilseProbabilityId}', () => {
    const getDeleteRequest = (grilseProbabilityId) =>
      getServerDetails({ params: { grilseProbabilityId } })

    it('should return a 204 status code on successful deletion', async () => {
      GrilseProbability.destroy.mockResolvedValueOnce(1)

      const result = await deleteGrilseProbabilityByIdHandler(
        getDeleteRequest('3'),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(204)
    })

    it('should return an empty response on successful deletion', async () => {
      GrilseProbability.destroy.mockResolvedValueOnce(1)

      const result = await deleteGrilseProbabilityByIdHandler(
        getDeleteRequest('3'),
        getMockResponseToolkit()
      )

      expect(result.payload).toBeUndefined()
    })

    it('should call GrilseProbability.destroy with the correct parameters', async () => {
      const grilseProbabilityId = '3'
      GrilseProbability.destroy.mockResolvedValueOnce(1)

      await deleteGrilseProbabilityByIdHandler(
        getDeleteRequest(grilseProbabilityId),
        getMockResponseToolkit()
      )

      expect(GrilseProbability.destroy).toHaveBeenCalledWith({
        where: { id: grilseProbabilityId }
      })
    })

    it('should return a 404 status code if the GrilseProbability does not exist', async () => {
      GrilseProbability.destroy.mockResolvedValueOnce(0)

      const result = await deleteGrilseProbabilityByIdHandler(
        getDeleteRequest('3'),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(404)
    })

    it('should call handleServerError if an error occurs during GrilseProbability.destroy', async () => {
      const error = new Error('Database error')

      GrilseProbability.destroy.mockRejectedValueOnce(error)
      const h = getMockResponseToolkit()

      await deleteGrilseProbabilityByIdHandler(getDeleteRequest('3'), h)

      expect(handleServerError).toHaveBeenCalledWith(
        'Error deleting grilse probability',
        error,
        h
      )
    })
  })

  describe('POST /reporting/reference/grilse-probabilities/{season}/{gate}', () => {
    const mockCsvData = 'Weight,January,February\n10,0.2,0.3\n15,0.5,0.6'
    const getMockRequest = ({
      season = '2024',
      gate = '1',
      overwrite = false
    } = {}) => ({
      params: { season, gate },
      query: { overwrite },
      payload: Buffer.from(mockCsvData)
    })

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return 201 amd create the records when the CSV is processed successfully', async () => {
      isGrilseProbabilityExistsForSeasonAndGate.mockResolvedValueOnce(false)
      validateAndParseCsvFile.mockResolvedValueOnce([
        ['Weight', 'June'],
        ['1', '1.0'],
        ['2', '1.0']
      ])
      processGrilseProbabilities.mockReturnValueOnce([
        {
          season: '2024',
          gate_id: '1',
          massInPounds: 10,
          probability: 0.2,
          version: new Date()
        }
      ])
      GrilseProbability.bulkCreate.mockResolvedValueOnce()

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(201)
      expect(GrilseProbability.bulkCreate).toHaveBeenCalled()
    })

    it('should return 409 and an error message if existing data is found and overwrite is not set', async () => {
      isGrilseProbabilityExistsForSeasonAndGate.mockResolvedValueOnce(true)

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest({ overwrite: false })),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(409)
      expect(result.payload).toStrictEqual({
        message:
          'Existing data found for the given season and gate but overwrite parameter not set'
      })
    })

    it('should delete existing data and create new if overwrite is set to true', async () => {
      isGrilseProbabilityExistsForSeasonAndGate.mockResolvedValueOnce(true)

      validateAndParseCsvFile.mockResolvedValueOnce([
        ['Weight', 'June'],
        ['1', '1.0'],
        ['2', '1.0']
      ])
      processGrilseProbabilities.mockReturnValueOnce([
        {
          season: '2024',
          gate_id: '1',
          massInPounds: 10,
          probability: 0.2,
          version: new Date()
        }
      ])
      GrilseProbability.bulkCreate.mockResolvedValueOnce()

      await uploadGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest({ overwrite: true })),
        getMockResponseToolkit()
      )

      expect(deleteGrilseProbabilitiesForSeasonAndGate).toHaveBeenCalledWith(
        '2024',
        '1'
      )
      expect(GrilseProbability.bulkCreate).toHaveBeenCalled()
    })

    it('should return a 201 and not create any records if there are no valid probabilities', async () => {
      isGrilseProbabilityExistsForSeasonAndGate.mockResolvedValueOnce(false)
      validateAndParseCsvFile.mockResolvedValueOnce([
        ['Weight', 'June'],
        ['1', '1.0'],
        ['2', '1.0']
      ])
      processGrilseProbabilities.mockReturnValueOnce([])

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        getMockResponseToolkit()
      )

      expect(result.statusCode).toBe(201)
      expect(GrilseProbability.bulkCreate).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully and return server error response', async () => {
      const error = new Error('Database error')
      isGrilseProbabilityExistsForSeasonAndGate.mockRejectedValueOnce(error)

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        getMockResponseToolkit()
      )

      expect(handleServerError).toHaveBeenCalledWith(
        'Error uploading grilse probabilities file',
        error,
        expect.anything()
      )
      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })

    it('should return a 400 error if validation fails', async () => {
      validateAndParseCsvFile.mockImplementation(() => {
        throw new GrilseValidationError({ status: 400 })
      })
      const request = {
        params: { season: '2023', gate: '1' },
        query: { overwrite: 'true' },
        payload: { invalid: 'object' } // Object payload
      }

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(request),
        getMockResponseToolkit()
      )
      expect(result.statusCode).toBe(400)
    })

    it('should return an error response with timestamp, message and path if validation fails', async () => {
      validateAndParseCsvFile.mockImplementation(() => {
        throw new GrilseValidationError()
      })
      const request = {
        params: { season: '2023', gate: '1' },
        query: { overwrite: 'true' },
        payload: { invalid: 'object' } // Object payload
      }

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(request),
        getMockResponseToolkit()
      )
      expect(result.payload).toStrictEqual({
        timestamp: expect.any(String),
        status: 400,
        message: 'Validation error',
        path: undefined
      })
    })

    it('should return an error field, if it is returned by GrilseValidationError', async () => {
      validateAndParseCsvFile.mockImplementation(() => {
        throw new GrilseValidationError({
          status: 400,
          error: 'This is an error'
        })
      })
      const request = {
        params: { season: '2023', gate: '1' },
        query: { overwrite: 'true' },
        payload: { invalid: 'object' } // Object payload
      }

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(request),
        getMockResponseToolkit()
      )
      expect(result.payload).toStrictEqual(
        expect.objectContaining({
          error: 'This is an error'
        })
      )
    })

    it('should return an errors array, if it is returned by GrilseValidationError', async () => {
      validateAndParseCsvFile.mockImplementation(() => {
        throw new GrilseValidationError({
          status: 400,
          errors: ['this is an error']
        })
      })
      const request = {
        params: { season: '2023', gate: '1' },
        query: { overwrite: 'true' },
        payload: { invalid: 'object' } // Object payload
      }

      const result = await uploadGrilseProbabilitiesHandler(
        getServerDetails(request),
        getMockResponseToolkit()
      )
      expect(result.payload).toStrictEqual(
        expect.objectContaining({
          errors: ['this is an error']
        })
      )
    })
  })

  describe('GET /reporting/reference/grilse-probabilities/{season}', () => {
    const getMockRequest = (season = '2024') => ({
      params: { season }
    })

    const getMockTypeHeaderResponseToolkit = () => {
      const headers = {}

      const code = (statusCode, payload) => {
        return { statusCode, headers, payload }
      }

      const header = (name, value, payload) => {
        headers[name.toLowerCase()] = value
        return { code: (statusCode) => code(statusCode, payload) }
      }

      return {
        response: jest.fn().mockImplementation((payload) => {
          return {
            type: (contentType) => {
              headers['content-type'] = contentType
              return { header: (name, value) => header(name, value, payload) }
            },
            header: (name, value) => {
              headers[name.toLowerCase()] = value
              return { code: (statusCode) => code(statusCode, payload) }
            },
            code: (statusCode) => {
              return { statusCode, headers, payload }
            }
          }
        })
      }
    }

    const getMockCsvData = () => 'Weight,January\n10,0.2\n15,0.5'

    const getMockGrilseProbabilities = () => [
      { season: 2024, gate_id: '1', massInPounds: 10, probability: 0.2 },
      { season: 2024, gate_id: '1', massInPounds: 15, probability: 0.5 }
    ]

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it('should return 200 and a CSV file when records are found', async () => {
      const mockCsvData = getMockCsvData()
      getGrilseProbabilitiesBySeasonRange.mockResolvedValueOnce(
        getMockGrilseProbabilities()
      )
      generateCsvFromGrilseProbabilities.mockReturnValueOnce(mockCsvData)

      const result = await getGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        getMockTypeHeaderResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
      expect(result.payload).toBe(mockCsvData)
      expect(result.headers['content-type']).toBe('text/csv')
      expect(result.headers['content-disposition']).toBe(
        'attachment; filename="grilse-probabilities-2024.csv"'
      )
    })

    it('should return the correct headers when records are found', async () => {
      const mockCsvData = getMockCsvData()
      getGrilseProbabilitiesBySeasonRange.mockResolvedValueOnce(
        getMockGrilseProbabilities()
      )
      generateCsvFromGrilseProbabilities.mockReturnValueOnce(mockCsvData)

      const result = await getGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        getMockTypeHeaderResponseToolkit()
      )

      expect(result.headers['content-type']).toBe('text/csv')
      expect(result.headers['content-disposition']).toBe(
        'attachment; filename="grilse-probabilities-2024.csv"'
      )
    })

    it('should return 404 when no grilse probabilities are found', async () => {
      getGrilseProbabilitiesBySeasonRange.mockResolvedValueOnce([])
      const h = getMockTypeHeaderResponseToolkit()

      const result = await getGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        h
      )

      expect(handleNotFound).toHaveBeenCalledWith(
        'Grilse probabilities not found for 2024',
        h
      )
      expect(result).toBe(NOT_FOUND_SYMBOL)
    })

    it('should correctly handle a single season', async () => {
      getGrilseProbabilitiesBySeasonRange.mockResolvedValueOnce(
        getMockGrilseProbabilities()
      )
      generateCsvFromGrilseProbabilities.mockReturnValueOnce(getMockCsvData())

      const result = await getGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest('2024')),
        getMockTypeHeaderResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
      expect(getGrilseProbabilitiesBySeasonRange).toHaveBeenCalledWith(
        2024,
        2024
      )
    })

    it('should correctly handle a season range', async () => {
      getGrilseProbabilitiesBySeasonRange.mockResolvedValueOnce(
        getMockGrilseProbabilities()
      )
      generateCsvFromGrilseProbabilities.mockReturnValueOnce(getMockCsvData())

      const result = await getGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest('2023-2024')),
        getMockTypeHeaderResponseToolkit()
      )

      expect(result.statusCode).toBe(200)
      expect(getGrilseProbabilitiesBySeasonRange).toHaveBeenCalledWith(
        2023,
        2024
      )
    })

    it('should handle errors gracefully and return a server error response', async () => {
      const error = new Error('Database error')
      getGrilseProbabilitiesBySeasonRange.mockRejectedValueOnce(error)

      const result = await getGrilseProbabilitiesHandler(
        getServerDetails(getMockRequest()),
        getMockTypeHeaderResponseToolkit()
      )

      expect(handleServerError).toHaveBeenCalledWith(
        'Error retrieving grilse probabilities file',
        error,
        expect.anything()
      )
      expect(result).toBe(SERVER_ERROR_SYMBOL)
    })
  })
})
