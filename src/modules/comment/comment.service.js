import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class CommentService {
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
      // Find the title based on locale if it's a JSON field, default to english
      const titleObj = comment.submission?.title || {};
      const title = titleObj.en || titleObj[Object.keys(titleObj)[0]] || 'Untitled';
      
      const typeObj = comment.submission?.albumType?.name || comment.submission?.category?.name || {};
      const type = typeObj.en || typeObj[Object.keys(typeObj)[0]] || 'Unknown';

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

    const titleObj = comment.submission?.title || {};
    const title = titleObj.en || titleObj[Object.keys(titleObj)[0]] || 'Untitled';
    const typeObj = comment.submission?.albumType?.name || comment.submission?.category?.name || {};
    const type = typeObj.en || typeObj[Object.keys(typeObj)[0]] || 'Unknown';

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
