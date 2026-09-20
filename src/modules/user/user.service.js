import prisma from '../../config/prisma.js';

/**
 * User Service Layer
 * Handles business logic and database operations for users
 */
export class UserService {
  /**
   * Get all users with pagination and filtering
   */
  async getAllUsers(page = 1, limit = 10, status) {
    try {
      const skip = (page - 1) * limit;
      const where = {
        role: 'USER'
      };
      
      if (status && status !== 'All') {
        where.status = status.toUpperCase();
      }

      const [users, totalCount] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true,
            avatar: true,
            suspendReason: true,
            suspendedAt: true
          }
        }),
        prisma.user.count({ where })
      ]);

      return { users, totalCount };
    } catch (error) {
      throw new Error('Failed to fetch users: ' + error.message);
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(id) {
    try {
      return await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          avatar: true,
          coverPhoto: true,
          bio: true,
          city: true,
          country: true,
          role: true,
          isVerified: true,
          suspendReason: true,
          suspendedAt: true,
          lastLoginAt: true
        }
      });
    } catch (error) {
      throw new Error('Failed to fetch user: ' + error.message);
    }
  }

  /**
   * Update user status (Active/Suspend)
   */
  async updateUserStatus(id, status, reason = null) {
    try {
      const updateData = {
        status: status,
      };

      if (status === 'SUSPENDED') {
        updateData.suspendReason = reason;
        updateData.suspendedAt = new Date();
      } else if (status === 'ACTIVE') {
        updateData.suspendReason = null;
        updateData.suspendedAt = null;
      }

      return await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          suspendReason: true,
          suspendedAt: true
        }
      });
    } catch (error) {
      throw new Error('Failed to update user status: ' + error.message);
    }
  }
}
