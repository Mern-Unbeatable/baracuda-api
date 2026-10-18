import { Router } from 'express';
import { BusinessController } from './business.controller.js';
import { BusinessService } from './business.service.js';
import { BusinessValidation } from './business.validation.js';
import { upload } from '../../utils/upload.js';
import { moderateUploadedContent } from '../../middlewares/moderation.middleware.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class BusinessModule {
  constructor() {
    this.router = Router();
    this.businessService = new BusinessService();
    this.businessController = new BusinessController(this.businessService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    const photoUploadFields = upload.fields([
      { name: 'images', maxCount: 12 },
      { name: 'video', maxCount: 1 }
    ]);

    // Public / User endpoints
    this.router.post(
      '/',
      requireAuth,
      photoUploadFields,
      moderateUploadedContent,
      BusinessValidation.validate(BusinessValidation.createSchema),
      this.businessController.createBusinessAlbum
    );

    // Admin endpoints
    this.router.get(
      '/admin',
      requireAuth,
      requireAdmin,
      this.businessController.getAllBusinessAlbums
    );
    
    this.router.get(
      '/admin/:id',
      requireAuth,
      requireAdmin,
      this.businessController.getBusinessAlbumDetails
    );
  }
}
