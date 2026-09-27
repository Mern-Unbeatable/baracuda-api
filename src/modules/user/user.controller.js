import { UrlUtil } from '../../utils/urlUtil.js';
import { userValidation } from './user.validation.js';
import { ResponseUtil } from '../../utils/response.js';
import { TranslateUtil } from '../../utils/translate.js';

export class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Get all users (Admin)
   * @route GET /api/v1/admin/users
   */
  getAllUsers = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const status = req.query.status;

      const { users, totalCount } = await this.userService.getAllUsers(page, limit, status);
      
      const formattedUsers = users.map(u => UrlUtil.formatUserMedia(req, u));
      
      res.status(200).json({
        success: true,
        data: formattedUsers,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single user by ID (Admin)
   * @route GET /api/v1/admin/users/:id
   */
  getUserById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      
      if (!user) {
        return ResponseUtil.error(res, 'User not found', 404);
      }
      
      res.status(200).json({
        success: true,
        data: UrlUtil.formatUserMedia(req, user)
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update User Status (Admin)
   * @route PATCH /api/v1/admin/users/:id/status
   */
  updateUserStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Validate request body
      const { error, value } = userValidation.updateStatus.validate(req.body);
      if (error) {
        return ResponseUtil.error(res, error.details[0].message, 400);
      }

      const { status, reason } = value;

      const updatedUser = await this.userService.updateUserStatus(id, status, reason);
      
      res.status(200).json({
        success: true,
        data: UrlUtil.formatUserMedia(req, updatedUser),
        message: `User status updated to ${status}`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get My Profile (No username required)
   * @route GET /api/v1/users/profile/me
   */
  getMyProfile = async (req, res, next) => {
    try {
      const viewerId = req.user.id;
      
      // Fetch basic user to get username
      const user = await this.userService.getUserById(viewerId);
      if (!user) {
        return ResponseUtil.error(res, 'User not found', 404);
      }
      
      // Use existing public profile logic, which aggregates all stats
      const profile = await this.userService.getPublicProfile(user.username, viewerId);
      const formattedProfile = UrlUtil.formatUserMedia(req, profile);
      
      res.status(200).json({
        success: true,
        data: formattedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Public Profile
   * @route GET /api/v1/users/profile/:username
   */
  getPublicProfile = async (req, res, next) => {
    try {
      const { username } = req.params;
      const viewerId = req.user?.id; // Optional authenticated user

      const profile = await this.userService.getPublicProfile(username, viewerId);
      if (!profile) {
        return ResponseUtil.error(res, 'Profile not found', 404);
      }
      
      const formattedProfile = UrlUtil.formatUserMedia(req, profile);
      
      res.status(200).json({
        success: true,
        data: formattedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Profile
   * @route PUT /api/v1/users/profile
   */
  updateProfile = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const files = req.files || {};
      
      let socialLinks;
      if (req.body.socialLinks) {
        try {
          socialLinks = typeof req.body.socialLinks === 'string' 
            ? JSON.parse(req.body.socialLinks) 
            : req.body.socialLinks;
        } catch(e) {
          socialLinks = req.body.socialLinks;
        }
      }

      let bio_pl = null;
      let city_pl = null;
      let country_pl = null;
      if (req.body.bio) {
        bio_pl = await TranslateUtil.translateText(req.body.bio, 'pl', 'en');
      }
      if (req.body.city) {
        city_pl = await TranslateUtil.translateText(req.body.city, 'pl', 'en');
      }
      if (req.body.country) {
        country_pl = await TranslateUtil.translateText(req.body.country, 'pl', 'en');
      }

      const updateData = {
        name: req.body.name,
        bio: req.body.bio,
        bio_pl,
        city: req.body.city,
        city_pl,
        country: req.body.country,
        country_pl,
        socialLinks: socialLinks
      };

      const updatedProfile = await this.userService.updateProfile(userId, updateData, files);
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: UrlUtil.formatUserMedia(req, updatedProfile)
      });
    } catch (error) {
      next(error);
    }
  }
}
