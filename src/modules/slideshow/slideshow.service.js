import prisma from '../../config/prisma.js';
import { UrlUtil } from '../../utils/urlUtil.js';
import { TranslateUtil } from '../../utils/translate.js';

export class SlideshowService {
  /**
   * 1. Get logged-in user's uploaded images across Competitions, Gallery (Profile), and Sell Photos (Marketplace).
   * Used by frontend to pick and order images when creating a slideshow.
   * Default pagination: page 1, limit 15 ("prothome 15 ta image then load more e ager 15 tar sathe aro 15 ta show hobe").
   */
  async getMyUploadImages(userId, query = {}, req = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 15));
    const offset = (page - 1) * limit;
    const source = (query.source || 'ALL').toUpperCase();

    const includeSubmissions = ['ALL', 'COMPETITION', 'GALLERY'].includes(source);
    const includePremium = ['ALL', 'PREMIUM', 'SELL'].includes(source);

    const unionCount = [];
    const unionData = [];
    const params = [userId];

    if (includeSubmissions) {
      let stateCond = `(s."competitionState" = 'IN_COMPETITION' OR s."competitionState" = 'PROFILE_ONLY')`;
      if (source === 'COMPETITION') {
        stateCond = `s."competitionState" = 'IN_COMPETITION'`;
      } else if (source === 'GALLERY') {
        stateCond = `s."competitionState" = 'PROFILE_ONLY'`;
      }

      unionCount.push(`
        SELECT sm.id
        FROM submission_media sm
        INNER JOIN submissions s ON sm."submissionId" = s.id
        WHERE sm.kind = 'IMAGE'
          AND s."userId" = $1
          AND s.status = 'APPROVED'
          AND ${stateCond}
      `);

      unionData.push(`
        SELECT
          sm.id AS "id",
          sm.url AS "url",
          s.title AS "title",
          CASE
            WHEN s."competitionState" = 'IN_COMPETITION' THEN 'COMPETITION'
            WHEN s."competitionState" = 'PROFILE_ONLY' THEN 'GALLERY'
            ELSE 'SUBMISSION'
          END AS "source",
          sm."createdAt" AS "createdAt"
        FROM submission_media sm
        INNER JOIN submissions s ON sm."submissionId" = s.id
        WHERE sm.kind = 'IMAGE'
          AND s."userId" = $1
          AND s.status = 'APPROVED'
          AND ${stateCond}
      `);
    }

    if (includePremium) {
      unionCount.push(`
        SELECT pm.id
        FROM premium_photo_media pm
        INNER JOIN premium_photos p ON pm."premiumPhotoId" = p.id
        WHERE pm.kind = 'IMAGE'
          AND p."userId" = $1
          AND p."isActive" = true
      `);

      unionData.push(`
        SELECT
          pm.id AS "id",
          pm.url AS "url",
          p.title AS "title",
          'PREMIUM' AS "source",
          pm."createdAt" AS "createdAt"
        FROM premium_photo_media pm
        INNER JOIN premium_photos p ON pm."premiumPhotoId" = p.id
        WHERE pm.kind = 'IMAGE'
          AND p."userId" = $1
          AND p."isActive" = true
      `);
    }

    if (unionCount.length === 0) {
      return {
        images: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 1,
          hasNext: false,
          hasMore: false,
          hasPrevious: false
        }
      };
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM (
        ${unionCount.join(' UNION ALL ')}
      ) t
    `;

    const dataSql = `
      ${unionData.join(' UNION ALL ')}
      ORDER BY "createdAt" DESC
      LIMIT $2 OFFSET $3
    `;

    const [[countResult], rows] = await Promise.all([
      prisma.$queryRawUnsafe(countSql, ...params),
      prisma.$queryRawUnsafe(dataSql, userId, limit, offset)
    ]);

    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const formattedImages = rows.map((row) => ({
      mediaId: row.id,
      url: UrlUtil.getAbsoluteUrl(req, row.url),
      source: row.source,
      title: row.title
    }));

    return {
      images: formattedImages,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  /**
   * 2. Create a new slideshow with selected ordered images.
   * Multiple slideshows can be created by a user.
   */
  async createSlideshow(userId, data = {}, req = {}) {
    const title = (data.name || data.title || '').trim();
    const coverImage = data.coverImage || null;
    const items = data.items;

    if (!title) {
      throw new Error('Slideshow name is required');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Please select at least one photo for the slideshow');
    }

    // Sort items by user's chosen order (order: 1, 2, 3...)
    const sortedItems = [...items].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : (a.sortOrder !== undefined ? a.sortOrder : 0);
      const orderB = b.order !== undefined ? b.order : (b.sortOrder !== undefined ? b.sortOrder : 0);
      return orderA - orderB;
    });

    // Batch lookup all missing URLs in ONE parallel round-trip instead of sequential N queries
    const missingUrlIds = sortedItems.filter(it => !it.url && it.mediaId).map(it => it.mediaId);
    const mediaMap = new Map();

    if (missingUrlIds.length > 0) {
      const [subMediaList, premMediaList] = await Promise.all([
        prisma.submissionMedia.findMany({
          where: { id: { in: missingUrlIds } },
          include: { submission: { select: { title: true, competitionState: true } } }
        }),
        prisma.premiumPhotoMedia.findMany({
          where: { id: { in: missingUrlIds } },
          include: { premiumPhoto: { select: { title: true } } }
        })
      ]);

      for (const sm of subMediaList) {
        mediaMap.set(sm.id, {
          url: sm.url,
          title: sm.submission?.title || null,
          sourceType: sm.submission?.competitionState === 'IN_COMPETITION' ? 'COMPETITION' : 'GALLERY'
        });
      }
      for (const pm of premMediaList) {
        mediaMap.set(pm.id, {
          url: pm.url,
          title: pm.premiumPhoto?.title || null,
          sourceType: 'PREMIUM'
        });
      }
    }

    // Process and resolve items
    const processedItems = sortedItems.map((it, idx) => {
      const meta = mediaMap.get(it.mediaId) || {};
      const url = it.url || meta.url;

      if (!url) {
        throw new Error(`Valid photo URL or mediaId required for item at index ${idx}`);
      }

      const sortOrder = it.order !== undefined 
        ? parseInt(it.order) 
        : (it.sortOrder !== undefined ? parseInt(it.sortOrder) : idx + 1);

      return {
        mediaId: it.mediaId || null,
        sourceType: it.sourceType || it.source || meta.sourceType || null,
        url,
        title: it.title || meta.title || null,
        sortOrder
      };
    });

    // Determine coverImage (user-provided or first photo in order)
    const finalCoverImage = coverImage || processedItems[0]?.url || null;

    const slideshow = await prisma.slideshow.create({
      data: {
        userId,
        title: title.trim(),
        title_pl: data.title_pl || null,
        description: data.description?.trim() || null,
        description_pl: data.description_pl || null,
        coverImage: finalCoverImage,
        itemsCount: processedItems.length,
        items: {
          create: processedItems
        }
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' }
        },
        user: {
          select: { id: true, name: true, username: true, avatar: true }
        }
      }
    });

    // Translate to Polish in background without blocking the HTTP response
    if (!data.title_pl || (data.description && !data.description_pl)) {
      Promise.all([
        !data.title_pl ? TranslateUtil.translateText(title, 'pl', 'en') : Promise.resolve(null),
        data.description && !data.description_pl ? TranslateUtil.translateText(data.description, 'pl', 'en') : Promise.resolve(null)
      ]).then(async ([titlePl, descPl]) => {
        if (titlePl || descPl) {
          await prisma.slideshow.update({
            where: { id: slideshow.id },
            data: {
              ...(titlePl ? { title_pl: titlePl } : {}),
              ...(descPl ? { description_pl: descPl } : {})
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    return this._formatSlideshow(slideshow, req);
  }

  /**
   * 3. Get all slideshows created by the logged-in user (authenticated via token).
   */
  async getMySlideshows(userId, query = {}, req = {}) {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      prisma.slideshow.count({ where: { userId } }),
      prisma.slideshow.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            take: 4 // preview thumbnails
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      slideshows: records.map((s) => this._formatSlideshow(s, req)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  /**
   * 4. Get all slideshows of another photographer by their username.
   */
  async getUserSlideshows(username, query = {}, req = {}) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, name: true, username: true, avatar: true }
    });

    if (!user) {
      return null;
    }

    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      prisma.slideshow.count({ where: { userId: user.id } }),
      prisma.slideshow.findMany({
        where: { userId: user.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            take: 4
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        avatar: user.avatar ? UrlUtil.getAbsoluteUrl(req, user.avatar) : null
      },
      slideshows: records.map((s) => this._formatSlideshow(s, req)),
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasMore: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  /**
   * 5. Get full details of a specific slideshow by ID (used for playback).
   */
  async getSlideshowById(id, req = {}) {
    const slideshow = await prisma.slideshow.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatar: true }
        },
        items: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!slideshow) {
      return null;
    }

    return this._formatSlideshow(slideshow, req);
  }

  /**
   * 6. Update a slideshow (title, description, coverImage, or reorder/replace items).
   */
  async updateSlideshow(id, userId, data = {}, req = {}) {
    const existing = await prisma.slideshow.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Slideshow not found');
    }
    if (existing.userId !== userId) {
      throw new Error('Unauthorized to modify this slideshow');
    }

    const updateData = {};
    if (data.title) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.coverImage) updateData.coverImage = data.coverImage;

    if (Array.isArray(data.items) && data.items.length > 0) {
      // Replace items in transaction
      const sorted = [...data.items].sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : (a.sortOrder !== undefined ? a.sortOrder : 0);
        const orderB = b.order !== undefined ? b.order : (b.sortOrder !== undefined ? b.sortOrder : 0);
        return orderA - orderB;
      });

      const processedItems = sorted.map((it, idx) => ({
        slideshowId: id,
        mediaId: it.mediaId || null,
        sourceType: it.sourceType || it.source || null,
        url: it.url,
        thumbnailUrl: it.thumbnailUrl || it.url,
        title: it.title || null,
        sortOrder: it.order !== undefined ? parseInt(it.order) : (it.sortOrder !== undefined ? parseInt(it.sortOrder) : idx + 1)
      }));

      await prisma.$transaction([
        prisma.slideshowItem.deleteMany({ where: { slideshowId: id } }),
        prisma.slideshowItem.createMany({ data: processedItems }),
        prisma.slideshow.update({
          where: { id },
          data: {
            ...updateData,
            itemsCount: processedItems.length,
            ...(data.coverImage ? {} : { coverImage: processedItems[0]?.url })
          }
        })
      ]);
    } else {
      await prisma.slideshow.update({
        where: { id },
        data: updateData
      });
    }

    return this.getSlideshowById(id, req);
  }

  /**
   * 7. Delete a slideshow.
   */
  async deleteSlideshow(id, userId) {
    const existing = await prisma.slideshow.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Slideshow not found');
    }
    if (existing.userId !== userId) {
      throw new Error('Unauthorized to delete this slideshow');
    }

    await prisma.slideshow.delete({ where: { id } });
    return true;
  }

  /**
   * Helper to format all URLs to absolute URLs and apply language
   */
  _formatSlideshow(slideshow, req = {}) {
    if (!slideshow) return slideshow;
    const isPl = req.headers?.['accept-language']?.includes('pl');
    const name = (isPl && slideshow.title_pl) ? slideshow.title_pl : slideshow.title;

    const formatted = {
      ...slideshow,
      name,
      title: name,
      description: (isPl && slideshow.description_pl) ? slideshow.description_pl : slideshow.description,
      coverImage: slideshow.coverImage ? UrlUtil.getAbsoluteUrl(req, slideshow.coverImage) : null
    };

    if (formatted.user) {
      formatted.user = {
        ...formatted.user,
        avatar: formatted.user.avatar ? UrlUtil.getAbsoluteUrl(req, formatted.user.avatar) : null
      };
    }

    if (Array.isArray(formatted.items)) {
      formatted.items = formatted.items.map((item) => {
        const itemObj = { ...item };
        itemObj.url = UrlUtil.getAbsoluteUrl(req, item.url);
        delete itemObj.thumbnailUrl;
        return itemObj;
      });
    }

    return formatted;
  }

  /**
   * Summary counts for slideshow categories
   */
  async getSlideshowStats() {
    const [compCount, galleryCount, premCount, totalCreatedSlideshows] = await Promise.all([
      prisma.submissionMedia.count({
        where: {
          kind: 'IMAGE',
          submission: {
            status: 'APPROVED',
            visibility: 'PUBLIC',
            competitionState: 'IN_COMPETITION'
          }
        }
      }),
      prisma.submissionMedia.count({
        where: {
          kind: 'IMAGE',
          submission: {
            status: 'APPROVED',
            visibility: 'PUBLIC',
            competitionState: 'PROFILE_ONLY'
          }
        }
      }),
      prisma.premiumPhotoMedia.count({
        where: {
          kind: 'IMAGE',
          premiumPhoto: {
            isActive: true
          }
        }
      }),
      prisma.slideshow.count()
    ]);

    return {
      totalImages: compCount + galleryCount + premCount,
      competitionImages: compCount,
      galleryImages: galleryCount,
      premiumImages: premCount,
      totalSlideshows: totalCreatedSlideshows
    };
  }
}

export const slideshowService = new SlideshowService();
