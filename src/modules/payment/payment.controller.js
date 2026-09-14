import paymentService from './payment.service.js';
import { ResponseUtil } from '../../utils/response.js';

class PaymentController {
  
  createDonation = async (req, res, next) => {
    try {
      const { submissionId, amount, donorName, donorEmail, type, message } = req.validatedBody;
      const userId = req.user ? req.user.id : null; // Guest or Logged In

      let result;
      if (type === 'ONE_TIME') {
        result = await paymentService.createOneTimeDonation(submissionId, amount, donorName, donorEmail, userId);
      } else if (type === 'MONTHLY') {
        result = await paymentService.createMonthlyDonation(submissionId, amount, donorName, donorEmail, userId);
      }

      return ResponseUtil.success(res, 'Checkout URL generated successfully', result, 201);
    } catch (err) {
      next(err);
    }
  }

  captureOneTimeDonation = async (req, res, next) => {
    try {
      const { paymentId } = req.body; // PayPal Order ID
      if (!paymentId) throw new Error('paymentId is required');
      
      const result = await paymentService.captureOneTimeDonation(paymentId);
      return ResponseUtil.success(res, 'Payment captured successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default new PaymentController();
