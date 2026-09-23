import prisma from '../../config/prisma.js';

export class AdminReportService {
  async getReportStats() {
    const [total, pending, underReview, resolved] = await Promise.all([
      prisma.report.count(),
      prisma.report.count({ where: { status: 'PENDING' } }),
      prisma.report.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.report.count({ where: { status: 'RESOLVED' } }),
    ]);

    return { total, pending, underReview, resolved };
  }

  async getAllReports(filters, skip, take) {
    const where = {};
    if (filters.status) where.status = filters.status;

    const [total, data] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, avatar: true, email: true, role: true }
          },
          submission: {
            include: {
              user: { select: { id: true, name: true, avatar: true, username: true } },
              media: true
            }
          },
          premiumPhoto: {
            include: {
              user: { select: { id: true, name: true, avatar: true, username: true } },
              media: true
            }
          },
          post: {
            include: {
              user: { select: { id: true, name: true, avatar: true, username: true } }
            }
          }
        }
      })
    ]);

    return { total, data };
  }

  async getReportDetails(reportId) {
    return prisma.report.findUnique({
      where: { id: reportId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, email: true, role: true, username: true }
        },
        submission: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true, username: true } },
            media: true
          }
        },
        premiumPhoto: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true, username: true } },
            media: true
          }
        },
        post: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true, username: true } }
          }
        }
      }
    });
  }

  async updateReportStatus(reportId, status) {
    return prisma.report.update({
      where: { id: reportId },
      data: { status }
    });
  }

  async executeAction(reportId, action, adminId) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    // Find the target user (the one who was reported)
    let targetUserId = null;
    let targetItemId = null;
    let targetType = null;

    if (report.submissionId) {
      const sub = await prisma.submission.findUnique({ where: { id: report.submissionId } });
      if (sub) {
        targetUserId = sub.userId;
        targetItemId = sub.id;
        targetType = 'submission';
      }
    } else if (report.premiumPhotoId) {
      const pp = await prisma.premiumPhoto.findUnique({ where: { id: report.premiumPhotoId } });
      if (pp) {
        targetUserId = pp.userId;
        targetItemId = pp.id;
        targetType = 'premiumPhoto';
      }
    } else if (report.postId) {
      const post = await prisma.photographerMessage.findUnique({ where: { id: report.postId } });
      if (post) {
        targetUserId = post.userId;
        targetItemId = post.id;
        targetType = 'post';
      }
    }

    if (!targetUserId) throw new Error('Reported user not found or target item deleted');

    return prisma.$transaction(async (tx) => {
      // Create Audit Entry
      await tx.moderationAudit.create({
        data: {
          userId: targetUserId,
          adminId,
          action,
          reason: `Action taken for report ${report.id}`
        }
      });

      // Execute Action
      switch (action) {
        case 'CONTENT_REMOVED':
          if (targetType === 'submission') {
             await tx.submission.update({ where: { id: targetItemId }, data: { status: 'REJECTED' } });
          } else if (targetType === 'premiumPhoto') {
             await tx.premiumPhoto.update({ where: { id: targetItemId }, data: { isActive: false } });
          } else if (targetType === 'post') {
             // Hard delete or flag
             await tx.photographerMessage.delete({ where: { id: targetItemId } });
          }
          break;
        case 'WARN':
          // Warning logged in ModerationAudit
          break;
        case 'SUSPEND':
          await tx.user.update({
            where: { id: targetUserId },
            data: { status: 'SUSPENDED' }
          });
          break;
        case 'BAN':
          await tx.user.update({
            where: { id: targetUserId },
            data: { status: 'BANNED' }
          });
          break;
      }

      // Mark report as resolved if action is taken
      if (action !== 'WARN') {
        await tx.report.update({
          where: { id: report.id },
          data: { status: 'RESOLVED' }
        });
      }

      return { success: true, action, targetUserId };
    });
  }

  async getUserAuditHistory(userId) {
    const audits = await prisma.moderationAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const reportsCount = await prisma.report.count({
      where: {
        OR: [
          { submission: { userId } },
          { premiumPhoto: { userId } },
          { post: { userId } }
        ]
      }
    });

    let warnings = 0, suspensions = 0, bans = 0;
    audits.forEach(a => {
      if (a.action === 'WARN') warnings++;
      if (a.action === 'SUSPEND') suspensions++;
      if (a.action === 'BAN') bans++;
    });

    // Also get cases involved (reports where this user is reported)
    const cases = await prisma.report.findMany({
      where: {
        OR: [
          { submission: { userId } },
          { premiumPhoto: { userId } },
          { post: { userId } }
        ]
      },
      select: { id: true, reason: true, createdAt: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    return {
      totalReports: reportsCount,
      warnings,
      suspensions,
      bans,
      history: audits,
      casesInvolved: cases
    };
  }
}
