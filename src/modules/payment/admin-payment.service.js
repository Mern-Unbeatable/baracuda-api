import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';

export class AdminPaymentService {
  /**
   * Get all payout requests by kind with pagination
   * @param {string} kind - PayoutKind enum (PRIZE, DONATION, PREMIUM)
   * @param {number} page
   * @param {number} limit
   */
  async getPayouts(kind, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { kind },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.payout.count({ where: { kind } })
    ]);

    const formattedList = payouts.map(p => ({
      id: p.id,
      date: p.createdAt,
      type: 'Withdrawal', // Fixed as per UI requirement for payouts
      accountType: p.accountType,
      accountNumber: p.accountNumber,
      amount: Number(p.amount),
      status: p.status,
      user: {
        name: p.user?.name || 'Unknown User',
        email: p.user?.email || 'Unknown Email'
      }
    }));

    return {
      data: formattedList,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }

  /**
   * Update the status of a payout request
   * @param {string} id - Payout ID
   * @param {string} status - PayoutStatus enum (APPROVED, REJECTED, PAID)
   */
  async updatePayoutStatus(id, status) {
    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) {
      throw new Error('Payout request not found');
    }

    if (payout.status === status) {
      const error = new Error(`Payout is already ${status}`);
      error.status = 400;
      throw error;
    }

    if (payout.status === 'PAID') {
      const error = new Error('Cannot change status of a payout that has already been PAID');
      error.status = 400;
      throw error;
    }

    if (payout.status === 'REJECTED') {
      const error = new Error('Cannot change status of a payout that has already been REJECTED');
      error.status = 400;
      throw error;
    }

    const updatedPayout = await prisma.payout.update({
      where: { id },
      data: { status }
    });

    return updatedPayout;
  }
}
