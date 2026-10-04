import { AdminPaymentService } from './admin-payment.service.js';
import { ResponseUtil } from '../../utils/response.js';

const adminPaymentService = new AdminPaymentService();

class AdminPaymentController {
  async getPrizeMoneyPayouts(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await adminPaymentService.getPayouts('PRIZE', page, limit);
      return ResponseUtil.success(res, 'Prize money payout requests fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getDonationPayouts(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await adminPaymentService.getPayouts('DONATION', page, limit);
      return ResponseUtil.success(res, 'Donation payout requests fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getPhotoSalesPayouts(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await adminPaymentService.getPayouts('PREMIUM', page, limit);
      return ResponseUtil.success(res, 'Photo sales payout requests fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async getStoreSalesPayouts(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await adminPaymentService.getPayouts('STORE', page, limit);
      return ResponseUtil.success(res, 'Store sales payout requests fetched successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async updatePayoutStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await adminPaymentService.updatePayoutStatus(id, status);
      return ResponseUtil.success(res, 'Payout status updated successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminPaymentController();
