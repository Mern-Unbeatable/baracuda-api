import { Router } from 'express';
import { AdminReportController } from './admin-report.controller.js';
import { AdminReportService } from './admin-report.service.js';
import { AdminReportValidation } from './admin-report.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class AdminReportModule {
  constructor() {
    this.router = Router();
    this.userAuditRouter = Router();
    this.adminReportService = new AdminReportService();
    this.adminReportController = new AdminReportController(this.adminReportService);
    this.initializeRoutes();
  }

  initializeRoutes() {
    // All routes require authentication and admin role (or specific roles)
    const adminAuth = [requireAuth, requireAdmin];
    
    this.router.use(...adminAuth);
    this.userAuditRouter.use(...adminAuth);

    // Report Routes
    this.router.get('/stats', this.adminReportController.getReportStats);
    this.router.get('/', this.adminReportController.getAllReports);
    this.router.get('/:id', this.adminReportController.getReportDetails);
    
    this.router.patch('/:id/status', AdminReportValidation.validate(AdminReportValidation.statusSchema), this.adminReportController.updateReportStatus);
    this.router.post('/:id/action', AdminReportValidation.validate(AdminReportValidation.actionSchema), this.adminReportController.executeAction);
    
    // User Audit Routes
    this.userAuditRouter.get('/:userId/audit-history', this.adminReportController.getUserAuditHistory);
  }
}
