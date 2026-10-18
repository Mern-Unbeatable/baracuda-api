import { Router } from 'express';
import { NewsletterController } from './newsletter.controller.js';
import { NewsletterService } from './newsletter.service.js';
import { NewsletterValidation } from './newsletter.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/upload.js';
import { moderateUploadedContent } from '../../middlewares/moderation.middleware.js';

// Setup basic validation middleware inline or use an existing one if available.
const validateBody = (schema) => {
  return (req, res, next) => {
    // If multer parsed text fields, they are in req.body
    const { error, value } = schema.validate(req.body, { abortEarly: false, allowUnknown: true });
    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    req.validatedBody = value;
    next();
  };
};

export class NewsletterModule {
  constructor() {
    this.router = Router();
    this.newsletterService = new NewsletterService();
    this.newsletterController = new NewsletterController(this.newsletterService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Public routes
    this.router.post(
      '/subscribe',
      validateBody(NewsletterValidation.subscribe),
      this.newsletterController.subscribe
    );

    // Admin routes
    this.router.get(
      '/subscribers',
      requireAuth,
      requireAdmin,
      this.newsletterController.getAllSubscribers
    );

    this.router.post(
      '/campaigns/send',
      requireAuth,
      requireAdmin,
      upload.single('banner'),
      moderateUploadedContent,
      validateBody(NewsletterValidation.sendCampaign),
      this.newsletterController.sendCampaign
    );
  }
}
