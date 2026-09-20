import { Router } from 'express';
import { SupportController } from './support.controller.js';
import { SupportService } from './support.service.js';
import { SupportValidation } from './support.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class SupportModule {
  constructor() {
    this.router = Router();
    
    // Dependency Injection
    this.supportService = new SupportService();
    this.supportController = new SupportController(this.supportService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // User Routes
    this.router.post('/', requireAuth, SupportValidation.validate(SupportValidation.createSchema), this.supportController.createTicket);
    this.router.get('/my-tickets', requireAuth, this.supportController.getMyTickets);
    this.router.get('/my-tickets/:id', requireAuth, this.supportController.getMyTicketDetails);

    // Admin Routes
    this.router.get('/admin/pending', requireAuth, requireAdmin, this.supportController.getAdminPendingTickets);
    this.router.get('/admin/answered', requireAuth, requireAdmin, this.supportController.getAdminAnsweredTickets);
    this.router.get('/admin/:id', requireAuth, requireAdmin, this.supportController.getAdminTicketDetails);
    this.router.patch('/admin/:id/reply', requireAuth, requireAdmin, SupportValidation.validate(SupportValidation.replySchema), this.supportController.replyTicket);
  }
}
