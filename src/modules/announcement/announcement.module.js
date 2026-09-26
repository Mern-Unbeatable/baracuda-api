import { Router } from 'express';
import { AnnouncementController } from './announcement.controller.js';
import { AnnouncementService } from './announcement.service.js';
import { AnnouncementValidation } from './announcement.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class AnnouncementModule {
  constructor() {
    this.adminRouter = Router();
    this.publicRouter = Router();
    
    this.announcementService = new AnnouncementService();
    this.announcementController = new AnnouncementController(this.announcementService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Admin Routes
    this.adminRouter.use(requireAuth, requireAdmin);
    
    this.adminRouter.post('/', AnnouncementValidation.validate(AnnouncementValidation.createUpdateSchema), this.announcementController.create);
    this.adminRouter.get('/', this.announcementController.getAll);
    this.adminRouter.get('/stats', this.announcementController.getStats);
    this.adminRouter.get('/:id', this.announcementController.getDetails);
    this.adminRouter.put('/:id', AnnouncementValidation.validate(AnnouncementValidation.createUpdateSchema), this.announcementController.update);
    this.adminRouter.delete('/:id', this.announcementController.delete);

    // Public Routes could be added here if needed
  }
}
