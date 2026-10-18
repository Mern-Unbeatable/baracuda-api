import prisma from '../../config/prisma.js';

export class AdminPromotionService {
  /**
   * Get all promoted items (Artworks, Sell Photos, Products) with filtering, pagination, and summary statistics.
   */
  async getAllPromotions(filters = {}, skip = 0, take = 10) {
    const now = new Date();
    const where = {};

    // 1. Filter by Type (ARTWORK, SELL / PREMIUM_PHOTO, PRODUCT)
    if (filters.type) {
      const typeUpper = filters.type.toUpperCase();
      if (typeUpper === 'ARTWORK') {
        where.submissionId = { not: null };
      } else if (typeUpper === 'SELL' || typeUpper === 'PREMIUM_PHOTO' || typeUpper === 'SELL_PHOTO') {
        where.premiumPhotoId = { not: null };
      } else if (typeUpper === 'PRODUCT') {
        where.productId = { not: null };
      }
    }

    // 2. Filter by Status (ACTIVE, EXPIRED)
    if (filters.status) {
      const statusUpper = filters.status.toUpperCase();
      if (statusUpper === 'ACTIVE') {
        where.isActive = true;
        where.endsAt = { gte: now };
      } else if (statusUpper === 'EXPIRED') {
        where.OR = [
          { isActive: false },
          { endsAt: { lt: now } }
        ];
      }
    }

    // 3. Search Filter
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { submission: { title: { contains: q, mode: 'insensitive' } } },
            { premiumPhoto: { title: { contains: q, mode: 'insensitive' } } },
            { product: { title: { contains: q, mode: 'insensitive' } } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { user: { username: { contains: q, mode: 'insensitive' } } }
          ]
        }
      ];
    }

    // 4. Fetch Summary Statistics
    const [
      totalCount,
      activeCount,
      expiredCount,
      artworkCount,
      sellCount,
      revenueAgg,
      promotions
    ] = await Promise.all([
      prisma.promotedAlbum.count({ where }),
      prisma.promotedAlbum.count({ where: { isActive: true, endsAt: { gte: now } } }),
      prisma.promotedAlbum.count({ where: { OR: [{ isActive: false }, { endsAt: { lt: now } }] } }),
      prisma.promotedAlbum.count({ where: { submissionId: { not: null } } }),
      prisma.promotedAlbum.count({ where: { premiumPhotoId: { not: null } } }),
      prisma.promotedAlbum.aggregate({ _sum: { amountPaid: true } }),
      prisma.promotedAlbum.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              avatar: true
            }
          },
          submission: {
            include: {
              media: true,
              category: { select: { id: true, name: true, name_pl: true } }
            }
          },
          premiumPhoto: {
            include: {
              media: true,
              category: { select: { id: true, name: true, name_pl: true } }
            }
          },
          product: true
        }
      })
    ]);

    const summary = {
      totalPromotions: totalCount,
      activePromotions: activeCount,
      expiredPromotions: expiredCount,
      totalArtworkPromotions: artworkCount,
      totalSellPhotoPromotions: sellCount,
      totalRevenue: Number(revenueAgg._sum.amountPaid || 0)
    };

    return {
      summary,
      total: totalCount,
      data: promotions
    };
  }

  /**
   * Get single promotion details by ID
   */
  async getPromotionById(id) {
    return await prisma.promotedAlbum.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            avatar: true,
            country: true,
            city: true
          }
        },
        submission: {
          include: {
            media: true,
            category: true
          }
        },
        premiumPhoto: {
          include: {
            media: true,
            category: true
          }
        },
        product: true
      }
    });
  }

  /**
   * Toggle or update promotion active status
   */
  async updatePromotionStatus(id, isActive) {
    return await prisma.promotedAlbum.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
      include: {
        user: { select: { id: true, name: true, email: true } }
      }
    });
  }
}
