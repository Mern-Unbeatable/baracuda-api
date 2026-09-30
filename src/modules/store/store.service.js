import prisma from '../../config/prisma.js';
import fs from 'fs';
import path from 'path';

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

    const product = await prisma.product.create({
      data: {
        userId,
        category: data.category,
        title: data.title,
        title_pl: data.title_pl,
        price: data.price,
        setEditionSize: data.setEditionSize || null,
        description: data.description || null,
        description_pl: data.description_pl || null,
        bannerImage: bannerImageUrl,
        images: otherImageUrls,
        isActive: true,
      },
    });

    return product;
  }

  async getAllProducts(filters, skip = 0, take = 10) {
    const where = { isActive: true };

    if (filters.category) {
      where.category = filters.category;
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
          category: true,
          title: true,
          title_pl: true,
          description: true,
          description_pl: true,
          bannerImage: true,
          price: true,
          setEditionSize: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    return { data: products, total };
  }

  async getProductById(id) {
    return prisma.product.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      }
    });
  }

  async updateProduct(id, userId, data, files) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Product not found');
    if (existing.userId !== userId) throw new Error('Unauthorized');

    const updateData = { ...data };

    if (files && files['bannerImage'] && files['bannerImage'].length > 0) {
      updateData.bannerImage = `/uploads/${files['bannerImage'][0].filename}`;
      // delete old banner image
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
      // The requirement doesn't specify if it appends or replaces, typically we replace
      updateData.images = otherImageUrls;
      
      // Delete old images
      if (existing.images && existing.images.length > 0) {
        existing.images.forEach(img => {
          const oldFilePath = path.join(process.cwd(), img);
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        });
      }
    }

    return prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, avatar: true } }
      }
    });
  }

  async deleteProduct(id, userId) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new Error('Product not found');
    if (existing.userId !== userId) throw new Error('Unauthorized');

    // Delete associated files
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
    
    let amountPaid = 0;
    if (durationDays === 7) amountPaid = 40;
    else if (durationDays === 15) amountPaid = 60;
    else if (durationDays === 30) amountPaid = 100;
    else throw new Error('Invalid promotion duration. Must be 7, 15, or 30 days.');

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const promotion = await prisma.promotedAlbum.upsert({
      where: { productId: product.id },
      update: {
        durationDays,
        startsAt: new Date(),
        endsAt,
        amountPaid,
        isActive: true
      },
      create: {
        productId: product.id,
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

  async getPublicStores(filters, skip, take) {
    const { search, promoted } = filters;
    
    const userWhere = {
      products: {
        some: { isActive: true }
      }
    };
    
    if (search) {
      userWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { products: { some: { title: { contains: search, mode: 'insensitive' } } } },
        { products: { some: { category: { equals: search } } } }
      ];
    }
    
    if (promoted === 'true') {
      userWhere.products.some.promotion = {
        isActive: true,
        endsAt: { gt: new Date() }
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        skip,
        take,
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
          _count: {
            select: {
              premiumPhotos: true,
              submissions: true,
              followers: true
            }
          },
          products: {
            where: { isActive: true },
            take: 4,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              title: true,
              bannerImage: true,
              price: true,
              promotion: {
                where: { isActive: true, endsAt: { gt: new Date() } },
                select: { id: true }
              }
            }
          }
        }
      }),
      prisma.user.count({ where: userWhere })
    ]);

    const formattedData = users.map(user => {
      const isPromoted = user.products.some(p => p.promotion !== null);
      
      const artworkAppreciation = {
        premiumPhotos: user._count.premiumPhotos,
        submissions: user._count.submissions,
        followers: user._count.followers
      };

      const mappedProducts = user.products.map(p => ({
        id: p.id,
        title: p.title,
        bannerImage: p.bannerImage,
        price: p.price
      }));

      return {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        isPromoted,
        artworkAppreciation,
        products: mappedProducts
      };
    });

    if (!promoted) {
      formattedData.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0));
    }

    return { data: formattedData, total };
  }
}
