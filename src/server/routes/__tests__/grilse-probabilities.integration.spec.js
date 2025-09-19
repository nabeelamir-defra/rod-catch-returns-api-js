import { GrilseProbability } from '../../../entities/index.js'
import fs from 'fs'
import initialiseServer from '../../server.js'
import path from 'path'

describe('grilse-probabilities.integration', () => {
  /** @type {import('@hapi/hapi').Server} */
  let server = null

  beforeAll(async () => {
    server = await initialiseServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  const deleteAllGrilseProbabilities = () => {
    return GrilseProbability.truncate()
  }

  const loadFixture = (fileName) => {
    const filePath = path.join(__dirname, '__fixtures__', fileName)
    const fileBuffer = fs.readFileSync(filePath)
    return fileBuffer
  }

  const uploadFile = (server, url, payload) => {
    return server.inject({
      method: 'POST',
      url,
      headers: {
        'Content-Type': 'text/csv'
      },
      payload
    })
  }

  describe('GET /api/grilseProbabilities', () => {
    beforeEach(async () => {
      await deleteAllGrilseProbabilities()
    })

    const expectedGrilseProbability = (massInPounds, month, probability) => ({
      id: expect.any(String),
      massInPounds,
      month,
      probability,
      season: 2024,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      _links: {
        self: {
          href: expect.stringMatching(/\/api\/grilseProbabilities\/\d+$/)
        },
        grilseProbability: {
          href: expect.stringMatching(/\/api\/grilseProbabilities\/\d+$/)
        },
        gate: {
          href: expect.stringMatching(/\/api\/grilseProbabilities\/\d+\/gate$/)
        }
      }
    })

    it('should return all grilseProbabilities', async () => {
      // Upload grilse probabilities file
      const fileBuffer = loadFixture('valid-grilse-data-1-datapoint.csv')
      const fileUploadresult = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1',
        fileBuffer
      )
      expect(fileUploadresult.statusCode).toBe(201)

      // ensure they are all returned
      const result = await server.inject({
        method: 'GET',
        url: '/api/grilseProbabilities'
      })

      expect(result.statusCode).toBe(200)

      expect(JSON.parse(result.payload)._embedded.grilseProbabilities).toEqual(
        expect.arrayContaining([
          expectedGrilseProbability(1, 8, '0.2440000000000000'),
          expectedGrilseProbability(1, 9, '0.6670000000000000'),
          expectedGrilseProbability(1, 10, '1.0000000000000000'),
          expectedGrilseProbability(1, 11, '0.1430000000000000'),
          expectedGrilseProbability(1, 12, '0.6670000000000000')
        ])
      )
    })
  })

  describe('DELETE /api/grilseProbabilities/{grilseProbabilityId}', () => {
    beforeEach(async () => {
      await deleteAllGrilseProbabilities()
    })

    it('should return a 204 status code if the GrilseProbability is deleted', async () => {
      // Upload grilse probabilities file
      const fileBuffer = loadFixture('valid-grilse-data-1-datapoint.csv')
      const fileUploadresult = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1',
        fileBuffer
      )
      expect(fileUploadresult.statusCode).toBe(201)

      // ensure they are all returned
      const result = await server.inject({
        method: 'GET',
        url: '/api/grilseProbabilities'
      })

      // get the first grilseProbability in the list
      const grilseProbabilityToDelete = JSON.parse(result.payload)._embedded
        .grilseProbabilities[0]

      const deletedGrilseProbability = await server.inject({
        method: 'DELETE',
        url: `/api/grilseProbabilities/${grilseProbabilityToDelete.id}`
      })

      expect(deletedGrilseProbability.statusCode).toBe(204)
      expect(deletedGrilseProbability.payload.length).toBe(0)
    })

    it('should return a 404 status code if the GrilseProbability does not exist', async () => {
      const result = await server.inject({
        method: 'DELETE',
        url: '/api/grilseProbabilities/0'
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload.length).toBe(0)
    })
  })

  describe('POST /api/reporting/reference/grilse-probabilities/{season}/{gate}', () => {
    beforeEach(async () => {
      await deleteAllGrilseProbabilities()
    })

    it('should return 201 if the csv file is uploaded successfully', async () => {
      const fileBuffer = loadFixture('valid-grilse-data-69-datapoints.csv')

      const result = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1',
        fileBuffer
      )

      expect(result.statusCode).toBe(201)
      expect(result.payload).toBe('')

      // check probabilities have uploaded successfully
      const getResult = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2024'
      })
      expect(getResult.payload).toMatchSnapshot()
    })

    it('should return 201 if the csv contains missing probabilities (should treat them as 0)', async () => {
      const fileBuffer = loadFixture(
        'missing-probabilities-treated-as-zeros.csv'
      )

      const result = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1',
        fileBuffer
      )

      expect(result.statusCode).toBe(201)

      // check probabilities have uploaded successfully
      const getResult = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2024'
      })
      expect(getResult.payload).toMatchSnapshot()
    })

    it('should return an error if an object is passed in instead of a file', async () => {
      const result = await server.inject({
        method: 'POST',
        url: '/api/reporting/reference/grilse-probabilities/2024/1',
        payload: { test: 'test' }
      })

      expect(JSON.parse(result.payload)).toStrictEqual({
        message: '400 BAD_REQUEST "Invalid CSV data"',
        errors: [{ errorType: 'FILE_EMPTY' }],
        path: '/api/reporting/reference/grilse-probabilities/2024/1',
        status: 400,
        timestamp: expect.any(String)
      })
      expect(result.statusCode).toBe(400)
    })

    it('should return an error if the data already exists in the database and ovewrite is false', async () => {
      const fileBuffer = loadFixture('valid-grilse-data-69-datapoints.csv')

      const resultSuccess = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1?overwrite=false',
        fileBuffer
      )
      expect(resultSuccess.statusCode).toBe(201)

      const resultError = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1?overwrite=false',
        fileBuffer
      )
      expect(resultError.statusCode).toBe(409)
      expect(JSON.parse(resultError.payload)).toStrictEqual({
        message:
          'Existing data found for the given season and gate but overwrite parameter not set'
      })
    })

    it('should return 201 if the data has already been uploaded and overwrite is true', async () => {
      const fileBuffer = loadFixture('valid-grilse-data-69-datapoints.csv')

      const result = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1',
        fileBuffer
      )
      expect(result.statusCode).toBe(201)

      const resultOverwrite = await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1?overwrite=true',
        fileBuffer
      )
      expect(resultOverwrite.statusCode).toBe(201)

      // check probabilities have uploaded successfully
      const getResult = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2024'
      })
      expect(getResult.payload).toMatchSnapshot()
    })

    it.each([['empty.csv'], ['empty-line.csv']])(
      'should return an error if an %s is passed in',
      async (fileName) => {
        const fileBuffer = loadFixture(fileName)

        const result = await uploadFile(
          server,
          '/api/reporting/reference/grilse-probabilities/2024/1',
          fileBuffer
        )

        expect(JSON.parse(result.payload)).toStrictEqual({
          message: '400 BAD_REQUEST "Invalid CSV data"',
          errors: [{ errorType: 'FILE_EMPTY' }],
          path: '/api/reporting/reference/grilse-probabilities/2024/1',
          status: 400,
          timestamp: expect.any(String)
        })
        expect(result.statusCode).toBe(400)
      }
    )

    it.each([
      [
        'invalid column',
        'invalid-headers.csv',
        [{ errorType: 'COLUMN_DISALLOWED', row: 1, col: 9 }]
      ],
      [
        'duplicate columns',
        'duplicate-headers.csv',
        [
          { errorType: 'DUPLICATE_HEADERS', row: 1, col: 3 },
          { errorType: 'DUPLICATE_HEADERS', row: 1, col: 6 }
        ]
      ],
      [
        'missing weight column',
        'no-weight-heading.csv',
        [{ errorType: 'MISSING_WEIGHT_HEADER', row: 1, col: 1 }]
      ],
      [
        'missing months',
        'no-month-headings.csv',
        [{ errorType: 'MISSING_MONTH_HEADER', row: 1, col: 1 }]
      ],
      [
        'a row which does not have the same number of fields as the headings',
        'wrong-number-of-data-on-row.csv',
        [
          { errorType: 'ROW_HEADER_DISCREPANCY', row: 4, col: 8 },
          { errorType: 'ROW_HEADER_DISCREPANCY', row: 5, col: 9 }
        ]
      ],
      [
        'a weight that is not a whole number',
        'weight-not-whole-number.csv',
        [
          { errorType: 'NOT_WHOLE_NUMBER', row: 3, col: 1 },
          { errorType: 'NOT_WHOLE_NUMBER', row: 4, col: 1 }
        ]
      ],
      [
        'a weight that has been duplicated',
        'duplicate-weight.csv',
        [
          { errorType: 'DUPLICATE_WEIGHT', row: 4, col: 1 },
          { errorType: 'DUPLICATE_WEIGHT', row: 5, col: 1 }
        ]
      ],
      [
        'probabilities not between 0 and 1',
        'probability-not-between-0-and-1.csv',
        [
          { errorType: 'INVALID_PROBABILITY', row: 3, col: 2 },
          { errorType: 'INVALID_PROBABILITY', row: 4, col: 2 },
          { errorType: 'INVALID_PROBABILITY', row: 4, col: 8 },
          { errorType: 'INVALID_PROBABILITY', row: 5, col: 5 },
          { errorType: 'INVALID_PROBABILITY', row: 5, col: 8 }
        ]
      ],
      [
        'mixed errors',
        'mixed-errors.csv',
        [
          { errorType: 'DUPLICATE_WEIGHT', row: 4, col: 1 },
          { errorType: 'DUPLICATE_WEIGHT', row: 5, col: 1 },
          { errorType: 'INVALID_PROBABILITY', row: 6, col: 4 },
          { errorType: 'ROW_HEADER_DISCREPANCY', row: 7, col: 9 },
          { errorType: 'ROW_HEADER_DISCREPANCY', row: 8, col: 9 }
        ]
      ]
    ])(
      'should return an error if csv contains %s',
      async (_, fixture, expectedErrors) => {
        const fileBuffer = loadFixture(fixture)

        const result = await uploadFile(
          server,
          '/api/reporting/reference/grilse-probabilities/2024/1',
          fileBuffer
        )

        expect(JSON.parse(result.payload)).toEqual({
          message: '400 BAD_REQUEST "Invalid CSV data"',
          path: '/api/reporting/reference/grilse-probabilities/2024/1',
          errors: expect.arrayContaining(expectedErrors),
          status: 400,
          timestamp: expect.any(String)
        })
        expect(result.statusCode).toBe(400)
      }
    )
  })

  describe('GET /api/reporting/reference/grilse-probabilities/{season}', () => {
    beforeEach(async () => {
      await deleteAllGrilseProbabilities()
    })

    it('should return 200 and a result if the season is valid', async () => {
      // upload file
      const fileBuffer = loadFixture('valid-grilse-data-10-datapoints.csv')
      await uploadFile(
        server,
        '/api/reporting/reference/grilse-probabilities/2024/1',
        fileBuffer
      )

      const result = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2024'
      })

      expect(result.payload).toMatchSnapshot()
      expect(result.statusCode).toBe(200)
    })

    it('should return 200 and a result if the season is a range', async () => {
      // upload multiple seasons
      const seasons = ['2022', '2023', '2024']
      for (const season of seasons) {
        const fileBuffer = loadFixture('valid-grilse-data-10-datapoints.csv')
        await uploadFile(
          server,
          `/api/reporting/reference/grilse-probabilities/${season}/1`,
          fileBuffer
        )
      }

      const result = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2022-2024'
      })

      expect(result.payload).toMatchSnapshot()
      expect(result.statusCode).toBe(200)
    })

    it('should return 200 and a result if the season is a range, but one of the years specified contains no data', async () => {
      // upload multiple seasons
      const seasons = ['2023', '2024']
      for (const season of seasons) {
        const fileBuffer = loadFixture('valid-grilse-data-10-datapoints.csv')
        await uploadFile(
          server,
          `/api/reporting/reference/grilse-probabilities/${season}/1`,
          fileBuffer
        )
      }

      // No data for 2022
      const result = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2022-2024'
      })

      expect(result.payload).toMatchSnapshot()
      expect(result.statusCode).toBe(200)
    })

    it('should return 404 if there is no result for the specified season', async () => {
      // upload multiple seasons
      const result = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2024'
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })

    it('should return 404 if there is no result for the specified season range', async () => {
      // upload multiple seasons
      const result = await server.inject({
        method: 'GET',
        url: '/api/reporting/reference/grilse-probabilities/2023-2024'
      })

      expect(result.statusCode).toBe(404)
      expect(result.payload).toBe('')
    })
  })
})
