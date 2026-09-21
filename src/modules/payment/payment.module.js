import { Router } from 'express';
import paymentController from './payment.controller.js';
import paymentValidation from './payment.validation.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';
import adminPaymentController from './admin-payment.controller.js';
import { requireAuth, requireAdmin } from '../../middlewares/auth.middleware.js';
import userPaymentController from './user-payment.controller.js';

const router = Router();

// /api/v1/payments

// Create a Donation checkout URL
router.post(
  '/donate',
  optionalAuth,
  paymentValidation.validate(paymentValidation.donationSchema),
  paymentController.createDonation
);

// Capture a one-time donation
router.post(
  '/donate/capture',
  paymentController.captureOneTimeDonation
);

// ---------------------------------------------------------------------------
// User End APIs (Requires Authentication)
// ---------------------------------------------------------------------------
const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get('/prize-money', userPaymentController.getPrizeMoney);
userRouter.get('/donations', userPaymentController.getDonations);
userRouter.get('/photo-sales/export', userPaymentController.exportPhotoSales);
userRouter.get('/photo-sales', userPaymentController.getPhotoSales);
userRouter.get('/history', userPaymentController.getPaymentHistory);

userRouter.post(
  '/request-payout',
  paymentValidation.validate(paymentValidation.payoutRequestSchema),
  userPaymentController.requestPayout
);

// ==========================================
// Admin Payment Routes (Payouts Management)
// ==========================================
const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/payouts/prize-money', adminPaymentController.getPrizeMoneyPayouts);
adminRouter.get('/payouts/donations', adminPaymentController.getDonationPayouts);
adminRouter.get('/payouts/photo-sales', adminPaymentController.getPhotoSalesPayouts);
adminRouter.patch(
  '/payouts/:id/status',
  paymentValidation.validate(paymentValidation.updatePayoutStatusSchema),
  adminPaymentController.updatePayoutStatus
);

router.use('/admin', adminRouter);
router.use('/user', userRouter);

export default router;
