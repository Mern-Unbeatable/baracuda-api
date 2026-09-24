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

    const extractedData = data.map((report) => {
      let reportedUser = null;
      let itemTitle = 'Unknown Item';
      let itemType = 'Unknown';
      let itemId = null;

      if (report.submission) {
        reportedUser = report.submission.user;
        itemTitle = report.submission.body || 'No description';
        itemType = report.submission.kind === 'SINGLE' ? 'single photo' : (report.submission.kind === 'SIX' ? '6 photos' : '12 photos zodiac story');
        itemId = report.submission.id;
      } else if (report.premiumPhoto) {
        reportedUser = report.premiumPhoto.user;
        itemTitle = report.premiumPhoto.description || 'No description';
        itemType = report.premiumPhoto.kind === 'SINGLE' ? 'single premium photo' : (report.premiumPhoto.kind === 'SIX' ? '6 premium photos' : '12 premium photos');
        itemId = report.premiumPhoto.id;
      } else if (report.post) {
        reportedUser = report.post.user;
        itemTitle = report.post.body || 'No description';
        itemType = 'post';
        itemId = report.post.id;
      }

      if (itemTitle.length > 30) {
        itemTitle = itemTitle.substring(0, 27) + '...';
      }

      return { reportedUser, itemTitle, itemType, itemId };
    });

    const uniqueUsers = [...new Map(extractedData.filter(d => d.reportedUser).map(d => [d.reportedUser.id, d.reportedUser])).values()];
    
    const countsPromises = uniqueUsers.map(async (u) => {
      const count = await prisma.report.count({
        where: {
          OR: [
            { submission: { userId: u.id } },
            { premiumPhoto: { userId: u.id } },
            { post: { userId: u.id } }
          ]
        }
      });
      return { userId: u.id, count };
    });
    const countsArray = await Promise.all(countsPromises);
    const countMap = Object.fromEntries(countsArray.map(c => [c.userId, c.count]));

    const formattedData = data.map((report, index) => {
      const { reportedUser, itemTitle, itemType, itemId } = extractedData[index];
      
      return {
        id: report.id,
        reportedBy: report.user.name,
        reportedItem: itemTitle,
        type: itemType,
        reason: report.reason,
        reportedUser: reportedUser ? {
          id: reportedUser.id,
          name: reportedUser.name,
          username: reportedUser.username,
          reportsCount: countMap[reportedUser.id] || 0
        } : null,
        reportedDate: report.createdAt,
        status: report.status,
        targetItemId: itemId
      };
    });

    return { total, data: formattedData };
  }


  async getReportDetails(reportId) {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, email: true, role: true, username: true, bio: true, city: true, country: true }
        },
        submission: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true, username: true, status: true, bio: true, city: true, country: true } },
            media: true,
            category: true
          }
        },
        premiumPhoto: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true, username: true, status: true, bio: true, city: true, country: true } },
            media: true,
            category: true
          }
        },
        post: {
          include: {
            user: { select: { id: true, name: true, avatar: true, email: true, username: true, status: true, bio: true, city: true, country: true } }
          }
        }
      }
    });

    if (!report) return null;

    let reportedUser = null;
    let itemDetails = null;

    if (report.submission) {
      reportedUser = report.submission.user;
      itemDetails = {
        id: report.submission.id,
        title: report.submission.title,
        body: report.submission.story,
        category: report.submission.category ? report.submission.category.name : null,
        kind: report.submission.kind,
        resolution: report.submission.resolution,
        quality: report.submission.quality,
        format: report.submission.format,
        createdAt: report.submission.createdAt,
        media: report.submission.media,
        votes: report.submission.votesCount,
        views: report.submission.viewsCount
      };
    } else if (report.premiumPhoto) {
      reportedUser = report.premiumPhoto.user;
      itemDetails = {
        id: report.premiumPhoto.id,
        title: report.premiumPhoto.title,
        body: report.premiumPhoto.story,
        category: report.premiumPhoto.category ? report.premiumPhoto.category.name : null,
        kind: report.premiumPhoto.kind,
        resolution: report.premiumPhoto.resolution,
        quality: report.premiumPhoto.quality,
        format: report.premiumPhoto.format,
        createdAt: report.premiumPhoto.createdAt,
        media: report.premiumPhoto.media,
        votes: report.premiumPhoto.likesCount,
        views: report.premiumPhoto.viewsCount
      };
    } else if (report.post) {
      reportedUser = report.post.user;
      itemDetails = {
        id: report.post.id,
        title: { en: 'Post', bn: 'পোস্ট' },
        body: report.post.body,
        category: 'General',
        kind: 'POST',
        resolution: null,
        quality: null,
        format: null,
        createdAt: report.post.createdAt,
        media: [],
        votes: 0,
        views: 0
      };
    }

    let reportsCount = 0;
    let warningsCount = 0;
    if (reportedUser) {
      reportsCount = await prisma.report.count({
        where: {
          OR: [
            { submission: { userId: reportedUser.id } },
            { premiumPhoto: { userId: reportedUser.id } },
            { post: { userId: reportedUser.id } }
          ]
        }
      });
      warningsCount = await prisma.moderationAudit.count({
        where: { userId: reportedUser.id, action: 'WARN' }
      });
    }

    return {
      id: report.id,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt,
      reporter: report.user,
      reportedUser: reportedUser ? {
        ...reportedUser,
        reportsCount,
        warningsCount
      } : null,
      reportedItem: itemDetails
    };
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
             await tx.photographerMessage.delete({ where: { id: targetItemId } });
          }
          await tx.notification.create({
            data: {
              userId: targetUserId,
              type: 'SYSTEM',
              title: { en: 'Content Removed', bn: 'কন্টেন্ট রিমুভ করা হয়েছে' },
              body: { 
                en: 'Your content was removed due to a violation of our community guidelines.',
                bn: 'আমাদের কমিউনিটি গাইডলাইন ভঙ্গের কারণে আপনার কন্টেন্ট রিমুভ করা হয়েছে।'
              }
            }
          });
          break;
        case 'WARN':
          // Warning logged in ModerationAudit + Send Notification
          await tx.notification.create({
            data: {
              userId: targetUserId,
              type: 'SYSTEM',
              title: { en: 'Official Warning', bn: 'অফিসিয়াল সতর্কবার্তা' },
              body: { 
                en: 'You have received an official warning for violating our community guidelines. Further violations may result in account suspension.',
                bn: 'কমিউনিটি গাইডলাইন ভঙ্গের কারণে আপনাকে সতর্ক করা হচ্ছে। পরবর্তীতে অ্যাকাউন্ট সাসপেন্ড হতে পারে।'
              }
            }
          });
          break;
        case 'SUSPEND':
          const thirtyDaysLater = new Date();
          thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
          
          await tx.user.update({
            where: { id: targetUserId },
            data: { 
              status: 'SUSPENDED',
              suspensionEndsAt: thirtyDaysLater
            }
          });
          
          await tx.notification.create({
            data: {
              userId: targetUserId,
              type: 'SYSTEM',
              title: { en: 'Account Suspended', bn: 'অ্যাকাউন্ট সাসপেন্ড' },
              body: { 
                en: 'Your account has been suspended for 30 days due to community guideline violations.',
                bn: 'কমিউনিটি গাইডলাইন ভঙ্গের কারণে আপনার অ্যাকাউন্ট ৩০ দিনের জন্য সাসপেন্ড করা হয়েছে।'
              }
            }
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
