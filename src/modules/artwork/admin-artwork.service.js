import prisma from '../../config/prisma.js';
import { UrlUtil } from '../../utils/urlUtil.js';

export class AdminArtworkService {
  /**
   * Get all artworks with optional filter for competitionState
   */
  async getAllArtworks(skip, take, filters = {}) {
    const where = {
      status: 'APPROVED'
    };

    if (filters.kind) {
      where.kind = filters.kind;
    }

    if (filters.competitionState) {
      where.competitionState = filters.competitionState; // IN_COMPETITION, PROFILE_ONLY, ENDED
    }

    if (filters.isPromoted !== undefined) {
      const isProm = filters.isPromoted === 'true' || filters.isPromoted === true;
      if (isProm) {
        where.promotion = { isNot: null, isActive: true };
      } else {
        where.promotion = null;
      }
    }

    const [total, artworks] = await Promise.all([
      prisma.submission.count({ where }),
      prisma.submission.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          media: true,
          category: true,
          promotion: true,
          user: { select: { id: true, name: true, avatar: true, username: true } }
        }
      })
    ]);

    return { total, data: artworks };
  }

  /**
   * Get artwork details including comments and global rankings for the user
   */
  async getArtworkDetails(id) {
    const artwork = await prisma.submission.findUnique({
      where: { id },
      include: {
        media: true,
        category: true,
        user: { select: { id: true, name: true, avatar: true, username: true, bio: true, city: true, country: true } }
      }
    });

    if (!artwork) return null;

    // Get Comments
    const comments = await prisma.comment.findMany({
      where: { submissionId: id, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatar: true, isVerified: true } }
      }
    });

    // Calculate Artwork's Rank and Top Rankings only if it's in competition
    let artworkRankInCompetition = null;
    let globalRankings = undefined;

    if (artwork.competitionState === 'IN_COMPETITION') {
      const higherVotedArtworks = await prisma.submission.count({
        where: {
          competitionState: 'IN_COMPETITION',
          status: 'APPROVED',
          votesCount: { gt: artwork.votesCount }
        }
      });
      artworkRankInCompetition = higherVotedArtworks + 1;

      // Get Competition Rankings (Top 5 Artworks in Current Competition)
      const topArtworks = await prisma.submission.findMany({
        where: {
          competitionState: 'IN_COMPETITION',
          status: 'APPROVED'
        },
        orderBy: { votesCount: 'desc' },
        take: 5,
        include: {
          user: { select: { id: true, name: true, avatar: true } }
        }
      });

      globalRankings = topArtworks.map((sub, index) => ({
        rank: index + 1,
        photographer: sub.user?.name || 'Unknown',
        avatar: sub.user?.avatar || null,
        totalVotes: sub.votesCount || 0,
        isCurrentArtwork: sub.id === artwork.id
      }));

      // If the current artwork is in competition but not in the top 5, append it at the bottom
      if (artworkRankInCompetition > 5) {
        globalRankings.push({
          rank: artworkRankInCompetition,
          photographer: artwork.user?.name || 'Unknown',
          avatar: artwork.user?.avatar || null,
          totalVotes: artwork.votesCount || 0,
          isCurrentArtwork: true
        });
      }
    }

    let subcategory = null;
    if (artwork.subcategoryId) {
      subcategory = await prisma.category.findUnique({
        where: { id: artwork.subcategoryId },
        select: { id: true, name: true, name_pl: true, slug: true }
      });
    }

    return {
      ...artwork,
      categoryName: artwork.category?.name || null,
      subcategoryName: subcategory?.name || null,
      subcategory,
      artworkRankInCompetition,
      comments,
      globalRankings
    };
  }

  /**
   * Delete an artwork
   */
  async deleteArtwork(id) {
    const artwork = await prisma.submission.findUnique({
      where: { id }
    });

    if (!artwork) {
      throw new Error('Artwork not found');
    }

    return await prisma.submission.delete({
      where: { id }
    });
  }
}
