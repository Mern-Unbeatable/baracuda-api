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
          username: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          avatar: true,
          coverPhoto: true,
          bio: true,
          bio_pl: true,
          city: true,
          city_pl: true,
          country: true,
          country_pl: true,
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

  /**
   * Get public profile with aggregated stats
   */
  async getPublicProfile(username, viewerId) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        coverPhoto: true,
        introVideo: true,
        bio: true,
        bio_pl: true,
        city: true,
        city_pl: true,
        country: true,
        country_pl: true,
        socialLinks: true,
        profileViews: true,
        createdAt: true,
      }
    });

    if (!user) return null;

    // Increment profileViews if visitor is not the owner
    if (viewerId !== user.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { profileViews: { increment: 1 } }
      });
      user.profileViews += 1;
    }

    // Aggregate stats
    const [followersCount, followingCount, totalArtwork, competitionEntries, submissionVotesAgg, premiumLikesAgg, isFollowingData] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.submission.count({ where: { userId: user.id } }),
      prisma.submission.count({ where: { userId: user.id, competitionState: 'IN_COMPETITION' } }),
      prisma.submission.aggregate({
        _sum: { votesCount: true },
        where: { userId: user.id }
      }),
      prisma.premiumPhoto.aggregate({
        _sum: { likesCount: true },
        where: { userId: user.id }
      }),
      viewerId ? prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: user.id
          }
        }
      }) : Promise.resolve(null)
    ]);

    const totalVotes = submissionVotesAgg._sum.votesCount || 0;
    const totalPremiumLikes = premiumLikesAgg._sum.likesCount || 0;
    const totalHearts = totalVotes + totalPremiumLikes;

    return {
      ...user,
      isFollowing: !!isFollowingData,
      stats: {
        followers: followersCount,
        following: followingCount,
        profileVisitors: user.profileViews,
        totalArtwork,
        competitionEntries,
        totalHearts
      }
    };
  }

  /**
   * Update Profile Information
   */
  async updateProfile(userId, updateData, files) {
    const data = { ...updateData };

    if (files.avatar && files.avatar.length > 0) {
      data.avatar = `/uploads/${files.avatar[0].filename}`;
    }
    if (files.coverPhoto && files.coverPhoto.length > 0) {
      data.coverPhoto = `/uploads/${files.coverPhoto[0].filename}`;
    }
    if (files.introVideo && files.introVideo.length > 0) {
      data.introVideo = `/uploads/${files.introVideo[0].filename}`;
    }

    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        coverPhoto: true,
        introVideo: true,
        bio: true,
        bio_pl: true,
        city: true,
        city_pl: true,
        country: true,
        country_pl: true,
        socialLinks: true
      }
    });
  }

  async toggleFollow(followerId, targetUsername) {
    try {
      const targetUser = await prisma.user.findUnique({
        where: { username: targetUsername }
      });
      if (!targetUser) throw new Error('Target user not found');
      if (targetUser.id === followerId) throw new Error('Cannot follow yourself');

      const existingFollow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: followerId,
            followingId: targetUser.id
          }
        }
      });

      if (existingFollow) {
        await prisma.follow.delete({ where: { id: existingFollow.id } });
        return { following: false, message: 'Unfollowed successfully' };
      } else {
        await prisma.follow.create({
          data: {
            followerId: followerId,
            followingId: targetUser.id
          }
        });
        return { following: true, message: 'Followed successfully' };
      }
    } catch (error) {
      throw error;
    }
  }

  async getFollowingList(userId, skip, take) {
    try {
      const [following, total] = await Promise.all([
        prisma.follow.findMany({
          where: { followerId: userId },
          skip,
          take,
          include: {
            following: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                bio: true,
                bio_pl: true,
                country: true,
                country_pl: true,
                _count: { select: { followers: true, submissions: true } }
              }
            }
          }
        }),
        prisma.follow.count({ where: { followerId: userId } })
      ]);

      return { data: following, total };
    } catch (error) {
      throw error;
    }
  }
}
