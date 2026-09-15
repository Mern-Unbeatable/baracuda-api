import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class CompetitionService {
  /**
   * Automatically start a new competition for the current month if it doesn't exist
   */
  async startMonthlyCompetition() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1; // 1-12

    // Check if competition already exists for this year and month
    let competition = await prisma.competition.findUnique({
      where: {
        year_month: { year, month }
      }
    });

    if (!competition) {
      // First day of current month (UTC)
      const startsAt = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
      // First day of next month minus 1 millisecond = end of current month
      const endsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 1);
      
      const monthName = now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

      competition = await prisma.competition.create({
        data: {
          title: {
            en: `${monthName} ${year} Competition`
          },
          year,
          month,
          status: 'OPEN',
          startsAt,
          endsAt,
          timezone: 'UTC'
        }
      });
      console.log(`[CompetitionService] Started new competition: ${competition.id} for ${monthName} ${year}`);
    } else if (competition.status === 'UPCOMING') {
      // Activate it if it was upcoming
      competition = await prisma.competition.update({
        where: { id: competition.id },
        data: { status: 'OPEN' }
      });
      console.log(`[CompetitionService] Activated upcoming competition: ${competition.id}`);
    }

    return competition;
  }

  /**
   * Finalize the past month's competition, generate Top 10 rankings, and mark the Winners.
   * Expected to run shortly after midnight on the 1st of the new month.
   */
  async processMonthlyCompetitions() {
    const now = new Date();
    
    // Find all OPEN competitions whose endsAt time has passed
    const endedCompetitions = await prisma.competition.findMany({
      where: {
        status: 'OPEN',
        endsAt: { lt: now }
      }
    });

    for (const comp of endedCompetitions) {
      console.log(`[CompetitionService] Finalizing competition ${comp.id}...`);

      // 1. Mark as CLOSED
      await prisma.competition.update({
        where: { id: comp.id },
        data: { status: 'CLOSED' }
      });

      // 2. Aggregate Top 10 for each AlbumKind
      const kinds = ['SINGLE', 'SIX', 'TWELVE'];

      for (const kind of kinds) {
        // Find top 10 submissions in this competition for this kind
        const topSubmissions = await prisma.submission.findMany({
          where: {
            competitionId: comp.id,
            kind: kind,
            status: 'APPROVED' // Only approved artworks can win
          },
          orderBy: {
            votesCount: 'desc'
          },
          take: 10
        });

        // Insert into Winner table
        let rank = 1;
        for (const sub of topSubmissions) {
          if (sub.votesCount > 0) { // Only rank if they have at least 1 vote
            await prisma.winner.create({
              data: {
                competitionId: comp.id,
                submissionId: sub.id,
                userId: sub.userId,
                kind: sub.kind,
                rank: rank,
                isWinner: rank === 1, // #1 is the winner
                votes: sub.votesCount,
                points: sub.points // Optional, could map points based on rank
              }
            });
            rank++;
          }
        }
      }
      
      console.log(`[CompetitionService] Finished generating leaderboard for competition ${comp.id}.`);
    }

    // After finalizing past ones, ensure the current month is started
    await this.startMonthlyCompetition();
  }

  /**
   * Unified method to fetch competitions based on year and month.
   * If year and month are not provided, it fetches the current ongoing competition.
   * If kind is provided, it returns the leaderboard for that specific AlbumKind within the competition.
   * If kind is not provided, it just returns the competition details.
   */
  async getCompetitions({ year, month, kind }) {
    let competition;
    
    // 1. Resolve Competition
    if (year && month) {
      competition = await prisma.competition.findUnique({
        where: { year_month: { year, month } }
      });
      if (!competition) {
        return { competition: null, leaderboard: [] };
      }
    } else {
      competition = await prisma.competition.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startsAt: 'desc' }
      });
      
      if (!competition) {
        competition = await this.startMonthlyCompetition();
      }
    }

    // 2. Fetch Leaderboard if 'kind' is requested
    let leaderboard = null;
    if (kind) {
      if (competition.status === 'CLOSED') {
        // Fetch from finalized winners table
        leaderboard = await prisma.winner.findMany({
          where: {
            competitionId: competition.id,
            kind
          },
          orderBy: {
            rank: 'asc'
          },
          include: {
            user: { select: { id: true, name: true, avatar: true } },
            submission: {
              select: {
                id: true, title: true, featuredImage: true,
                media: { where: { slotIndex: 0 }, take: 1 }
              }
            }
          }
        });
      } else {
        // Fetch real-time from submissions for ongoing competition
        const topSubmissions = await prisma.submission.findMany({
          where: {
            competitionId: competition.id,
            kind,
            status: 'APPROVED'
          },
          orderBy: { votesCount: 'desc' },
          take: 10,
          include: {
            user: { select: { id: true, name: true, avatar: true } },
            media: { where: { slotIndex: 0 }, take: 1 }
          }
        });
        
        // Format to match Winner table output structure
        leaderboard = topSubmissions.map((sub, index) => ({
          id: `live-${sub.id}`,
          competitionId: competition.id,
          submissionId: sub.id,
          userId: sub.userId,
          kind: sub.kind,
          rank: index + 1,
          isWinner: index === 0 && sub.votesCount > 0, // In real-time, #1 is winning if they have votes
          votes: sub.votesCount,
          points: sub.points,
          createdAt: new Date(),
          user: sub.user,
          submission: {
            id: sub.id,
            title: sub.title,
            featuredImage: sub.featuredImage,
            media: sub.media
          }
        })).filter(winner => winner.votes > 0); // Only show people with at least 1 vote
      }
    }
    
    return {
      competition,
      leaderboard
    };
  }

  /**
   * Fetch paginated winners for the Winners Archive page.
   * Can filter by kind (SINGLE, SIX, TWELVE), and specific month/year.
   * If kind is not provided (or 'ALL'), it fetches winners from all categories.
   */
  async getWinnersArchive({ year, month, kind, page = 1, limit = 10 }) {
    let competitionId;

    if (year && month) {
      const competition = await prisma.competition.findUnique({
        where: { year_month: { year, month } }
      });
      // If competition not found for that month, return empty result
      if (!competition) {
        return { data: [], meta: PaginationUtil.getMetadata(0, page, limit) };
      }
      competitionId = competition.id;
    }

    const where = {};
    
    // Filter by specific competition if requested, otherwise only show winners from CLOSED competitions
    if (competitionId) {
      where.competitionId = competitionId;
    } else {
      where.competition = { status: 'CLOSED' };
    }
    
    // Only show top 3 winners
    where.rank = { lte: 3 };
    
    // Filter by kind (if provided and not 'ALL')
    if (kind && kind.toUpperCase() !== 'ALL') {
      where.kind = kind.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [winners, total] = await Promise.all([
      prisma.winner.findMany({
        where,
        orderBy: [
          { competition: { startsAt: 'desc' } }, // Newest competitions first
          { kind: 'asc' }, // Group by kind
          { rank: 'asc' } // Rank 1, 2, 3...
        ],
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatar: true } },
          submission: {
            select: {
              id: true, title: true, featuredImage: true,
              media: { where: { slotIndex: 0 }, take: 1 }
            }
          },
          competition: { select: { id: true, title: true, year: true, month: true } }
        }
      }),
      prisma.winner.count({ where })
    ]);

    return {
      data: winners,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }
}
