import prisma from '../../config/prisma.js';
import fs from 'fs';
import path from 'path';

const PAID_ORDER_STATUSES = [
  'PAID',
  'COMPLETED',
  'PROCESSING',
  'SHIPPED',
  'DISPATCHED',
  'DELIVERED',
];

export class StoreService {
  async createProduct(userId, data, files) {
    let bannerImageUrl = '';
    const otherImageUrls = [];

    if (files['bannerImage'] && files['bannerImage'].length > 0) {
      bannerImageUrl = `/uploads/${files['bannerImage'][0].filename}`;
    }

    if (files['images'] && files['images'].length > 0) {
      files['images'].forEach(file => {
        otherImageUrls.push(`/uploads/${file.filename}`);
      });
    }

    const validEnums = ['ART_PRINTS', 'HANDMADE_CRAFTS', 'APPAREL', 'PHOTOBOOKS', 'DIGITAL_PRESET', 'OTHERS'];
    let category = data.category || 'OTHERS';
    if (!validEnums.includes(category)) {
      // Keep free-text categories in categories[]; enum falls back to OTHERS
      category = 'OTHERS';
    }

    let categories = [];
    if (data.categories) {
      try {
        categories = typeof data.categories === 'string'
          ? JSON.parse(data.categories)
          : data.categories;
      } catch {
        categories = Array.isArray(data.categories) ? data.categories : [data.categories];
      }
    }
    if (!Array.isArray(categories) || categories.length === 0) {
      categories = data.category ? [data.category] : ['OTHERS'];
    }

    return prisma.product.create({
      data: {
        userId,
        category,
        categories,
        title: data.title,
        title_pl: data.title_pl || null,
        description: data.description || null,
        description_pl: data.description_pl || null,
        price: data.price,
        setEditionSize: data.setEditionSize || null,
        bannerImage: bannerImageUrl,
        images: otherImageUrls,
        country: data.country || null,
        city: data.city || null,
        shippingScope: data.shippingScope || 'WORLDWIDE',
      },
    });
  }

