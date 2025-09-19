import Joi from 'joi'

export const postGrilseProbabilityRequestParamSchema = Joi.object({
  season: Joi.number()
    .required()
    .description('The year which the grilse probabilities relates to'),
  gate: Joi.number()
    .required()
    .description('The gate which the grilse probabilities relates to')
})

export const postGrilseProbabilityRequestQuerySchema = Joi.object({
  overwrite: Joi.boolean()
    .optional()
    .description(
      'A boolean to say whether the grilse probabilities for the specified season and gate should be overridden'
    )
})

export const getGrilseProbabilityRequestParamSchema = Joi.object({
  season: Joi.alternatives()
    .try(
      Joi.string()
        .regex(/^\d+$/)
        .required()
        .description('A single season year (e.g., 2024)'),
      Joi.string()
        .pattern(/^\d{4}-\d{4}$/)
        .required()
        .description('A season range in the format YYYY-YYYY (e.g., 2023-2025)')
    )
    .required()
})

export const grilseProbabilityIdSchema = Joi.object({
  grilseProbabilityId: Joi.number()
    .required()
    .description('The id of the grilse probability')
})
