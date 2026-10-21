import { Router } from 'express';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { AuthController } from '../auth/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import prisma from '../../config/prisma.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';
import { upload } from '../../utils/upload.js';
import { moderateUploadedContent } from '../../middlewares/moderation.middleware.js';

export class UserModule {
  constructor() {
    this.adminRouter = Router();
    this.adminProfileRouter = Router();
    this.publicRouter = Router();
    
    // Dependency Injection
    this.userService = new UserService();
    this.userController = new UserController(this.userService);
    this.authService = new AuthService(prisma);
    this.authController = new AuthController(this.authService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Admin Profile Routes
    this.adminProfileRouter.use(requireAuth, requireAdmin);
    this.adminProfileRouter.get('/', this.userController.getAdminProfile);
    this.adminProfileRouter.put('/', upload.fields([
      { name: 'avatar', maxCount: 1 }
    ]), moderateUploadedContent, this.userController.updateAdminProfile);
    this.adminProfileRouter.patch('/', upload.fields([
      { name: 'avatar', maxCount: 1 }
    ]), moderateUploadedContent, this.userController.updateAdminProfile);
    this.adminProfileRouter.post('/change-password', this.authController.changePassword);
    // Profile Routes (Public & Self)
    this.publicRouter.get('/dashboard', requireAuth, this.userController.getDashboard);
    this.publicRouter.get('/profile/me', requireAuth, this.userController.getMyProfile);
    this.publicRouter.get('/profile/:username', optionalAuth, this.userController.getPublicProfile);
    this.publicRouter.put('/profile', requireAuth, upload.fields([
      { name: 'avatar', maxCount: 1 },
      { name: 'coverPhoto', maxCount: 1 },
      { name: 'introVideo', maxCount: 1 }
    ]), moderateUploadedContent, this.userController.updateProfile);

    // Follow Routes
    this.publicRouter.post('/follow/:username', requireAuth, this.userController.toggleFollow);
    this.publicRouter.get('/following', requireAuth, this.userController.getFollowingList);

    // Saved Artworks
    this.publicRouter.get('/saved-artworks', requireAuth, this.userController.getSavedArtworks);
    this.publicRouter.get('/saved-artwork', requireAuth, this.userController.getSavedArtworks);
    this.publicRouter.get('/liked-artworks', requireAuth, this.userController.getSavedArtworks);
    this.publicRouter.get('/favourite-photos', requireAuth, this.userController.getSavedArtworks);

    // Admin User Management Routes
    this.adminRouter.get('/dashboard', requireAuth, requireAdmin, this.userController.getAdminDashboard);
    this.adminRouter.get('/', requireAuth, requireAdmin, this.userController.getAllUsers);
    this.adminRouter.get('/:id', requireAuth, requireAdmin, this.userController.getUserById);
    this.adminRouter.patch('/:id/status', requireAuth, requireAdmin, this.userController.updateUserStatus);
  }
}
