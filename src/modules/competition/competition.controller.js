import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { CompetitionService } from './competition.service.js';

export class CompetitionController {
  constructor() {
    this.competitionService = new CompetitionService();
  }

  getCompetitions = async (req, res) => {
    try {
      const { year, month, kind } = req.query;
      
      const result = await this.competitionService.getCompetitions({
        year: year ? parseInt(year) : undefined,
        month: month ? parseInt(month) : undefined,
        kind
      });
      
      let message = 'Competition data fetched successfully';
      if (result.competition) {
        if (result.competition.status === 'OPEN') {
          message = kind ? 'Live leaderboard for the ongoing competition' : 'Current ongoing competition fetched successfully';
        } else if (result.competition.status === 'CLOSED') {
          message = kind ? 'Finalized leaderboard for the past competition' : 'Past competition fetched successfully';
        }
      } else {
        message = 'No competition found for this month';
      }
      
      const responseData = kind ? result.leaderboard : result.competition;
      
      return ResponseUtil.success(res, message, responseData);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  };



  getWinners = async (req, res) => {
    try {
      const { year, month, kind } = req.query;
      const { page, limit } = PaginationUtil.getPaginationOptions(req.query);
      
      const result = await this.competitionService.getWinnersArchive({
        year: year ? parseInt(year) : undefined,
        month: month ? parseInt(month) : undefined,
        kind,
        page,
        limit
      });
      
      return ResponseUtil.success(res, 'Winners archive fetched successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  };

  // TEST ONLY - DO NOT USE IN PRODUCTION
  forceEndMonth = async (req, res) => {
    try {
      if (process.env.NODE_ENV === 'production') {
        return ResponseUtil.error(res, 'Not available in production', 403);
      }
      await this.competitionService.processMonthlyCompetitions();
      return ResponseUtil.success(res, 'Monthly competition forcefully ended and leaderboards generated', null);
    } catch (error) {
      return ResponseUtil.error(res, error.message);
    }
  };
}
