import { Router } from 'express';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';
import { upload } from '../../utils/upload.js';

export class UserModule {
  constructor() {
    this.adminRouter = Router();
    this.publicRouter = Router();
    
    // Dependency Injection
    this.userService = new UserService();
    this.userController = new UserController(this.userService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Profile Routes (Public & Self)
    this.publicRouter.get('/profile/me', requireAuth, this.userController.getMyProfile);
    this.publicRouter.get('/profile/:username', optionalAuth, this.userController.getPublicProfile);
    this.publicRouter.put('/profile', requireAuth, upload.fields([
      { name: 'avatar', maxCount: 1 },
      { name: 'coverPhoto', maxCount: 1 },
      { name: 'introVideo', maxCount: 1 }
    ]), this.userController.updateProfile);

    // Admin User Management Routes
    this.adminRouter.get('/', requireAuth, requireAdmin, this.userController.getAllUsers);
    this.adminRouter.get('/:id', requireAuth, requireAdmin, this.userController.getUserById);
    this.adminRouter.patch('/:id/status', requireAuth, requireAdmin, this.userController.updateUserStatus);
  }
}
