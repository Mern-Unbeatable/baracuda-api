import { Router } from 'express';
import { AdvertisementController } from './advertisement.controller.js';
import { AdvertisementService } from './advertisement.service.js';
import { AdvertisementValidation } from './advertisement.validation.js';
import { optionalAuth, requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/upload.js';

export class AdvertisementModule {
  constructor() {
    this.router = Router();
    this.advertisementService = new AdvertisementService();
    this.advertisementController = new AdvertisementController(this.advertisementService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post(
      '/',
      optionalAuth,
      upload.single('media'), // Since they upload the image, we can use the existing 'media' fieldname that I allowed previously
      AdvertisementValidation.validate(AdvertisementValidation.createSchema),
      this.advertisementController.createAdvertisement
    );

    this.router.post(
      '/capture',
      this.advertisementController.capturePayment
    );

    this.router.get(
      '/:id/invoice',
      this.advertisementController.downloadInvoice
    );

    // --- PUBLIC ROUTE ---
    this.router.get(
      '/public',
      AdvertisementValidation.validateQuery(AdvertisementValidation.publicAdsQuerySchema),
      this.advertisementController.getPublicAds
    );

    // --- ADMIN ROUTES ---
    
    this.router.get(
      '/admin/all',
      requireAuth,
      requireAdmin,
      this.advertisementController.getAllAdvertisements
    );

    this.router.get(
      '/admin/:id',
      requireAuth,
      requireAdmin,
      this.advertisementController.getAdvertisementById
    );

    this.router.patch(
      '/admin/:id/status',
      requireAuth,
      requireAdmin,
      this.advertisementController.updateAdvertisementStatus
    );
  }
}
