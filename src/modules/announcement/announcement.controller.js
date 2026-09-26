import { ResponseUtil } from '../../utils/response.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class AnnouncementController {
  constructor(announcementService) {
    this.announcementService = announcementService;
  }

  create = async (req, res) => {
    try {
      const data = req.body;
      const announcement = await this.announcementService.create(data);
      return ResponseUtil.success(res, 'Announcement created successfully', announcement, 201);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getAll = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const { total, data } = await this.announcementService.getAll(skip, limit);
      const meta = PaginationUtil.getMetadata(total, page, limit);

      return res.status(200).json({
        success: true,
        message: 'Announcements fetched successfully',
        data,
        meta
      });
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getStats = async (req, res) => {
    try {
      const stats = await this.announcementService.getStats();
      return ResponseUtil.success(res, 'Stats fetched successfully', stats);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  getDetails = async (req, res) => {
    try {
      const { id } = req.params;
      const announcement = await this.announcementService.getDetails(id);
      if (!announcement) {
        return ResponseUtil.error(res, 'Announcement not found', 404);
      }
      return ResponseUtil.success(res, 'Announcement details fetched successfully', announcement);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      
      const exists = await this.announcementService.getDetails(id);
      if (!exists) {
        return ResponseUtil.error(res, 'Announcement not found', 404);
      }

      const announcement = await this.announcementService.update(id, data);
      return ResponseUtil.success(res, 'Announcement updated successfully', announcement);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };

  delete = async (req, res) => {
    try {
      const { id } = req.params;
      const exists = await this.announcementService.getDetails(id);
      if (!exists) {
        return ResponseUtil.error(res, 'Announcement not found', 404);
      }

      await this.announcementService.delete(id);
      return ResponseUtil.success(res, 'Announcement deleted successfully', null);
    } catch (error) {
      return ResponseUtil.error(res, error.message, 500);
    }
  };
}
