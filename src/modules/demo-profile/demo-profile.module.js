import { Router } from 'express';
import { DemoProfileController } from './demo-profile.controller.js';
import { DemoProfileService } from './demo-profile.service.js';
import { DemoProfileValidation } from './demo-profile.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/upload.js';

export class DemoProfileModule {
  constructor() {
    this.router = Router();
    
    this.demoProfileService = new DemoProfileService();
    this.demoProfileController = new DemoProfileController(this.demoProfileService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.use(requireAuth, requireAdmin);

    this.router.post(
      '/',
      upload.fields([
        { name: 'profilePhoto', maxCount: 1 },
        { name: 'coverPhoto', maxCount: 1 }
      ]),
      (req, res, next) => {
        if (req.body.socialLinks && typeof req.body.socialLinks === 'string') {
          try {
            req.body.socialLinks = JSON.parse(req.body.socialLinks);
          } catch(e) {
            req.body.socialLinks = [req.body.socialLinks];
          }
        }
        next();
      },
      DemoProfileValidation.validate(DemoProfileValidation.createSchema),
      this.demoProfileController.createProfile
    );

    this.router.get('/stats', this.demoProfileController.getStats);
    
    this.router.get('/', this.demoProfileController.getProfiles);
    
    this.router.get('/:id', this.demoProfileController.getProfileDetails);
    
    this.router.patch(
      '/:id/status',
      DemoProfileValidation.validate(DemoProfileValidation.statusUpdateSchema),
      this.demoProfileController.updateStatus
    );
  }
}
