import Joi from 'joi';

export const AppreciationValidation = {
  awardSchema: Joi.object({
    receiverId: Joi.string().uuid().optional(),
    username: Joi.string().optional(),
    submissionId: Joi.string().uuid().optional(),
    tier: Joi.string().valid('GOLD', 'SILVER', 'BRONZE', 'gold', 'silver', 'bronze').required().messages({
      'any.required': 'Appreciation tier is required',
      'any.only': 'Tier must be one of GOLD, SILVER, or BRONZE'
    })
  }).or('receiverId', 'username', 'submissionId').messages({
    'object.missing': 'At least one of receiverId, username, or submissionId must be provided'
  }),

  validate: (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(err => err.message)
      });
    }
    req.body = value;
    next();
  }
};
