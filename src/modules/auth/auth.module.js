import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthValidation } from './auth.validation.js';
import { upload } from '../../utils/upload.js';
import { moderateUploadedContent } from '../../middlewares/moderation.middleware.js';
import prisma from '../../config/prisma.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';

/**
 * Auth Module
 * Wires authentication related routes, controllers and services.
 */
export class AuthModule {
  constructor() {
    this.router = Router();
    
    // Dependency Injection
    this.authService = new AuthService(prisma);
    this.authController = new AuthController(this.authService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.post(
      '/register',
      upload.fields([
        { name: 'avatar', maxCount: 1 },
        { name: 'coverPhoto', maxCount: 1 },
        { name: 'introVideo', maxCount: 1 }
      ]),
      moderateUploadedContent,
      AuthValidation.validate(AuthValidation.registerSchema),
      this.authController.register
    );

    this.router.post(
      '/login',
      AuthValidation.validate(AuthValidation.loginSchema),
      this.authController.login
    );

    this.router.post(
      '/forgot-password',
      AuthValidation.validate(AuthValidation.forgotPasswordSchema),
      this.authController.forgotPassword
    );

    this.router.post(
      '/verify-otp',
      AuthValidation.validate(AuthValidation.verifyOtpSchema),
      this.authController.verifyOtp
    );

    this.router.post(
      '/reset-password',
      AuthValidation.validate(AuthValidation.resetPasswordSchema),
      this.authController.resetPassword
    );

    this.router.post(
      '/change-password',
      requireAuth,
      this.authController.changePassword
    );
  }
}
