import { getBaseUrl } from '../utils/url-utils.js'

/**
 * Maps a Grilse Probability entity to a response object.
 *
 * @param {import('../entities/index.js').GrilseProbability} grilseProbability - The Grilse GrilseProbabilityProbability entity
 * @returns {Object} - The mapped response object with HATEOAS links
 */
export function mapGrilseProbabilityToResponse(grilseProbability) {
  const { id, season, month, massInPounds, probability, updatedAt, createdAt } =
    grilseProbability

  const baseUrl = getBaseUrl()
  const grilseProbabilitiesUrl = `${baseUrl}/api/grilseProbabilities/${id}`

  return {
    id,
    season,
    month,
    massInPounds,
    probability,
    updatedAt,
    createdAt,
    _links: {
      self: {
        href: grilseProbabilitiesUrl
      },
      grilseProbability: {
        href: grilseProbabilitiesUrl
      },
      gate: {
        href: `${grilseProbabilitiesUrl}/gate`
      }
    }
  }
}
