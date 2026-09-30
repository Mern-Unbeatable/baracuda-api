import { Router } from 'express';
import { StoreController } from './store.controller.js';
import { StoreService } from './store.service.js';
import { StoreValidation } from './store.validation.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/upload.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';

export class StoreModule {
  constructor() {
    this.router = Router();
    this.storeService = new StoreService();
    this.storeController = new StoreController(this.storeService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    // We expect a banner image and up to 10 other images
    const productUploads = upload.fields([
      { name: 'bannerImage', maxCount: 1 },
      { name: 'images', maxCount: 10 }
    ]);

    this.router.post(
      '/',
      requireAuth,
      productUploads,
      StoreValidation.validate(StoreValidation.createSchema),
      this.storeController.createProduct
    );

    this.router.get('/', requireAuth, this.storeController.getAllProducts);
    this.router.get('/:id', requireAuth, this.storeController.getProductById);

    this.router.put(
      '/:id',
      requireAuth,
      productUploads,
      StoreValidation.validate(StoreValidation.updateSchema),
      this.storeController.updateProduct
    );

    this.router.delete('/:id', requireAuth, this.storeController.deleteProduct);
  }
}

export default new StoreModule().router;
