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
    
    // Can add user id filtering or search filtering if needed

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
}
