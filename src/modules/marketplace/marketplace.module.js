import { Router } from 'express';
import { MarketplaceController } from './marketplace.controller.js';
import { MarketplaceService } from './marketplace.service.js';
import { MarketplaceValidation } from './marketplace.validation.js';
import { upload } from '../../utils/upload.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';

export class MarketplaceModule {
  constructor() {
    this.router = Router();
    
    this.marketplaceService = new MarketplaceService();
    this.marketplaceController = new MarketplaceController(this.marketplaceService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    const photoUploadFields = upload.fields([
      { name: 'images', maxCount: 12 },
      { name: 'video', maxCount: 1 }
    ]);

    // Endpoints for premium photos
    this.router.get('/', optionalAuth, this.marketplaceController.getAllPremiumPhotos);
    this.router.get('/:id', optionalAuth, this.marketplaceController.getPremiumPhotoById);
    
    this.router.post(
      '/',
      requireAuth,
      photoUploadFields,
      MarketplaceValidation.validate(MarketplaceValidation.createSchema),
      this.marketplaceController.createPremiumPhoto
    );
    
    this.router.put(
      '/:id',
      requireAuth,
      MarketplaceValidation.validate(MarketplaceValidation.updateSchema),
      this.marketplaceController.updatePremiumPhoto
    );

    this.router.delete('/:id', requireAuth, this.marketplaceController.deletePremiumPhoto);

    // Promotion endpoints
    this.router.post(
      '/:id/promote',
      requireAuth,
      upload.none(),
      MarketplaceValidation.validate(MarketplaceValidation.promoteSchema),
      this.marketplaceController.promotePremiumPhoto
    );
    
    this.router.post(
      '/promote/capture',
      requireAuth,
      upload.none(),
      this.marketplaceController.capturePromotion
    );
  }
}
