import prisma from '../../config/prisma.js';
import { ZipArchive } from 'archiver';
import fs from 'fs';
import path from 'path';

import { TranslateUtil } from '../../utils/translate.js';
import { appreciationService } from '../appreciation/appreciation.service.js';

export class ArtworkService {
  async createArtwork(userId, data, mediaFiles, sourceLang = 'en', tx = prisma) {
    const translationPromises = [];
    // TRANSLATION LOGIC FOR STRING FIELDS
    if (data.title) {
      if (sourceLang === 'pl') {
        data.title_pl = data.title;
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'en', 'pl').then(res => { data.title = res; })
        );
      } else {
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'pl', 'en').then(res => { data.title_pl = res; })
        );
      }
    }

    if (data.story) {
      if (sourceLang === 'pl') {
        data.story_pl = data.story;
        translationPromises.push(
          TranslateUtil.translateText(data.story, 'en', 'pl').then(res => { data.story = res; })
        );
      } else {
        translationPromises.push(
          TranslateUtil.translateText(data.story, 'pl', 'en').then(res => { data.story_pl = res; })
        );
      }
    }
    
    if (translationPromises.length > 0) {
      await Promise.all(translationPromises);
    }

    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      if (sourceLang === 'pl') {
        data.tags_pl = [...data.tags];
        data.tags = await Promise.all(data.tags.map(t => TranslateUtil.translateText(t, 'en', 'pl')));
      } else {
        data.tags_pl = await Promise.all(data.tags.map(t => TranslateUtil.translateText(t, 'pl', 'en')));
      }
    }
    const albumTypePromise = tx.albumType.findUnique({
      where: { kind: data.kind }
    });

    const activeCompPromise = data.competitionState === 'IN_COMPETITION'
      ? tx.competition.findFirst({
          where: { status: 'OPEN' },
          orderBy: { startsAt: 'desc' }
        })
      : Promise.resolve(null);

    const [albumType, activeComp] = await Promise.all([albumTypePromise, activeCompPromise]);

    if (!albumType) {
      throw new Error(`AlbumType configuration for '${data.kind}' not found. Admin needs to create it.`);
    }

    let activeCompetitionId = activeComp ? activeComp.id : null;

    const ZODIAC_SIGNS = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];

    // Separate images and videos correctly
    const images = mediaFiles.filter(f => !f.mimetype.startsWith('video'));
    const videos = mediaFiles.filter(f => f.mimetype.startsWith('video'));

    // Remove fields from data that are not in Prisma schema for Submission
    const zodiacSignsArray = data.zodiacSigns;
    delete data.zodiacSigns;

    const getZodiacMapping = (index) => {
      if (data.kind === 'SINGLE') {
        return { zodiacSign: data.zodiacSign || null, slotIndex: 0 };
      }
      // If user provides custom array of zodiacSigns matching files order
      if (zodiacSignsArray && Array.isArray(zodiacSignsArray) && zodiacSignsArray[index]) {
        return { zodiacSign: zodiacSignsArray[index], slotIndex: index };
      }
      if (data.kind === 'SIX' && data.theme === 'RED') {
        return { zodiacSign: ZODIAC_SIGNS[index] || null, slotIndex: index }; // 0 to 5
      }
      if (data.kind === 'SIX' && data.theme === 'BLUE') {
        return { zodiacSign: ZODIAC_SIGNS[index + 6] || null, slotIndex: index + 6 }; // 6 to 11
      }
      if (data.kind === 'TWELVE') {
        return { zodiacSign: ZODIAC_SIGNS[index] || null, slotIndex: index }; // 0 to 11
      }
      return { zodiacSign: null, slotIndex: index };
    };

    // Create submission and media in a transaction
    const submission = await tx.submission.create({
      data: {
        ...data,
        albumTypeId: albumType.id,
        competitionId: activeCompetitionId,
        userId,
        status: 'APPROVED',
        prizeMoney: data.competitionState === 'IN_COMPETITION' ? albumType.prizeMoney : null,
        media: {
          create: [
            ...images.map((file, index) => {
              const mapping = getZodiacMapping(index);
              return {
                url: file.filename ? `/uploads/${file.filename}` : '',
                kind: 'IMAGE',
                slotIndex: mapping.slotIndex,
                zodiacSign: mapping.zodiacSign,
                format: file.mimetype,
                bytes: file.size,
              };
            }),
            ...videos.map((file, index) => ({
              url: file.filename ? `/uploads/${file.filename}` : '',
              kind: 'VIDEO',
              slotIndex: 99 + index, // Videos go at the end
              zodiacSign: null,
              format: file.mimetype,
              bytes: file.size,
            }))
          ]
        }
      },
      include: {
        media: true,
      }
    });
    return submission;
  }

  async getAllArtworks(userId, filters = {}, sort = 'newest', skip = 0, take = 10) {
    const where = { userId };
    
    if (filters.kind && filters.kind.toLowerCase() !== 'all') {
      // filters.kind is expected to map to AlbumKind enum (SINGLE, SIX, TWELVE)
      where.kind = filters.kind.toUpperCase();
    }
    
    if (filters.status && filters.status.toLowerCase() !== 'all') {
      where.competitionState = filters.status.toUpperCase();
    }
    
    if (filters.promoted === 'true') {
      where.promotion = { isNot: null };
    }

    // Fetch ALL matching submissions for this user to apply complex custom sorting
    // We omit the separate .count() query to save a full database round trip and speed up response
    const allSubmissions = await prisma.submission.findMany({
      where,
      select: {
        id: true,
        kind: true,
        competitionState: true,
        title: true,
        title_pl: true,
        story: true,
        story_pl: true,
        viewsCount: true,
        likesCount: true,
        votesCount: true,
        zodiacSign: true,
        rank: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { name: true, name_pl: true }
        },
        competition: {
          select: { title: true, title_pl: true, status: true, endsAt: true }
        },
        promotion: {
          select: { endsAt: true }
        },
        media: {
          select: { url: true, format: true, zodiacSign: true, slotIndex: true, kind: true },
          orderBy: { slotIndex: 'asc' }
        }
      }
    });

    // Custom sorting logic required by product
    const statePriority = {
      'IN_COMPETITION': 1,
      'PROFILE_ONLY': 2,
      'ENDED': 3
    };

    allSubmissions.sort((a, b) => {
      // 1. First priority: Competition State
      const pA = statePriority[a.competitionState] || 99;
      const pB = statePriority[b.competitionState] || 99;
      
      if (pA !== pB) return pA - pB;
      
      // 2. Second priority: Created Date (newest or oldest)
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      
      return sort === 'oldest' ? (timeA - timeB) : (timeB - timeA);
    });

    // Apply pagination after custom sorting
    const paginatedSubmissions = allSubmissions.slice(skip, skip + take);

    return {
      data: paginatedSubmissions,
      total: allSubmissions.length
    };
  }

  async downloadArtworkAsZip(id, res) {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { media: true }
    });
    
    if (!submission) {
      throw new Error('Artwork not found');
    }
    
    if (!submission.media || submission.media.length === 0) {
      throw new Error('No media files found for this artwork');
    }

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="Artwork-${id}.zip"`
    });

    const archive = new ZipArchive({
      zlib: { level: 9 } // Sets the compression level
    });

    archive.on('error', (err) => {
      throw err;
    });

    // Pipe archive data to the response
    archive.pipe(res);

    for (const media of submission.media) {
      // media.url usually looks like '/uploads/filename.jpg'
      // We need to map it to absolute filesystem path
      const filePath = path.join(process.cwd(), media.url);
      
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        let zipFileName = '';
        
        if (media.kind === 'VIDEO') {
          zipFileName = `VIDEO${ext}`;
        } else {
          // Name the file based on zodiac sign, otherwise fallback to slot index
          zipFileName = media.zodiacSign ? `${media.zodiacSign}${ext}` : `IMAGE_${media.slotIndex}${ext}`;
        }
        
        archive.file(filePath, { name: zipFileName });
      }
    }

    await archive.finalize();
  }

  async getArtworkDetails(id) {
    return prisma.submission.findUnique({
      where: { id },
      include: {
        media: true,
        competition: true,
        promotion: true,
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true
          }
        }
      }
    });
  }

  async deleteArtwork(id, userId) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.userId !== userId) {
      throw new Error('Artwork not found or unauthorized');
    }
    return prisma.submission.delete({
      where: { id }
    });
  }

  async updateArtwork(id, userId, data, sourceLang = 'en') {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.userId !== userId) {
      throw new Error('Artwork not found or unauthorized');
    }

    const translationPromises = [];
    if (data.title) {
      if (sourceLang === 'pl') {
        data.title_pl = data.title;
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'en', 'pl').then(res => { data.title = res; })
        );
      } else {
        translationPromises.push(
          TranslateUtil.translateText(data.title, 'pl', 'en').then(res => { data.title_pl = res; })
        );
      }
    }

    if (data.story !== undefined) {
      if (data.story === null || data.story === '') {
        data.story = null;
        data.story_pl = null;
      } else {
        if (sourceLang === 'pl') {
          data.story_pl = data.story;
          translationPromises.push(
            TranslateUtil.translateText(data.story, 'en', 'pl').then(res => { data.story = res; })
          );
        } else {
          translationPromises.push(
            TranslateUtil.translateText(data.story, 'pl', 'en').then(res => { data.story_pl = res; })
          );
        }
      }
    }
    
    if (translationPromises.length > 0) {
      await Promise.all(translationPromises);
    }

    if (data.tags !== undefined) {
      if (!data.tags || (Array.isArray(data.tags) && data.tags.length === 0)) {
        data.tags = [];
        data.tags_pl = [];
      } else if (Array.isArray(data.tags) && data.tags.length > 0) {
        if (sourceLang === 'pl') {
          data.tags_pl = [...data.tags];
          data.tags = await Promise.all(data.tags.map(t => TranslateUtil.translateText(t, 'en', 'pl')));
        } else {
          data.tags_pl = await Promise.all(data.tags.map(t => TranslateUtil.translateText(t, 'pl', 'en')));
        }
      }
    }

    return prisma.submission.update({
      where: { id },
      data
    });
  }

  async promoteArtwork(id, userId, durationDays) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.userId !== userId) {
      throw new Error('Artwork not found or unauthorized');
    }
    
    let amountPaid = 0;
    if (durationDays === 7) amountPaid = 40;
    else if (durationDays === 15) amountPaid = 60;
    else if (durationDays === 30) amountPaid = 100;
    else throw new Error('Invalid promotion duration. Must be 7, 15, or 30 days.');

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const promotion = await prisma.promotedAlbum.upsert({
      where: { submissionId: submission.id },
      update: {
        durationDays,
        startsAt: new Date(),
        endsAt,
        amountPaid,
        isActive: true
      },
      create: {
        submissionId: submission.id,
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

  async switchToCompetition(id, userId) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.userId !== userId) {
      throw new Error('Artwork not found or unauthorized');
    }
    if (submission.competitionState !== 'PROFILE_ONLY') {
      throw new Error('Artwork is already in a competition or has ended');
    }

    const activeComp = await prisma.competition.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startsAt: 'desc' }
    });
    
    if (!activeComp) {
      throw new Error('No active competition available to join right now');
    }

    // Clear any existing likes because it's now in a competition
    await prisma.like.deleteMany({ where: { submissionId: id } });

    return prisma.submission.update({
      where: { id },
      data: {
        competitionState: 'IN_COMPETITION',
        competitionId: activeComp.id,
        likesCount: 0
      }
    });
  }

  async resubmitArtwork(id, userId) {
    const submission = await prisma.submission.findUnique({ 
      where: { id },
      include: { media: true } 
    });
    
    if (!submission || submission.userId !== userId) {
      throw new Error('Artwork not found or unauthorized');
    }
    
    if (submission.competitionState !== 'ENDED' && submission.competitionState !== 'REJECTED') {
      throw new Error('Only ENDED or REJECTED artworks can be resubmitted');
    }

    const activeComp = await prisma.competition.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startsAt: 'desc' }
    });
    
    if (!activeComp) {
      throw new Error('No active competition available to join right now');
    }

    const newSubmissionData = {
      userId: submission.userId,
      competitionId: activeComp.id,
      albumTypeId: submission.albumTypeId,
      categoryId: submission.categoryId,
      subcategoryId: submission.subcategoryId,
      kind: submission.kind,
      theme: submission.theme,
      zodiacSign: submission.zodiacSign,
      visibility: submission.visibility,
      status: 'PENDING',
      competitionState: 'IN_COMPETITION',
      title: submission.title,
      title_pl: submission.title_pl,
      story: submission.story,
      story_pl: submission.story_pl,
      tags: submission.tags,
      camera: submission.camera,
      resolution: submission.resolution,
      format: submission.format,
      isAiGenerated: submission.isAiGenerated,
      quality: submission.quality,
      copyrightConfirmed: submission.copyrightConfirmed
    };
    newSubmissionData.commentsCount = 0;
    newSubmissionData.points = 0;
    newSubmissionData.rank = null;

    const newSubmission = await prisma.submission.create({
      data: {
        ...newSubmissionData,
        media: {
          create: submission.media.map(m => {
            const mediaData = { ...m };
            delete mediaData.id;
            delete mediaData.submissionId;
            delete mediaData.createdAt;
            return mediaData;
          })
        }
      },
      include: { media: true }
    });

    return newSubmission;
  }

  async getPublicArtworks(filters, sort, skip, take, viewerId = null) {
    // Only fetch APPROVED artworks globally
    const where = { status: 'APPROVED' };
    if (filters.status && filters.status.toUpperCase() !== 'ALL') {
      where.competitionState = filters.status.toUpperCase();
    }
    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }
    if (filters.subcategoryId) {
      where.subcategoryId = filters.subcategoryId;
    }
    
    let orderBy = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { viewsCount: 'desc' };
    } else if (sort === 'most_liked') {
      orderBy = { likesCount: 'desc' };
    }
    
    const now = new Date();
    
    // Conditions for active promotion vs unpromoted
    const activePromoCondition = { isActive: true, endsAt: { gt: now } };
    const promotedWhere = { ...where, promotion: activePromoCondition };
    // For unpromoted, it can either have no promotion, or an inactive/expired one
    const unpromotedWhere = { 
      ...where, 
      OR: [
        { promotion: null },
        { promotion: { isNot: activePromoCondition } }
      ]
    };

    const select = {
      id: true,
      kind: true,
      title: true,
      title_pl: true,
      story: true,
      story_pl: true,
      viewsCount: true,
      likesCount: true,
      votesCount: true,
      createdAt: true,
      competitionState: true,
      status: true,
      media: {
        select: { url: true, format: true, kind: true, slotIndex: true },
        orderBy: { slotIndex: 'asc' }
      },
      user: { select: { id: true, name: true, avatar: true } },
      category: { select: { name: true, name_pl: true } },
      ...(viewerId && { saves: { where: { userId: viewerId }, select: { id: true } } })
    };

    const [promotedCount, unpromotedCount] = await Promise.all([
      prisma.submission.count({ where: promotedWhere }),
      prisma.submission.count({ where: unpromotedWhere })
    ]);

    const total = promotedCount + unpromotedCount;
    let rawData = [];

    if (skip < promotedCount) {
      const promotedTake = Math.min(take, promotedCount - skip);
      const promotedData = await prisma.submission.findMany({
        where: promotedWhere, select, orderBy, skip, take: promotedTake
      });
      rawData = rawData.concat(promotedData);

      if (rawData.length < take && unpromotedCount > 0) {
        const unpromotedData = await prisma.submission.findMany({
          where: unpromotedWhere, select, orderBy, skip: 0, take: take - rawData.length
        });
        rawData = rawData.concat(unpromotedData);
      }
    } else {
      const unpromotedData = await prisma.submission.findMany({
        where: unpromotedWhere, select, orderBy, skip: skip - promotedCount, take
      });
      rawData = rawData.concat(unpromotedData);
    }
    
    const data = rawData.map(item => {
      const formatted = { ...item };
      if (viewerId) {
        formatted.isSaved = item.saves && item.saves.length > 0;
        delete formatted.saves;
      }
      return formatted;
    });

    return { data, total, skip, take };
  }


  async getPublicArtworkDetails(id, viewerId) {
    const artwork = await prisma.submission.findUnique({
      where: { id, status: 'APPROVED' },
      include: {
        media: { orderBy: { slotIndex: 'asc' } },
        user: { select: { id: true, name: true, username: true, avatar: true } },
        category: { select: { id: true, name: true, name_pl: true } },
        comments: {
          include: { user: { select: { id: true, name: true, username: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!artwork) {
      throw new Error('Artwork not found or not approved');
    }

    // Handle unique view counting
    if (viewerId) {
      try {
        await prisma.submissionView.create({
          data: { submissionId: id, viewerId }
        });
        // If create succeeds, it means this viewerId hasn't viewed this submission before
        await prisma.submission.update({
          where: { id },
          data: { viewsCount: { increment: 1 } }
        });
        artwork.viewsCount += 1;
      } catch (err) {
        // Unique constraint violation (P2002) means they already viewed it, ignore.
      }
    }

    // Fetch photographer appreciation stats for this artwork
    const validViewerUserId = (viewerId && typeof viewerId === 'string' && viewerId.length === 36 && viewerId.includes('-')) ? viewerId : null;
    const appreciationStats = await appreciationService.getAppreciationStats(artwork.user.id, validViewerUserId);

    return {
      ...artwork,
      appreciation: appreciationStats
    };
  }

  async voteArtwork(id, userId, ipAddress) {
    const submission = await prisma.submission.findUnique({ 
      where: { id },
      include: { competition: true }
    });
    
    if (!submission || submission.competitionState !== 'IN_COMPETITION') {
      throw new Error('Can only vote for artworks currently in competition');
    }
    
    // Check if the competition has ended
    if (!submission.competition || submission.competition.status !== 'OPEN') {
      throw new Error('Voting is closed. This competition has already ended.');
    }

    if (submission.userId === userId) {
      throw new Error('You cannot vote for your own artwork');
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const existingVote = await prisma.vote.findUnique({
      where: {
        ipAddress_submissionId: {
          ipAddress,
          submissionId: id
        }
      }
    });

    if (existingVote) {
      // User is trying to unvote
      await prisma.vote.delete({ where: { id: existingVote.id } });
      const updated = await prisma.submission.update({
        where: { id },
        data: { votesCount: { decrement: 1 } }
      });
      return { voted: false, votesCount: updated.votesCount };
    }

    // Create new vote
    await prisma.vote.create({
      data: {
        submissionId: id,
        userId,
        ipAddress,
        kind: submission.kind,
        year,
        month
      }
    });
    
    const updated = await prisma.submission.update({
      where: { id },
      data: { votesCount: { increment: 1 } }
    });
    
    return { voted: true, votesCount: updated.votesCount };
  }

  async toggleLikeArtwork(id, userId) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.competitionState !== 'PROFILE_ONLY') {
      throw new Error('Can only like artworks that are profile only');
    }

    const existingLike = await prisma.like.findUnique({
      where: { submissionId_userId: { submissionId: id, userId } }
    });

    if (existingLike) {
      await prisma.like.delete({ where: { id: existingLike.id } });
      const updated = await prisma.submission.update({
        where: { id },
        data: { likesCount: { decrement: 1 } }
      });
      return { liked: false, likesCount: updated.likesCount };
    } else {
      await prisma.like.create({
        data: { submissionId: id, userId }
      });
      const updated = await prisma.submission.update({
        where: { id },
        data: { likesCount: { increment: 1 } }
      });
      return { liked: true, likesCount: updated.likesCount };
    }
  }

  async toggleSaveArtwork(id, userId) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) throw new Error('Artwork not found');
    if (submission.userId === userId) throw new Error('You cannot save your own artwork');

    const existingSave = await prisma.savedArtwork.findUnique({
      where: { submissionId_userId: { submissionId: id, userId } }
    });

    if (existingSave) {
      await prisma.savedArtwork.delete({ where: { id: existingSave.id } });
      return { saved: false };
    } else {
      await prisma.savedArtwork.create({
        data: { submissionId: id, userId }
      });
      return { saved: true };
    }
  }

  async addComment(id, userId, body, body_pl, parentId) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) throw new Error('Artwork not found');

    if (submission.userId === userId && !parentId) {
      throw new Error('You cannot comment on your own artwork, but you can reply to other comments');
    }

    const status = (submission.userId === userId) ? 'APPROVED' : 'PENDING';

    const comment = await prisma.comment.create({
      data: {
        publicCode: `cmt_${Math.random().toString(36).substr(2, 9)}`,
        submissionId: id,
        userId,
        body,
        body_pl,
        parentId,
        status
      },
      include: { user: { select: { id: true, name: true, avatar: true } } }
    });

    await prisma.submission.update({
      where: { id },
      data: { commentsCount: { increment: 1 } }
    });

    return comment;
  }

  async reportArtwork(id, userId, reason, details) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission) {
      throw new Error('Artwork not found');
    }
    if (submission.userId === userId) {
      throw new Error('You cannot report your own artwork');
    }

    return prisma.report.create({
      data: {
        submissionId: id,
        userId,
        reason,
        details
      }
    });
  }
}
