import { mapGrilseProbabilityToResponse } from '../grilse-probabilities.mapper.js'

describe('grilse-probabilities.mapper.unit', () => {
  describe('mapGrilseProbabilityToResponse', () => {
    const mockGrilseProbabilityEnity = {
      id: '1',
      season: 2025,
      month: 6,
      massInPounds: 1,
      probability: '1.0000000000000000',
      updatedAt: '2025-09-01T08:57:24.770Z',
      createdAt: '2025-09-01T08:57:24.770Z'
    }

    it('should map a GrilseProbability entity to a response object with correct links', () => {
      const result = mapGrilseProbabilityToResponse(mockGrilseProbabilityEnity)

      expect(result).toStrictEqual({
        _links: {
          self: {
            href: 'http://localhost:5000/api/grilseProbabilities/1'
          },
          grilseProbability: {
            href: 'http://localhost:5000/api/grilseProbabilities/1'
          },
          gate: {
            href: 'http://localhost:5000/api/grilseProbabilities/1/gate'
          }
        },
        id: '1',
        season: 2025,
        month: 6,
        massInPounds: 1,
        probability: '1.0000000000000000',
        updatedAt: '2025-09-01T08:57:24.770Z',
        createdAt: '2025-09-01T08:57:24.770Z'
      })
    })
  })
})
