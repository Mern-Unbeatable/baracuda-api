import { Router } from 'express';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';

export class UserModule {
  constructor() {
    this.router = Router();
    
    // Dependency Injection
    this.userService = new UserService();
    this.userController = new UserController(this.userService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Admin User Management Routes
    this.router.get('/', requireAuth, requireAdmin, this.userController.getAllUsers);
    this.router.get('/:id', requireAuth, requireAdmin, this.userController.getUserById);
    this.router.patch('/:id/status', requireAuth, requireAdmin, this.userController.updateUserStatus);
  }
}
