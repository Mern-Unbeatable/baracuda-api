/**
 * User Controller Layer
 * Handles HTTP requests and responses for user-related endpoints
 */
export class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Get all users
   * @route GET /api/users
   */
  getAllUsers = async (req, res, next) => {
    try {
      const users = await this.userService.getAllUsers();
      
      res.status(200).json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single user by ID
   * @route GET /api/users/:id
   */
  getUserById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new user
   * @route POST /api/users
   */
  createUser = async (req, res, next) => {
    try {
      const userData = req.body;
      
      // Basic validation
      if (!userData.name || !userData.email) {
        return res.status(400).json({
          success: false,
          error: 'Name and email are required'
        });
      }
      
      const newUser = await this.userService.createUser(userData);
      
      res.status(201).json({
        success: true,
        data: newUser,
        message: 'User created successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update existing user
   * @route PUT /api/users/:id
   */
  updateUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const userData = req.body;
      
      const updatedUser = await this.userService.updateUser(id, userData);
      
      res.status(200).json({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   * @route DELETE /api/users/:id
   */
  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.userService.deleteUser(id);
      
      res.status(200).json({
        success: true,
        data: result,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
