import { UrlUtil } from '../../utils/urlUtil.js';
import { userValidation } from './user.validation.js';
import { ResponseUtil } from '../../utils/response.js';

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
}