  async getAllProducts(filters, skip = 0, take = 10, currentUserId = null) {
    const where = { isActive: true };

    if (filters.category && filters.category.toLowerCase() !== 'all') {
      const cat = filters.category.trim();
      const catUpper = cat.toUpperCase();
      const catSlug = cat.toLowerCase().replace(/\s+/g, '-');
      const catSpaced = cat.replace(/[-_]/g, ' ');
      const searchVariations = Array.from(new Set([cat, catUpper, catSlug, catSpaced]));

      where.OR = [
        { categories: { hasSome: searchVariations } },
        { category: { in: ['ART_PRINTS', 'HANDMADE_CRAFTS', 'APPAREL', 'PHOTOBOOKS', 'DIGITAL_PRESET', 'OTHERS'].includes(catUpper) ? [catUpper] : [] } }
      ];
    }
    
    if (filters.userId) {
      where.userId = filters.userId;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userId: true,
          category: true,
          categories: true,
          title: true,
          title_pl: true,
          description: true,
          description_pl: true,
          bannerImage: true,
          price: true,
          setEditionSize: true,
          country: true,
          city: true,
          shippingScope: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              avatar: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    if (currentUserId && products.length > 0) {
      const saved = await prisma.savedProduct.findMany({
        where: {
          userId: currentUserId,
          productId: { in: products.map(p => p.id) }
        },
        select: { productId: true }
      });
      const savedSet = new Set(saved.map(s => s.productId));
      products.forEach(p => {
        p.isSaved = savedSet.has(p.id);
      });
    } else {
      products.forEach(p => {
        p.isSaved = false;
      });
    }

    return { data: products, total };
  }

  async getProductById(id, currentUserId = null) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true } }
      }
    });

    if (!product) return null;

    if (currentUserId) {
      const saved = await prisma.savedProduct.findUnique({
        where: {
          userId_productId: { userId: currentUserId, productId: id }
        }
      });
      product.isSaved = Boolean(saved);
    } else {
      product.isSaved = false;
    }

    return product;
  }

  async updateProduct(id, userId, data, files) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Product not found');
    if (existing.userId !== userId) throw new Error('Unauthorized');

    const updateData = { ...data };
    if (updateData.categories && typeof updateData.categories === 'string') {
      try {
        updateData.categories = JSON.parse(updateData.categories);
      } catch {
        updateData.categories = [updateData.categories];
      }
    }

    if (files && files['bannerImage'] && files['bannerImage'].length > 0) {
      updateData.bannerImage = `/uploads/${files['bannerImage'][0].filename}`;
      if (existing.bannerImage) {
        const oldFilePath = path.join(process.cwd(), existing.bannerImage);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      }
    }
    if (files && files['images'] && files['images'].length > 0) {
      const otherImageUrls = [];
      files['images'].forEach(file => {
        otherImageUrls.push(`/uploads/${file.filename}`);
      });
      updateData.images = otherImageUrls;
      if (existing.images && existing.images.length > 0) {
        existing.images.forEach(img => {
          const oldFilePath = path.join(process.cwd(), img);
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        });
      }
    }

    return prisma.product.update({ where: { id }, data: updateData });
  }

  async deleteProduct(id, userId) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Product not found');
    if (existing.userId !== userId) throw new Error('Unauthorized');

    if (existing.bannerImage) {
      const oldFilePath = path.join(process.cwd(), existing.bannerImage);
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    }
    if (existing.images && existing.images.length > 0) {
      existing.images.forEach(img => {
        const oldFilePath = path.join(process.cwd(), img);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      });
    }

    return prisma.product.delete({ where: { id } });
  }

  async promoteProduct(id, userId, durationDays) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.userId !== userId) {
      throw new Error('Product not found or unauthorized');
    }

    const amountPaid = 0;
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + Number(durationDays || 7));

    const promotion = await prisma.promotedAlbum.upsert({
      where: { productId: id },
      update: {
        durationDays,
        startsAt: new Date(),
        endsAt,
        amountPaid,
        isActive: true
      },
      create: {
        productId: id,
        userId,
        durationDays,
        startsAt: new Date(),
        endsAt,
        amountPaid,
        isActive: true
      }
    });

    return promotion;
  }

  /**
   * Public marketplace stores.
   * Sort: promoted stores first, then best-selling (paid order qty), then rest.
   * Pagination happens AFTER that global sort.
   */
  async getPublicStores(filters, skip, take) {
    const { search, promoted } = filters;
    const now = new Date();
    
    const userWhere = {
      products: {
        some: { isActive: true }
      }
    };
    
    if (search) {
      const q = String(search).trim().replace(/^@/, '');
      userWhere.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { products: { some: { title: { contains: q, mode: 'insensitive' } } } },
        { products: { some: { categories: { has: q } } } }
      ];
    }
    
    if (promoted === 'true') {
      userWhere.products.some.promotion = {
        isActive: true,
        endsAt: { gt: now }
      };
    }

    // 1) All matching seller ids (sort before paginating)
    const matchingUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });
    const allIds = matchingUsers.map((u) => u.id);
    const total = allIds.length;

    if (total === 0) {
      return { data: [], total: 0 };
    }

    // 2) Which sellers have an active product promotion
    const promotedRows = await prisma.promotedAlbum.findMany({
      where: {
        userId: { in: allIds },
        productId: { not: null },
        isActive: true,
        endsAt: { gt: now },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const promotedSet = new Set(promotedRows.map((r) => r.userId));

    // 3) Best-seller score = sum of paid order quantities for their products
    const soldItems = await prisma.orderItem.findMany({
      where: {
        productId: { not: null },
        product: { userId: { in: allIds } },
        order: { status: { in: PAID_ORDER_STATUSES } },
      },
      select: {
        quantity: true,
        product: { select: { userId: true } },
      },
    });
    const salesByUser = {};
    for (const item of soldItems) {
      const uid = item.product?.userId;
      if (!uid) continue;
      salesByUser[uid] = (salesByUser[uid] || 0) + Number(item.quantity || 0);
    }

    // 4) Global order: promoted → best-selling → rest
    const rankedIds = [...allIds].sort((a, b) => {
      const aPromo = promotedSet.has(a) ? 1 : 0;
      const bPromo = promotedSet.has(b) ? 1 : 0;
      if (bPromo !== aPromo) return bPromo - aPromo;
      const aSales = salesByUser[a] || 0;
      const bSales = salesByUser[b] || 0;
      if (bSales !== aSales) return bSales - aSales;
      return a.localeCompare(b);
    });

    const pageIds = rankedIds.slice(skip, skip + take);
    if (pageIds.length === 0) {
      return { data: [], total };
    }

    // 5) Hydrate page users + product previews
    const users = await prisma.user.findMany({
      where: { id: { in: pageIds } },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        bio: true,
        products: {
          where: { isActive: true },
          take: 8,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            title_pl: true,
            bannerImage: true,
            price: true,
            country: true,
            city: true,
            shippingScope: true,
            promotion: {
              where: { isActive: true, endsAt: { gt: now } },
              select: { id: true }
            }
          }
        }
      }
    });

    const userById = new Map(users.map((u) => [u.id, u]));

    const appreciationRows = await prisma.artworkAppreciation.groupBy({
      by: ['receiverId', 'tier'],
      where: { receiverId: { in: pageIds } },
      _count: { tier: true },
    });

    const appreciationByUser = {};
    for (const row of appreciationRows) {
      if (!appreciationByUser[row.receiverId]) {
        appreciationByUser[row.receiverId] = {
          gold: 0,
          silver: 0,
          bronze: 0,
        };
      }
      const tierKey = String(row.tier || '').toLowerCase();
      if (tierKey in appreciationByUser[row.receiverId]) {
        appreciationByUser[row.receiverId][tierKey] = row._count.tier;
      }
    }

    // Preserve ranked order
    const formattedData = pageIds
      .map((id) => userById.get(id))
      .filter(Boolean)
      .map((user) => {
        // Prefer promoted products in the preview strip, then newest
        const sortedProducts = [...user.products]
          .sort((a, b) => {
            const aPromo = a.promotion ? 1 : 0;
            const bPromo = b.promotion ? 1 : 0;
            return bPromo - aPromo;
          })
          .slice(0, 4);

        const mappedProducts = sortedProducts.map((p) => ({
          id: p.id,
          title: p.title,
          title_pl: p.title_pl,
          bannerImage: p.bannerImage,
          price: p.price,
          country: p.country || null,
          city: p.city || null,
          shippingScope: p.shippingScope || 'WORLDWIDE',
          isPromoted: Boolean(p.promotion),
        }));

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          bio: user.bio,
          isPromoted: promotedSet.has(user.id),
          totalSales: salesByUser[user.id] || 0,
          artworkAppreciation: appreciationByUser[user.id] || {
            gold: 0,
            silver: 0,
            bronze: 0,
          },
          products: mappedProducts,
        };
      });

    return { data: formattedData, total };
  }

  async toggleWatchlist(userId, productId) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true },
    });

    if (!product) throw new Error('Product not found');
    if (product.userId === userId) {
      throw new Error('Cannot watchlist your own product');
    }

    const existing = await prisma.savedProduct.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });

    if (existing) {
      await prisma.savedProduct.delete({
        where: { id: existing.id },
      });
      return { saved: false };
    }

    await prisma.savedProduct.create({
      data: { userId, productId },
    });
    return { saved: true };
  }

  async getWatchlist(userId, skip = 0, take = 10) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      prisma.savedProduct.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            include: {
              user: {
                select: { id: true, name: true, username: true, avatar: true }
              }
            }
          }
        }
      }),
      prisma.savedProduct.count({ where })
    ]);

    return {
      data: rows.map((row) => ({
        ...row.product,
        isSaved: true,
        savedAt: row.createdAt,
      })),
      total,
    };
  }
}

