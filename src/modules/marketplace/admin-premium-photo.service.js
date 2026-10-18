import prisma from '../../config/prisma.js';

export class AdminPremiumPhotoService {
  async getAllPremiumPhotos(skip, take, filters = {}) {
    const where = {};
    if (filters.kind) {
      where.kind = filters.kind;
    }

    if (filters.isPromoted !== undefined) {
      const isProm = filters.isPromoted === 'true' || filters.isPromoted === true;
      const now = new Date();
      if (isProm) {
        where.promotions = {
          some: {
            isActive: true,
            endsAt: { gte: now }
          }
        };
      } else {
        where.promotions = {
          none: {
            isActive: true,
            endsAt: { gte: now }
          }
        };
      }
    }

    const [total, data] = await Promise.all([
      prisma.premiumPhoto.count({ where }),
      prisma.premiumPhoto.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          media: true,
          category: true,
          user: { select: { id: true, name: true, avatar: true, username: true } },
          promotions: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      })
    ]);

    return { total, data };
  }

  async getPremiumPhotoDetails(id) {
    const photo = await prisma.premiumPhoto.findUnique({
      where: { id },
      include: {
        media: true,
        category: true,
        user: { select: { id: true, name: true, avatar: true, username: true } }
      }
    });

    if (!photo) return null;
    return photo;
  }

  async deletePremiumPhoto(id) {
    return await prisma.premiumPhoto.delete({
      where: { id }
    });
  }
}
