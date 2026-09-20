import { Router } from 'express';
import { CompetitionController } from './competition.controller.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

export class CompetitionModule {
  constructor() {
    this.router = Router();
    this.competitionController = new CompetitionController();
    this.initializeRoutes();
  }

  initializeRoutes() {
    // Unified GET endpoint to fetch competitions and leaderboards based on filters
    this.router.get('/', optionalAuth, this.competitionController.getCompetitions);
    this.router.get('/leaderboard', optionalAuth, this.competitionController.getCompetitions);

    // GET endpoint to fetch paginated winners for the Winners Archive page
    this.router.get('/winners', optionalAuth, this.competitionController.getWinners);
    
    // DEV ONLY route to force end month
    if (process.env.NODE_ENV !== 'production') {
      this.router.post('/force-end-month', this.competitionController.forceEndMonth);
    }
  }
}
