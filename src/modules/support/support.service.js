import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class SupportService {
  /**
   * Create a new support ticket
   */
  async createTicket(userId, data, sourceLang = 'en') {
    try {
      let title = data.subject;
      let title_pl = data.subject;
      let message = data.message;
      let message_pl = data.message;
      
      const { TranslateUtil } = await import('../../utils/translate.js');

      if (sourceLang === 'pl') {
        title = title ? await TranslateUtil.translateText(title, 'pl', 'en') : title;
        message = message ? await TranslateUtil.translateText(message, 'pl', 'en') : message;
      } else {
        title_pl = title ? await TranslateUtil.translateText(title, 'en', 'pl') : title_pl;
        message_pl = message ? await TranslateUtil.translateText(message, 'en', 'pl') : message_pl;
      }

      return await prisma.supportTicket.create({
        data: {
          userId,
          name: data.name,
          email: data.email,
          title,
          title_pl,
          message,
          message_pl,
          status: 'PENDING'
        }
      });
    } catch (error) {
      throw new Error('Failed to create support ticket: ' + error.message);
    }
  }

  /**
   * Get paginated support tickets for a specific user
   */
  async getUserTickets(userId, status, page = 1, limit = 10) {
    const where = { userId };
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          answer: true,
          status: true,
          createdAt: true,
          answeredAt: true
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    return {
      data: tickets,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }

  /**
   * Get a single support ticket for a specific user
   */
  async getTicketById(id, userId) {
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, userId }
    });
    
    if (!ticket) {
      throw new Error('Support ticket not found');
    }
    
    return ticket;
  }

  /**
   * Get paginated support tickets for admins (Pending or Answered)
   */
  async getAdminTickets(status, page = 1, limit = 10) {
    const where = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          message: true,
          answer: true,
          status: true,
          createdAt: true,
          answeredAt: true
        }
      }),
      prisma.supportTicket.count({ where })
    ]);

    return {
      data: tickets,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }

  /**
   * Get details of a single support ticket for admins
   */
  async getAdminTicketById(id) {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, avatar: true } }
      }
    });

    if (!ticket) {
      throw new Error('Support ticket not found');
    }

    return ticket;
  }

  /**
   * Admin replies to a support ticket
   */
  async replyToTicket(id, answerText, sourceLang = 'en') {
    const ticket = await prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) {
      throw new Error('Support ticket not found');
    }
    
    let answer = answerText;
    let answer_pl = answerText;

    const { TranslateUtil } = await import('../../utils/translate.js');

    if (sourceLang === 'pl') {
      answer = answerText ? await TranslateUtil.translateText(answerText, 'pl', 'en') : answerText;
    } else {
      answer_pl = answerText ? await TranslateUtil.translateText(answerText, 'en', 'pl') : answerText;
    }

    const updated = await prisma.supportTicket.update({
      where: { id },
      data: {
        answer,
        answer_pl,
        status: 'ANSWERED',
        answeredAt: new Date()
      }
    });

    return updated;
  }
}
