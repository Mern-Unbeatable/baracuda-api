import { ResponseUtil } from '../../utils/response.js';
import { MediaValidator } from '../../utils/mediaValidator.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import path from 'path';

export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  register = async (req, res, next) => {
    try {
      // req.validatedBody is populated by the Joi validation middleware
      // socialLinks is already parsed and transformed into a {platform: url} object by Joi!
      const userData = { ...req.validatedBody };
      
      const files = req.files || {};
      const avatarFile = files['avatar'] ? files['avatar'][0] : null;
      const coverPhotoFile = files['coverPhoto'] ? files['coverPhoto'][0] : null;
      const introVideoFile = files['introVideo'] ? files['introVideo'][0] : null;

      try {
        // Validate media constraints
        if (avatarFile) {
          // await MediaValidator.validateImage(avatarFile.path, 400, 400, 'Avatar', 20); // Dimension check disabled
          userData.avatar = `/uploads/${path.basename(avatarFile.path)}`;
        }
        if (coverPhotoFile) {
          // await MediaValidator.validateImage(coverPhotoFile.path, 1600, 600, 'Cover photo', 50); // Dimension check disabled
          userData.coverPhoto = `/uploads/${path.basename(coverPhotoFile.path)}`;
        }
        if (introVideoFile) {
          await MediaValidator.validateVideoDuration(introVideoFile.path, 180, 'Introduction video'); // 3 minutes = 180s
          userData.introVideo = `/uploads/${path.basename(introVideoFile.path)}`;
        }

        // Register user
        let user = await this.authService.registerUser(userData);
        user = UrlUtil.formatUserMedia(req, user);
        return ResponseUtil.success(res, 'Registration successful', user, 201);
        
      } catch (err) {
        // Clean up uploaded files if validation or registration fails
        if (avatarFile) await MediaValidator.deleteFile(avatarFile.path);
        if (coverPhotoFile) await MediaValidator.deleteFile(coverPhotoFile.path);
        if (introVideoFile) await MediaValidator.deleteFile(introVideoFile.path);
        
        // Return 400 Bad Request for specific media validation errors
        if (err.message.includes('must be approximately') || 
            err.message.includes('duration must not exceed') || 
            err.message.includes('Invalid avatar') || 
            err.message.includes('Invalid cover photo') || 
            err.message.includes('Invalid introduction video') ||
            err.message.includes('Invalid image') || 
            err.message.includes('Invalid video')) {
          return ResponseUtil.error(res, err.message, 400);
        }
        
        next(err);
      }
    } catch (err) {
      if (err.message === 'Email is already registered' || err.message === 'Username is already taken') {
        return ResponseUtil.error(res, err.message, 409);
      }
      if (err.message.includes('exactly') || err.message.includes('approximately') || err.message.includes('exceed')) {
        return ResponseUtil.error(res, err.message, 400);
      }
      next(err);
    }
  }

  login = async (req, res, next) => {
    try {
      const data = await this.authService.loginUser(req.validatedBody.email, req.validatedBody.password);
      data.user = UrlUtil.formatUserMedia(req, data.user);
      return ResponseUtil.success(res, 'Login successful', data);
    } catch (err) {
      if (err.message === 'Email not found' || err.message === "Password doesn't match" || err.message === 'Account is suspended or banned') {
        return ResponseUtil.error(res, err.message, 401);
      }
      next(err);
    }
  }

  forgotPassword = async (req, res, next) => {
    try {
      await this.authService.sendForgotPasswordOtp(req.validatedBody.email);
      return ResponseUtil.success(res, 'An OTP has been sent to your email.');
    } catch (err) {
      if (err.message === 'Email not found') {
        return ResponseUtil.error(res, err.message, 404);
      }
      next(err);
    }
  }

  verifyOtp = async (req, res, next) => {
    try {
      const resetToken = await this.authService.verifyOtp(
        req.validatedBody.email,
        req.validatedBody.otp
      );
      return ResponseUtil.success(res, 'OTP verified successfully', { resetToken });
    } catch (err) {
      if (err.message === 'Invalid OTP or email' || err.message === 'Invalid OTP' || err.message === 'OTP has expired') {
        return ResponseUtil.error(res, err.message, 400);
      }
      next(err);
    }
  }

  resetPassword = async (req, res, next) => {
    try {
      await this.authService.resetPassword(
        req.validatedBody.token,
        req.validatedBody.newPassword
      );
      return ResponseUtil.success(res, 'Password successfully reset');
    } catch (err) {
      if (err.message === 'Invalid or expired reset token') {
        return ResponseUtil.error(res, err.message, 400);
      }
      next(err);
    }
  }
}

