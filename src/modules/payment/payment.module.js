import { Router } from 'express';
import paymentController from './payment.controller.js';
import paymentValidation from './payment.validation.js';
import { optionalAuth } from '../../middlewares/optionalAuth.middleware.js';

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


export default router;
