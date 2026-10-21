import prisma from '../../config/prisma.js';
import { appreciationService } from '../appreciation/appreciation.service.js';

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
    const [followersCount, followingCount, totalArtwork, totalVideos, competitionEntries, submissionVotesAgg, premiumLikesAgg, isFollowingData, appreciationStats, standaloneVideos] = await Promise.all([
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      prisma.submission.count({ where: { userId: user.id } }),
      prisma.submission.count({ where: { userId: user.id, kind: 'VIDEO' } }),
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
      }) : Promise.resolve(null),
      appreciationService.getAppreciationStats(user.id, viewerId),
      prisma.submission.findMany({
        where: { userId: user.id, kind: 'VIDEO' },
        include: { media: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
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
        totalVideos,
        competitionEntries,
        totalHearts
      },
      standaloneVideos,
      appreciation: appreciationStats
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

    // Check unique constraints
    if (data.username) {
      const existingUser = await prisma.user.findUnique({ where: { username: data.username } });
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Username is already taken');
      }
    }
    if (data.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: data.email } });
      if (existingEmail && existingEmail.id !== userId) {
        throw new Error('Email is already registered');
      }
    }
    if (data.phone) {
      const existingPhone = await prisma.user.findFirst({ where: { phone: data.phone } });
      if (existingPhone && existingPhone.id !== userId) {
        throw new Error('Phone number is already registered');
      }
    }

    return await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
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

  async getDashboard(userId) {
    try {
      // Aggregate total votes and prize money from submissions
      const submissionsAggregation = await prisma.submission.aggregate({
        where: { userId },
        _sum: {
          votesCount: true,
          prizeMoney: true,
        },
        _count: {
          id: true,
        },
      });

      // Total Competitions (Submissions that are in competition)
      const competitionsCount = await prisma.submission.count({
        where: {
          userId,
          competitionId: { not: null },
        },
      });

      // Get participating competitions
      const participatingSubmissions = await prisma.submission.findMany({
        where: {
          userId,
          competitionId: { not: null },
        },
        include: {
          competition: {
            select: {
              id: true,
              title: true,
              title_pl: true,
              status: true,
              endsAt: true,
            },
          },
          media: {
            select: { url: true, format: true },
            take: 1,
            orderBy: { slotIndex: 'asc' },
          }
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      // Map competitions
      const participatingCompetitions = participatingSubmissions.map(sub => {
        let tag = 'In Review';
        let rankStr = 'Pending...';
        
        if (sub.competitionState === 'ENDED') {
          tag = sub.rank === 1 ? 'Winner' : 'Completed';
          rankStr = sub.rank ? `#${sub.rank} Place` : 'Completed';
        } else if (sub.competitionState === 'IN_COMPETITION') {
          tag = sub.rank ? (sub.rank <= 5 ? 'Top 5%' : 'Active') : 'In Review';
          rankStr = sub.rank ? `#${sub.rank} Place` : 'Pending...';
        }

        return {
          id: sub.competitionId,
          title: sub.competition?.title || 'Unknown Competition',
          title_pl: sub.competition?.title_pl,
          status: sub.competition?.status,
          endsAt: sub.competition?.endsAt,
          coverImage: sub.media && sub.media.length > 0 ? sub.media[0].url : null,
          tag,
          rankStr,
          participantsCount: Math.floor(Math.random() * 1000) + 100 // placeholder since real count needs aggregation
        };
      });

      // Calculate Rank: Best position in any competition
      let currentRank = 0;
      try {
        const bestRankSubmission = await prisma.submission.findFirst({
          where: {
            userId: userId,
            competitionId: { not: null },
            rank: { not: null, gt: 0 }
          },
          orderBy: {
            rank: 'asc'
          },
          select: {
            rank: true
          }
        });
        
        if (bestRankSubmission) {
          currentRank = bestRankSubmission.rank;
        }
      } catch (e) {
        console.error('Error calculating rank:', e);
      }

      return {
        currentRank,
        totalPhotos: submissionsAggregation._count.id || 0,
        totalVotes: submissionsAggregation._sum.votesCount || 0,
        prizesWon: submissionsAggregation._sum.prizeMoney ? Number(submissionsAggregation._sum.prizeMoney) : 0,
        competitionsCount: competitionsCount,
        participatingCompetitions
      };
    } catch (error) {
      throw error;
    }
  }

  async getAdminDashboard() {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentYear = now.getFullYear();

      // Users and Submissions
      const registeredUsers = await prisma.user.count({ where: { role: 'USER' } });
      const photosSubmitted = await prisma.submission.count();
      
      const votesAgg = await prisma.submission.aggregate({
        _sum: { votesCount: true }
      });
      const votesCast = votesAgg._sum.votesCount || 0;

      // Revenues & Commission
      const donationsAgg = await prisma.donation.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amount: true }
      });
      const monthDonationsAgg = await prisma.donation.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: firstDayOfMonth } },
        _sum: { amount: true }
      });
      const donationTotal = Number(donationsAgg._sum.amount || 0);
      const donationMonth = Number(monthDonationsAgg._sum.amount || 0);

      const ordersAgg = await prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { total: true }
      });
      const monthOrdersAgg = await prisma.order.aggregate({
        where: { status: 'PAID', createdAt: { gte: firstDayOfMonth } },
        _sum: { total: true }
      });
      const storeTotal = Number(ordersAgg._sum.total || 0);
      const storeMonth = Number(monthOrdersAgg._sum.total || 0);

      const totalCommission = (donationTotal + storeTotal) * 0.20;
      const thisMonthCommission = (donationMonth + storeMonth) * 0.20;

      const promotedAgg = await prisma.promotedAlbum.aggregate({
        _sum: { amountPaid: true }
      });
      const monthPromotedAgg = await prisma.promotedAlbum.aggregate({
        where: { createdAt: { gte: firstDayOfMonth } },
        _sum: { amountPaid: true }
      });
      const totalPromoted = Number(promotedAgg._sum.amountPaid || 0);
      const thisMonthPromoted = Number(monthPromotedAgg._sum.amountPaid || 0);

      const totalRevenue = totalCommission + totalPromoted;

      const payoutsAgg = await prisma.payout.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true }
      });
      const totalPayouts = Number(payoutsAgg._sum.amount || 0);

      const recentSubmissionsCount = await prisma.submission.count({
        where: { status: 'PENDING' } 
      });
      
      const recentSubmissions = await prisma.submission.findMany({
        where: { status: 'PENDING' },
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, country: true } },
          media: { select: { url: true }, take: 1 }
        }
      });

      const recentCompetition = {
        pendingDecisions: recentSubmissionsCount,
        submissions: recentSubmissions.map(sub => ({
          id: sub.id,
          title: sub.title,
          author: sub.user?.name || 'Unknown',
          country: sub.user?.country || 'Unknown',
          image: sub.media?.[0]?.url || null
        }))
      };

      // Real Data for Revenue Trend
      const donationTrend = await prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "createdAt") as month, COALESCE(SUM(amount), 0) as total
        FROM donations
        WHERE status = 'COMPLETED' AND EXTRACT(YEAR FROM "createdAt") = ${currentYear}
        GROUP BY EXTRACT(MONTH FROM "createdAt")
      `;
      
      const orderTrend = await prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "createdAt") as month, COALESCE(SUM(total), 0) as total
        FROM orders
        WHERE status = 'PAID' AND EXTRACT(YEAR FROM "createdAt") = ${currentYear}
        GROUP BY EXTRACT(MONTH FROM "createdAt")
      `;

      const promotedTrend = await prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "createdAt") as month, COALESCE(SUM("amountPaid"), 0) as total
        FROM promoted_albums
        WHERE EXTRACT(YEAR FROM "createdAt") = ${currentYear}
        GROUP BY EXTRACT(MONTH FROM "createdAt")
      `;

      const cDonationArray = new Array(12).fill(0);
      const cStoreArray = new Array(12).fill(0);
      const promotedArray = new Array(12).fill(0);

      donationTrend.forEach(row => {
        const m = Number(row.month) - 1;
        cDonationArray[m] = Number(row.total) * 0.20;
      });

      orderTrend.forEach(row => {
        const m = Number(row.month) - 1;
        cStoreArray[m] = Number(row.total) * 0.20;
      });

      promotedTrend.forEach(row => {
        const m = Number(row.month) - 1;
        promotedArray[m] = Number(row.total);
      });

      const revenueTrend = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        commissionDonation: cDonationArray,
        commissionStore: cStoreArray,
        promoted: promotedArray
      };

      const topCountriesQuery = await prisma.user.groupBy({
        by: ['country'],
        where: { role: 'USER', country: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 4
      });

      const communityReach = topCountriesQuery.map(c => ({
        country: c.country,
        count: c._count.id
      }));

      return {
        registeredUsers,
        photosSubmitted,
        votesCast,
        totalCommission,
        thisMonthCommission,
        totalPromoted,
        thisMonthPromoted,
        totalRevenue,
        totalPayouts,
        recentCompetition,
        revenueTrend,
        communityReach
      };
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      throw error;
    }
  }

  async getSavedArtworks(userId, skip, take) {
    try {
      const [savedArtworks, total] = await Promise.all([
        prisma.savedArtwork.findMany({
          where: { userId },
          skip,
          take,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            submission: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    name: true,
                    avatar: true
                  }
                },
                media: {
                  select: { url: true, format: true },
                  orderBy: { slotIndex: 'asc' },
                  take: 1
                }
              }
            }
          }
        }),
        prisma.savedArtwork.count({ where: { userId } })
      ]);
      
      const mappedData = savedArtworks
        .filter(item => item.submission)
        .map(item => {
          const art = item.submission;
          return {
            id: art.id,
            kind: art.kind,
            title: art.title,
            title_pl: art.title_pl,
            story: art.story,
            story_pl: art.story_pl,
            viewsCount: art.viewsCount,
            likesCount: art.likesCount,
            votesCount: art.votesCount,
            createdAt: art.createdAt,
            competitionState: art.competitionState,
            status: art.status,
            media: art.media,
            user: art.user,
            isSaved: true
          };
        });

      return { data: mappedData, total };
    } catch (error) {
      throw error;
    }
  }
}
