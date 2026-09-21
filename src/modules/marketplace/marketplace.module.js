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
    this.router.get('/premium-photos', optionalAuth, this.marketplaceController.getAllPremiumPhotos);
    this.router.get('/premium-photos/:id', optionalAuth, this.marketplaceController.getPremiumPhotoById);
    
    this.router.post(
      '/premium-photos',
      requireAuth,
      photoUploadFields,
      MarketplaceValidation.validate(MarketplaceValidation.createSchema),
      this.marketplaceController.createPremiumPhoto
    );
    
    this.router.put(
      '/premium-photos/:id',
      requireAuth,
      MarketplaceValidation.validate(MarketplaceValidation.updateSchema),
      this.marketplaceController.updatePremiumPhoto
    );

    this.router.delete('/premium-photos/:id', requireAuth, this.marketplaceController.deletePremiumPhoto);

    // Promotion endpoints
    this.router.post(
      '/premium-photos/:id/promote',
      requireAuth,
      upload.none(),
      MarketplaceValidation.validate(MarketplaceValidation.promoteSchema),
      this.marketplaceController.promotePremiumPhoto
    );
    
    this.router.post(
      '/premium-photos/promote/capture',
      requireAuth,
      upload.none(),
      this.marketplaceController.capturePromotion
    );
    // Public endpoints for Explore and Details
    this.router.get('/public/premium-images', optionalAuth, this.marketplaceController.getPublicPremiumPhotos);
    this.router.get('/public/premium-images/:id', optionalAuth, this.marketplaceController.getPublicPremiumPhotoDetails);

    // Interaction endpoints
    this.router.post('/premium-images/:id/like', requireAuth, this.marketplaceController.likePremiumPhoto);
    this.router.post('/premium-images/:id/save', requireAuth, this.marketplaceController.savePremiumPhoto);
    this.router.post(
      '/premium-images/:id/report', 
      requireAuth, 
      this.marketplaceController.reportPremiumPhoto
    );

    // Purchase endpoints
    this.router.get('/my-purchases/stats', requireAuth, this.marketplaceController.getMyPurchaseStats);
    this.router.get('/my-purchases', requireAuth, this.marketplaceController.getMyPurchases);
    this.router.post('/premium-images/:id/buy', optionalAuth, this.marketplaceController.buyPremiumPhoto);
    this.router.post('/premium-images/buy/capture', optionalAuth, this.marketplaceController.capturePurchase);
    this.router.get('/premium-images/:id/download', optionalAuth, this.marketplaceController.downloadPurchasedPhoto);
  }
}
