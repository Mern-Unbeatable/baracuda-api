import { UrlUtil } from '../../utils/urlUtil.js';
import { userValidation } from './user.validation.js';
import { ResponseUtil } from '../../utils/response.js';
import { TranslateUtil } from '../../utils/translate.js';
import { PaginationUtil } from '../../utils/pagination.js';

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
      
      // Inject private fields for the owner
      profile.email = user.email;
      profile.phone = user.phone;

      const formattedProfile = UrlUtil.formatUserMedia(req, profile);
      
      res.status(200).json({
        success: true,
        data: formattedProfile
      });
    } catch (error) {
      next(error);
    }
  }

  getDashboard = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const dashboardData = await this.userService.getDashboard(userId);
      
      // format URLs if needed
      if (dashboardData.participatingCompetitions) {
        dashboardData.participatingCompetitions = dashboardData.participatingCompetitions.map(comp => {
          if (comp.coverImage) {
            comp.coverImage = UrlUtil.getAbsoluteUrl(req, comp.coverImage);
          }
          return comp;
        });
      }

      res.status(200).json({
        success: true,
        data: dashboardData
      });
    } catch (error) {
      next(error);
    }
  }

  getAdminDashboard = async (req, res, next) => {
    try {
      const dashboardData = await this.userService.getAdminDashboard();
      
      // format URLs if needed
      if (dashboardData.recentCompetition && dashboardData.recentCompetition.submissions) {
        dashboardData.recentCompetition.submissions = dashboardData.recentCompetition.submissions.map(sub => {
          if (sub.image) {
            sub.image = UrlUtil.getAbsoluteUrl(req, sub.image);
          }
          return sub;
        });
      }

      res.status(200).json({
        success: true,
        data: dashboardData
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
        username: req.body.username,
        email: req.body.email,
        phone: req.body.phone,
        bio: req.body.bio,
        bio_pl,
        city: req.body.city,
        city_pl,
        country: req.body.country,
        country_pl,
        socialLinks: socialLinks
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

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

  toggleFollow = async (req, res, next) => {
    try {
      const followerId = req.user.id;
      const { username } = req.params;

      const result = await this.userService.toggleFollow(followerId, username);
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: { following: result.following }
      });
    } catch (error) {
      if (error.message === 'Target user not found' || error.message === 'Cannot follow yourself') {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }

  getFollowingList = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const { data, total } = await this.userService.getFollowingList(userId, skip, take);

      const formattedData = data.map(follow => {
        let fUser = follow.following;
        
        const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';
        if (sourceLang === 'pl') {
          if (fUser.bio_pl) fUser.bio = fUser.bio_pl;
          if (fUser.country_pl) fUser.country = fUser.country_pl;
        }

        fUser = UrlUtil.formatUserMedia(req, fUser);

        return {
          id: fUser.id,
          username: fUser.username,
          name: fUser.name,
          avatar: fUser.avatar,
          bio: fUser.bio,
          country: fUser.country,
          followersCount: fUser._count.followers,
          artworksCount: fUser._count.submissions,
          followedAt: follow.createdAt
        };
      });

      res.status(200).json({
        success: true,
        message: 'Following list fetched successfully',
        data: formattedData,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      next(error);
    }
  }

  getSavedArtworks = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const { data, total } = await this.userService.getSavedArtworks(userId, skip, take);

      const sourceLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0] || req.headers['x-lang'] || 'en';

      const formattedData = data.map(art => {
        let fArt = { ...art };
        
        if (sourceLang === 'pl') {
          if (fArt.title_pl) fArt.title = fArt.title_pl;
          if (fArt.story_pl) fArt.story = fArt.title_pl;
        }

        fArt.user = UrlUtil.formatUserMedia(req, fArt.user);
        
        if (fArt.media && Array.isArray(fArt.media)) {
          fArt.media = fArt.media.map(m => ({
            ...m,
            url: UrlUtil.getAbsoluteUrl(req, m.url)
          }));
        }

        // Return a cover image URL for easier frontend mapping
        fArt.coverImage = fArt.media && fArt.media.length > 0 ? fArt.media[0].url : null;
        delete fArt.media;

        return fArt;
      });

      res.status(200).json({
        success: true,
        message: 'Saved artworks fetched successfully',
        data: formattedData,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      next(error);
    }
  }

  // Alias for backward compatibility
  getLikedArtworks = this.getSavedArtworks;

  /**
   * Get Admin Profile
   * @route GET /api/v1/admin/profile
   */
  getAdminProfile = async (req, res, next) => {
    try {
      const adminId = req.user.id;
      const admin = await this.userService.getUserById(adminId);
      if (!admin) {
        return ResponseUtil.error(res, 'Admin not found', 404);
      }
      return ResponseUtil.success(res, 'Admin profile retrieved successfully', UrlUtil.formatUserMedia(req, admin));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update Admin Profile (Name, Email, etc.)
   * @route PUT /api/v1/admin/profile, PATCH /api/v1/admin/profile
   */
  updateAdminProfile = async (req, res, next) => {
    try {
      const adminId = req.user.id;
      const files = req.files || {};
      const { name, email, phone, bio } = req.body;

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (bio !== undefined) updateData.bio = bio;

      const updated = await this.userService.updateProfile(adminId, updateData, files);
      return ResponseUtil.success(res, 'Admin profile updated successfully', UrlUtil.formatUserMedia(req, updated));
    } catch (error) {
      next(error);
    }
  };
}
