import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class AdminReportController {
  constructor(adminReportService) {
    this.adminReportService = adminReportService;
  }

  getReportStats = async (req, res) => {
    try {
      const stats = await this.adminReportService.getReportStats();
      return ResponseUtil.success(res, 'Report stats fetched successfully', stats);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getAllReports = async (req, res) => {
    try {
      const { status } = req.query;
      const { skip, take, page, limit } = PaginationUtil.getPaginationOptions(req.query);

      const filters = { status };
      const { total, data } = await this.adminReportService.getAllReports(filters, skip, take);

      return ResponseUtil.success(res, 'Reports fetched successfully', {
        data,
        meta: PaginationUtil.getMetadata(total, page, limit)
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getReportDetails = async (req, res) => {
    try {
      const report = await this.adminReportService.getReportDetails(req.params.id);
      if (!report) return ResponseUtil.error(res, 'Report not found', 404);
      return ResponseUtil.success(res, 'Report details fetched successfully', report);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  updateReportStatus = async (req, res) => {
    try {
      const { status } = req.body;
      const report = await this.adminReportService.updateReportStatus(req.params.id, status);
      return ResponseUtil.success(res, 'Report status updated successfully', report);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  executeAction = async (req, res) => {
    try {
      const { action } = req.body; // CONTENT_REMOVED, WARN, SUSPEND, BAN, MARK_RESOLVED
      const adminId = req.user.id;
      
      // MARK_RESOLVED is just a status update
      if (action === 'MARK_RESOLVED') {
        const report = await this.adminReportService.updateReportStatus(req.params.id, 'RESOLVED');
        return ResponseUtil.success(res, 'Report marked as resolved', report);
      }
      
      const result = await this.adminReportService.executeAction(req.params.id, action, adminId);
      return ResponseUtil.success(res, 'Moderation action executed successfully', result);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }

  getUserAuditHistory = async (req, res) => {
    try {
      const history = await this.adminReportService.getUserAuditHistory(req.params.userId);
      return ResponseUtil.success(res, 'User audit history fetched successfully', history);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  }
}
