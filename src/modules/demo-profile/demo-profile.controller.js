import { ResponseUtil } from '../../utils/response.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import { TranslateUtil } from '../../utils/translate.js';

export class DemoProfileController {
  constructor(demoProfileService) {
    this.demoProfileService = demoProfileService;
  }

  /**
   * Create a new demo profile
   * @route POST /api/v1/admin/demo-profiles
   */
  createProfile = async (req, res, next) => {
    try {
      const adminId = req.user.id;
      
      // Handle file uploads
      if (req.files) {
        if (req.files.profilePhoto && req.files.profilePhoto.length > 0) {
          req.body.profilePhoto = `/uploads/${req.files.profilePhoto[0].filename}`;
        }
        if (req.files.coverPhoto && req.files.coverPhoto.length > 0) {
          req.body.coverPhoto = `/uploads/${req.files.coverPhoto[0].filename}`;
        }
      }

      if (req.body.bio) {
        const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
        if (sourceLang === 'pl') {
          req.body.bio_pl = req.body.bio;
          req.body.bio = await TranslateUtil.translateText(req.body.bio, 'pl', 'en');
        } else {
          req.body.bio_pl = await TranslateUtil.translateText(req.body.bio, 'en', 'pl');
        }
      }

      const profile = await this.demoProfileService.createProfile(req.body, adminId);
      
      if (profile.profilePhoto) profile.profilePhoto = UrlUtil.getAbsoluteUrl(req, profile.profilePhoto);
      if (profile.coverPhoto) profile.coverPhoto = UrlUtil.getAbsoluteUrl(req, profile.coverPhoto);

      res.status(201).json({
        success: true,
        data: profile,
        message: 'Demo profile created successfully'
      });
    } catch (error) {
      if (error.message.includes('Username already exists') || error.message.includes('Email is already registered')) {
        return ResponseUtil.error(res, error.message, 409);
      }
      next(error);
    }
  };

  /**
   * Get stats for Demo Profiles
   * @route GET /api/v1/admin/demo-profiles/stats
   */
  getStats = async (req, res, next) => {
    try {
      const stats = await this.demoProfileService.getStats();

      res.status(200).json({
        success: true,
        data: stats,
        message: 'Demo profiles stats fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get paginated demo profiles
   * @route GET /api/v1/admin/demo-profiles
   */
  getProfiles = async (req, res, next) => {
    try {
      const { isActive, page, limit } = req.query;
      
      const profiles = await this.demoProfileService.getProfiles(
        isActive,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: profiles.data,
        meta: profiles.meta,
        message: 'Demo profiles fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle profile active/inactive status
   * @route PATCH /api/v1/admin/demo-profiles/:id/status
   */
  updateStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      const profile = await this.demoProfileService.updateStatus(id, isActive);

      if (profile.profilePhoto) profile.profilePhoto = UrlUtil.getAbsoluteUrl(req, profile.profilePhoto);
      if (profile.coverPhoto) profile.coverPhoto = UrlUtil.getAbsoluteUrl(req, profile.coverPhoto);

      res.status(200).json({
        success: true,
        data: profile,
        message: `Profile ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get single profile details
   * @route GET /api/v1/admin/demo-profiles/:id
   */
  getProfileDetails = async (req, res, next) => {
    try {
      const { id } = req.params;

      const details = await this.demoProfileService.getProfileDetails(id);
      
      if (details.profilePhoto) details.profilePhoto = UrlUtil.getAbsoluteUrl(req, details.profilePhoto);
      if (details.coverPhoto) details.coverPhoto = UrlUtil.getAbsoluteUrl(req, details.coverPhoto);

      res.status(200).json({
        success: true,
        data: details,
        message: 'Demo profile details fetched successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      next(error);
    }
  };
}
