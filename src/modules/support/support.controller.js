import { ResponseUtil } from '../../utils/response.js';

export class SupportController {
  constructor(supportService) {
    this.supportService = supportService;
  }

  /**
   * Create a new support ticket (User)
   * @route POST /api/v1/support
   */
  createTicket = async (req, res, next) => {
    try {
      const userId = req.user.id;
      
      const ticket = await this.supportService.createTicket(userId, req.body);

      res.status(201).json({
        success: true,
        data: ticket,
        message: 'Support ticket created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all support tickets for the logged-in user
   * @route GET /api/v1/support/my-tickets
   */
  getMyTickets = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { status, page, limit } = req.query;
      
      const tickets = await this.supportService.getUserTickets(
        userId,
        status,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: tickets.data,
        meta: tickets.meta,
        message: 'My support tickets fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get details of a specific ticket for the user
   * @route GET /api/v1/support/my-tickets/:id
   */
  getMyTicketDetails = async (req, res, next) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const ticket = await this.supportService.getTicketById(id, userId);

      res.status(200).json({
        success: true,
        data: ticket,
        message: 'Support ticket details fetched successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      next(error);
    }
  };

  /**
   * Get all pending support tickets (Admin)
   * @route GET /api/v1/support/admin/pending
   */
  getAdminPendingTickets = async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      
      const tickets = await this.supportService.getAdminTickets(
        'PENDING',
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: tickets.data,
        meta: tickets.meta,
        message: 'Pending support tickets fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all answered support tickets (Admin)
   * @route GET /api/v1/support/admin/answered
   */
  getAdminAnsweredTickets = async (req, res, next) => {
    try {
      const { page, limit } = req.query;
      
      const tickets = await this.supportService.getAdminTickets(
        'ANSWERED',
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: tickets.data,
        meta: tickets.meta,
        message: 'Answered support tickets fetched successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reply to a support ticket (Admin)
   * @route PATCH /api/v1/support/admin/:id/reply
   */
  replyTicket = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { answer } = req.body;

      const updatedTicket = await this.supportService.replyToTicket(id, answer);

      res.status(200).json({
        success: true,
        data: updatedTicket,
        message: 'Successfully replied to support ticket'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      next(error);
    }
  };

  /**
   * Get details of an individual ticket (Admin)
   * @route GET /api/v1/support/admin/:id
   */
  getAdminTicketDetails = async (req, res, next) => {
    try {
      const { id } = req.params;

      const ticket = await this.supportService.getAdminTicketById(id);

      res.status(200).json({
        success: true,
        data: ticket,
        message: 'Support ticket details fetched successfully'
      });
    } catch (error) {
      if (error.message.includes('not found')) {
        return ResponseUtil.error(res, error.message, 404);
      }
      next(error);
    }
  };
}
