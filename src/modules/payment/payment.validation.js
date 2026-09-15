import Joi from 'joi';

const paymentValidation = {
  donationSchema: Joi.object({
    submissionId: Joi.string().uuid().required(),
    amount: Joi.number().min(1).required(),
    donorName: Joi.string().min(2).max(100).required(),
    donorEmail: Joi.string().email().required(),
    type: Joi.string().valid('ONE_TIME', 'MONTHLY').required(),
    message: Joi.string().max(500).optional().allow(null, '')
  }),

  promoteSchema: Joi.object({
    submissionId: Joi.string().uuid().required(),
    durationDays: Joi.number().valid(7, 15, 30).required(),
  }),

  captureSchema: Joi.object({
    paymentId: Joi.string().required(), // PayPal Order ID
  }),

  validate: (schema) => {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
      if (error) {
        const details = error.details.map(d => d.message);
        return res.status(400).json({ success: false, statusCode: 400, error: 'Validation error', details });
      }
      req.validatedBody = value;
      next();
    };
  }
};

export default paymentValidation;
