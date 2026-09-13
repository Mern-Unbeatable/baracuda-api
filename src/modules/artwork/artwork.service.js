import prisma from '../../config/prisma.js';

export class ArtworkService {
  async createArtwork(userId, data, mediaFiles) {
    const albumTypePromise = prisma.albumType.findUnique({
      where: { kind: data.kind }
    });

    const activeCompPromise = data.competitionState === 'IN_COMPETITION'
      ? prisma.competition.findFirst({
          where: { status: 'OPEN' },
          orderBy: { startsAt: 'desc' }
        })
      : Promise.resolve(null);

    const [albumType, activeComp] = await Promise.all([albumTypePromise, activeCompPromise]);

    if (!albumType) {
      throw new Error(`AlbumType configuration for '${data.kind}' not found. Admin needs to create it.`);
    }

    let activeCompetitionId = activeComp ? activeComp.id : null;

    // Create submission and media in a transaction
    const submission = await prisma.submission.create({
      data: {
        ...data,
        albumTypeId: albumType.id,
        competitionId: activeCompetitionId,
        userId,
        status: 'APPROVED',
        media: {
          create: mediaFiles.map((file, index) => ({
            url: file.filename ? `/uploads/${file.filename}` : '', // normalize path to relative
            kind: file.mimetype && file.mimetype.startsWith('video') ? 'VIDEO' : 'IMAGE',
            slotIndex: index,
            zodiacSign: file.zodiacSign || null,
            format: file.mimetype,
            bytes: file.size,
          }))
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
        story: true,
        viewsCount: true,
        likesCount: true,
        votesCount: true,
        rank: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: { name: true }
        },
        competition: {
          select: { title: true, status: true, endsAt: true }
        },
        promotion: {
          select: { endsAt: true }
        },
        media: {
          select: { url: true, format: true },
          orderBy: { slotIndex: 'asc' },
          take: 1
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

  async getArtworkDetails(id) {
    return prisma.submission.findUnique({
      where: { id },
      include: {
        media: true,
        competition: true,
        promotion: true,
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

  async updateArtwork(id, userId, data) {
    const submission = await prisma.submission.findUnique({ where: { id } });
    if (!submission || submission.userId !== userId) {
      throw new Error('Artwork not found or unauthorized');
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

    return prisma.submission.update({
      where: { id },
      data: {
        competitionState: 'IN_COMPETITION',
        competitionId: activeComp.id
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
      story: submission.story,
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
}
