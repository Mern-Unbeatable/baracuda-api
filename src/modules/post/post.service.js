import prisma from '../../config/prisma.js';
import fs from 'fs';
import path from 'path';

export class PostService {
  async createPost(userId, body, mediaFile, copyrightConfirmed) {
    let mediaUrl = null;
    let mediaType = null;

    if (mediaFile) {
      mediaUrl = `/uploads/${mediaFile.filename}`;
      mediaType = mediaFile.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';
    }

    return prisma.photographerMessage.create({
      data: {
        userId,
        body,
        mediaUrl,
        mediaType,
        copyrightConfirmed
      },
      include: {
        user: {
          select: { name: true, avatar: true }
        }
      }
    });
  }

  async getPosts(userId, skip = 0, limit = 10) {
    // Determine the query
    let whereClause = {};
    if (userId) {
      whereClause.userId = userId;
    }

    const [total, posts] = await Promise.all([
      prisma.photographerMessage.count({ where: whereClause }),
      prisma.photographerMessage.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, avatar: true } }
        }
      })
    ]);

    return { total, posts };
  }

  async getPostById(id, userId) {
    return prisma.photographerMessage.findFirst({
      where: { id, userId },
      include: {
        user: { select: { name: true, avatar: true } }
      }
    });
  }

  async updatePost(id, userId, data, mediaFile) {
    const existing = await prisma.photographerMessage.findFirst({
      where: { id, userId }
    });
    if (!existing) throw new Error('Post not found');

    const updateData = { ...data };

    if (mediaFile) {
      updateData.mediaUrl = `/uploads/${mediaFile.filename}`;
      updateData.mediaType = mediaFile.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE';
      
      // Delete old file if exists
      if (existing.mediaUrl) {
        const oldFilePath = path.join(process.cwd(), existing.mediaUrl);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      }
    }

    return prisma.photographerMessage.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { name: true, avatar: true } }
      }
    });
  }

  async deletePost(id, userId) {
    const existing = await prisma.photographerMessage.findFirst({
      where: { id, userId }
    });
    if (!existing) throw new Error('Post not found');

    if (existing.mediaUrl) {
      const oldFilePath = path.join(process.cwd(), existing.mediaUrl);
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
    }

    return prisma.photographerMessage.delete({
      where: { id }
    });
  }
}
