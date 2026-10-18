import { Router } from 'express';
import { CampaignController } from './campaign.controller.js';
import { CampaignValidation } from './campaign.validation.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/upload.js';
import { moderateUploadedContent } from '../../middlewares/moderation.middleware.js';

const router = Router();

// Admin Routes
router.post('/links', 
  requireAuth, 
  requireAdmin, 
  CampaignController.generateLink
);

router.get('/stats', 
  requireAuth, 
  requireAdmin, 
  CampaignController.getStats
);

router.get('/links', 
  requireAuth, 
  requireAdmin, 
  CampaignValidation.validateQuery(CampaignValidation.getLinksQuerySchema),
  CampaignController.getLinks
);

router.get('/links/:id', 
  requireAuth, 
  requireAdmin, 
  CampaignController.getLinkDetails
);

router.patch('/links/:id/reward', 
  requireAuth, 
  requireAdmin, 
  CampaignValidation.validate(CampaignValidation.changeRewardSchema),
  CampaignController.changeRewardStatus
);

// Public Submission Route
router.post('/submit/:token',
  upload.fields([
    { name: 'profilePhoto', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 },
    { name: 'introVideo', maxCount: 1 },
    { name: 'singlePhoto', maxCount: 1 },
    { name: 'singleVideo', maxCount: 1 },
    { name: 'sixPhotos', maxCount: 6 },
    { name: 'sixVideo', maxCount: 1 },
    { name: 'twelvePhotos', maxCount: 12 },
    { name: 'twelveVideo', maxCount: 1 }
  ]),
  moderateUploadedContent,
  CampaignValidation.validate(CampaignValidation.submitCampaignSchema),
  CampaignController.submitCampaign
);

export const CampaignModule = { router };
