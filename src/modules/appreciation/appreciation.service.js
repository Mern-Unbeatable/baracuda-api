import prisma from '../../config/prisma.js';

export function getWeekStart(d = new Date()) {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay(); // 0 is Sunday
  date.setUTCDate(date.getUTCDate() - day);
  return date;
}

export function getDaysUntilSundayReset(d = new Date()) {
  const now = new Date(d);
  const day = now.getUTCDay();
  // Days until next Sunday midnight
  const daysUntilNextSunday = (7 - day) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilNextSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);
  const diffMs = nextSunday.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export class AppreciationService {
  /**
   * Get all-time counts and current viewer weekly quota status
   */
  async getAppreciationStats(receiverId, viewerId = null) {
    if (!receiverId) return null;

    // 1. Group by tier for all-time totals
    const counts = await prisma.artworkAppreciation.groupBy({
      by: ['tier'],
      where: { receiverId },
      _count: { tier: true }
    });

    const goldCount = counts.find(c => c.tier === 'GOLD')?._count.tier || 0;
    const silverCount = counts.find(c => c.tier === 'SILVER')?._count.tier || 0;
    const bronzeCount = counts.find(c => c.tier === 'BRONZE')?._count.tier || 0;
    const totalAll = goldCount + silverCount + bronzeCount;

    // 2. Viewer weekly status (strictly 1 appreciation per photographer per week)
    const currentWeekStart = getWeekStart();
    const resetInDays = getDaysUntilSundayReset();

    let myAward = null;
    let hasAwardedThisWeek = false;

    if (viewerId && viewerId !== receiverId) {
      const existingAward = await prisma.artworkAppreciation.findFirst({
        where: {
          senderId: viewerId,
          receiverId,
          weekStart: currentWeekStart
        },
        select: { tier: true }
      });

      if (existingAward) {
        myAward = existingAward.tier;
        hasAwardedThisWeek = true;
      }
    }

    return {
      gold: goldCount,
      silver: silverCount,
      bronze: bronzeCount,
      total: totalAll,
      hasAwardedThisWeek,
      myAward,
      canAward: !hasAwardedThisWeek && !!viewerId && viewerId !== receiverId,
      resetInDays
    };
  }

  /**
   * Award an appreciation (GOLD, SILVER, BRONZE) to a photographer
   */
  async awardAppreciation(senderId, payload) {
    const { receiverId, username, submissionId, tier } = payload;

    const normalizedTier = tier?.toUpperCase();
    if (!['GOLD', 'SILVER', 'BRONZE'].includes(normalizedTier)) {
      throw new Error('Invalid appreciation tier. Allowed values: GOLD, SILVER, BRONZE');
    }

    // Resolve target photographer
    let targetUserId = receiverId;
    if (!targetUserId && username) {
      const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
      if (!user) throw new Error('Photographer not found');
      targetUserId = user.id;
    } else if (!targetUserId && submissionId) {
      const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { userId: true } });
      if (!sub) throw new Error('Artwork not found');
      targetUserId = sub.userId;
    }

    if (!targetUserId) {
      throw new Error('receiverId, username, or submissionId is required');
    }

    if (senderId === targetUserId) {
      throw new Error('You cannot award appreciation to your own profile or artwork');
    }

    const currentWeekStart = getWeekStart();

    // Check if user has already awarded ANY appreciation to this photographer this week
    const existing = await prisma.artworkAppreciation.findUnique({
      where: {
        senderId_receiverId_weekStart: {
          senderId,
          receiverId: targetUserId,
          weekStart: currentWeekStart
        }
      }
    });

    if (existing) {
      throw new Error(`You have already awarded ${existing.tier} to this photographer this week. You can only give 1 appreciation per photographer per week. Awards reset every Sunday at midnight.`);
    }

    // Create record
    const appreciation = await prisma.artworkAppreciation.create({
      data: {
        senderId,
        receiverId: targetUserId,
        submissionId: submissionId || null,
        tier: normalizedTier,
        weekStart: currentWeekStart
      }
    });

    // Notify receiver
    try {
      const sender = await prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true, username: true }
      });
      const senderName = sender?.name || sender?.username || 'A photographer';

      await prisma.notification.create({
        data: {
          userId: targetUserId,
          type: 'USER',
          title: `New ${normalizedTier} Camera Appreciation!`,
          title_pl: `Nowe wyróżnienie ${normalizedTier}!`,
          body: `${senderName} awarded you a ${normalizedTier} camera appreciation!`,
          body_pl: `${senderName} przyznał Ci wyróżnienie ${normalizedTier}!`,
          linkUrl: `/profile/${sender?.username || ''}`
        }
      });
    } catch (err) {
      console.warn('Failed to send appreciation notification:', err.message);
    }

    // Return updated stats
    const stats = await this.getAppreciationStats(targetUserId, senderId);
    return {
      appreciation,
      stats
    };
  }
}

export const appreciationService = new AppreciationService();
