import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class CommentService {
  /**
   * Aggregate counts for admin comment dashboard cards.
   */
  async getCommentStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, approved, pending, hidden, deleted, today] =
      await Promise.all([
        prisma.comment.count(),
        prisma.comment.count({ where: { status: 'APPROVED' } }),
        prisma.comment.count({ where: { status: 'PENDING' } }),
        prisma.comment.count({ where: { status: 'HIDDEN' } }),
        prisma.comment.count({ where: { status: 'DELETED' } }),
        prisma.comment.count({
          where: { createdAt: { gte: startOfToday } },
        }),
      ]);

    return {
      total,
      approved,
      pending,
      hidden,
      deleted,
      today,
      approvedRate:
        total > 0 ? Math.round((approved / total) * 100) : 0,
    };
  }

  /**
   * Get paginated comments with status filtering, formatted for the UI
   */
  async getComments(status, page = 1, limit = 10) {
    const where = {};
    if (status) {
      where.status = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          publicCode: true,
          body: true,
          createdAt: true,
          status: true,
          user: {
            select: {
              name: true,
              avatar: true,
              country: true
            }
          },
          submission: {
            select: {
              title: true,
              featuredImage: true,
              albumType: {
                select: {
                  name: true
                }
              },
              category: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }),
      prisma.comment.count({ where })
    ]);

    // Format the response slightly to match frontend expectations if needed
    const formattedComments = comments.map(comment => {
      // Since title and name are strings now, just take them directly
      const title = comment.submission?.title || 'Untitled';
      const type = comment.submission?.albumType?.name || comment.submission?.category?.name || 'Unknown';

      return {
        commentId: comment.publicCode,
        user: comment.user,
        photo: {
          image: comment.submission?.featuredImage,
          title: title,
          type: type
        },
        comment: comment.body,
        date: comment.createdAt,
        status: comment.status
      };
    });

    return {
      data: formattedComments,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }

  /**
   * Get single comment details including photographer stats
   */
  async getCommentDetails(publicCode) {
    const comment = await prisma.comment.findUnique({
      where: { publicCode },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            country: true
          }
        },
        submission: {
          select: {
            title: true,
            featuredImage: true,
            category: { select: { name: true } },
            albumType: { select: { name: true } }
          }
        }
      }
    });

    if (!comment) {
      throw new Error('Comment not found');
    }

    // Get photographer stats
    const [followersCount, uploadsCount, visitsCount] = await Promise.all([
      prisma.follow.count({ where: { followingId: comment.user.id } }),
      prisma.submission.count({ where: { userId: comment.user.id } }),
      prisma.submission.aggregate({
        where: { userId: comment.user.id },
        _sum: { viewsCount: true }
      })
    ]);

    const title = comment.submission?.title || 'Untitled';
    const type = comment.submission?.albumType?.name || comment.submission?.category?.name || 'Unknown';

    return {
      commentId: comment.publicCode,
      status: comment.status,
      photo: {
        image: comment.submission?.featuredImage,
        title: title,
        type: type
      },
      comment: comment.body,
      photographerProfile: {
        ...comment.user,
        stats: {
          followers: followersCount,
          uploads: uploadsCount,
          visits: visitsCount._sum.viewsCount || 0
        }
      }
    };
  }

  /**
   * Bulk update status for comments
   */
  async bulkUpdateStatus(publicCodes, status) {
    const result = await prisma.comment.updateMany({
      where: {
        publicCode: {
          in: publicCodes
        }
      },
      data: {
        status: status.toUpperCase()
      }
    });

    return {
      updatedCount: result.count
    };
  }
}
