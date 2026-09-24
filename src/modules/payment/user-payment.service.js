import prisma from '../../config/prisma.js';
import { PaginationUtil } from '../../utils/pagination.js';
import { UrlUtil } from '../../utils/urlUtil.js';

export class UserPaymentService {
  /**
   * Get Prize Money Stats and Paginated List
   */
  async getPrizeMoneyStatsAndList(userId, page = 1, limit = 10) {
    // Fetch all winners for stats
    const allWins = await prisma.winner.findMany({
      where: { userId },
      include: {
        submission: {
          select: { prizeMoney: true }
        }
      }
    });

    const totalPrizeMoney = allWins.reduce((sum, win) => {
      const amount = win.submission?.prizeMoney ? Number(win.submission.prizeMoney) : 0;
      return sum + amount;
    }, 0);

    const payouts = await prisma.payout.findMany({
      where: { userId, kind: 'PRIZE' }
    });

    const paidOut = payouts
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    const pending = payouts
      .filter(p => ['PENDING', 'APPROVED'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const available = totalPrizeMoney - (paidOut + pending);

    // Paginated list
    const skip = (page - 1) * limit;
    const [paginatedWins, totalRecords] = await Promise.all([
      prisma.winner.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          competition: true,
          submission: {
            include: { category: true, albumType: true }
          }
        }
      }),
      prisma.winner.count({ where: { userId } })
    ]);

    const formattedList = paginatedWins.map(win => ({
      id: win.id,
      month: win.competition?.title, // using title as per requirement 'Competitions Name'
      monthName: `${new Date(win.createdAt).toLocaleString('default', { month: 'long' })} ${new Date(win.createdAt).getFullYear()}`,
      competitionName: win.competition?.title?.en || win.competition?.title || 'Unknown',
      category: win.submission?.category?.name?.en || 'Unknown',
      albumType: win.submission?.albumType?.name?.en || 'Unknown',
      position: win.place ? win.place.toString() : (win.rank ? `${win.rank} th` : 'Winner'),
      totalVote: win.votes || 0,
      prizeMoney: win.submission?.prizeMoney ? Number(win.submission.prizeMoney) : 0
    }));

    return {
      stats: {
        totalPrizeMoney,
        available,
        pending,
        paidOut
      },
      list: {
        data: formattedList,
        meta: PaginationUtil.getMetadata(totalRecords, page, limit)
      }
    };
  }

  /**
   * Get Donations Stats and Paginated List
   */
  async getDonationStatsAndList(userId, page = 1, limit = 10) {
    // Fetch all completed donations
    const allDonations = await prisma.donation.findMany({
      where: { artistId: userId, status: 'COMPLETED' }
    });

    const totalDonations = allDonations.reduce((sum, d) => sum + Number(d.amount), 0);
    const platformFee = totalDonations * 0.10;
    const yourEarnings = totalDonations - platformFee;

    const payouts = await prisma.payout.findMany({
      where: { userId, kind: 'DONATION' }
    });

    const paidOut = payouts
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    const pending = payouts
      .filter(p => ['PENDING', 'APPROVED'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const available = yourEarnings - (paidOut + pending);

    const skip = (page - 1) * limit;
    const [paginatedDonations, totalRecords] = await Promise.all([
      prisma.donation.findMany({
        where: { artistId: userId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.donation.count({ where: { artistId: userId, status: 'COMPLETED' } })
    ]);

    const formattedList = paginatedDonations.map(d => {
      const amount = Number(d.amount);
      const fee = amount * 0.10;
      return {
        id: d.id,
        date: d.createdAt,
        donorName: d.donorName,
        email: d.donorEmail,
        donation: amount,
        platformFee: fee,
        yourEarnings: amount - fee
      };
    });

    return {
      stats: {
        totalDonations,
        platformFee,
        yourEarnings,
        available,
        pending,
        paidOut
      },
      list: {
        data: formattedList,
        meta: PaginationUtil.getMetadata(totalRecords, page, limit)
      }
    };
  }

  /**
   * Get Photo Sales Stats and Paginated List
   */
  async getPhotoSalesStatsAndList(req, userId, search = '', page = 1, limit = 10) {
    const baseWhere = {
      order: { status: 'PAID' },
      premiumPhoto: { userId }
    };

    // Only fetch once, without media to save memory
    const allSales = await prisma.orderItem.findMany({
      where: baseWhere,
      orderBy: { order: { createdAt: 'desc' } },
      include: {
        order: true,
        premiumPhoto: true
      }
    });

    const totalSales = allSales.reduce((sum, item) => sum + Number(item.price), 0);
    const photosSold = allSales.length;
    const platformFee = 0; // 0% fee for photo sales, 100% goes to user
    const yourEarnings = totalSales;

    const payouts = await prisma.payout.findMany({
      where: { userId, kind: 'PREMIUM' }
    });

    const paidOut = payouts
      .filter(p => p.status === 'PAID')
      .reduce((sum, p) => sum + Number(p.amount), 0);
      
    const pending = payouts
      .filter(p => ['PENDING', 'APPROVED'].includes(p.status))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const available = yourEarnings - (paidOut + pending);

    const searchFilter = search ? search.toLowerCase() : null;

    let filteredSales = allSales;
    if (searchFilter) {
      filteredSales = allSales.filter(item => {
        const titleStr = typeof item.premiumPhoto.title === 'object' ? JSON.stringify(item.premiumPhoto.title).toLowerCase() : String(item.premiumPhoto.title).toLowerCase();
        return (
          item.order.fullName.toLowerCase().includes(searchFilter) ||
          item.order.email.toLowerCase().includes(searchFilter) ||
          titleStr.includes(searchFilter)
        );
      });
    }

    const skip = (page - 1) * limit;
    const paginatedResult = filteredSales.slice(skip, skip + limit);

    // Fetch media ONLY for the paginated subset to drastically improve performance
    const photoIds = [...new Set(paginatedResult.map(item => item.premiumPhoto.id))];
    const mediaItems = await prisma.premiumPhotoMedia.findMany({
      where: { premiumPhotoId: { in: photoIds } }
    });

    const formattedList = paginatedResult.map(item => {
      const price = Number(item.price);
      const fee = 0; // 0% fee for photo sales
      
      const photoMedia = mediaItems.filter(m => m.premiumPhotoId === item.premiumPhoto.id);
      const photoUrl = photoMedia[0]?.url ? UrlUtil.getAbsoluteUrl(req, photoMedia[0].url) : null;

      return {
        id: item.id,
        date: item.order.createdAt,
        buyer: item.order.fullName,
        email: item.order.email,
        premiumPhotoId: item.premiumPhoto.id,
        photo: item.premiumPhoto.title?.en || item.premiumPhoto.title || 'Unknown',
        photoUrl,
        salePrice: price,
        yourEarnings: price - fee
      };
    });

    return {
      stats: {
        totalSales,
        photosSold,
        platformFee,
        yourEarnings,
        available,
        pending,
        paidOut
      },
      list: {
        data: formattedList,
        meta: PaginationUtil.getMetadata(filteredSales.length, page, limit)
      }
    };
  }

  /**
   * Get Payment History (Payouts)
   */
  async getPaymentHistory(userId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    
    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.payout.count({ where: { userId } })
    ]);

    const formattedList = payouts.map(p => ({
      id: p.id,
      date: p.createdAt,
      type: 'Withdrawal',
      payoutKind: p.kind,
      accountType: p.accountType,
      accountNumber: p.accountNumber,
      amount: Number(p.amount),
      status: p.status === 'PAID' ? 'Approved' : (p.status === 'PENDING' ? 'Pending' : p.status)
    }));

    return {
      data: formattedList,
      meta: PaginationUtil.getMetadata(total, page, limit)
    };
  }

  /**
   * Request Payout
   */
  async requestPayout(userId, type, amount, accountType, accountNumber) {
    let kind;
    if (type.toLowerCase() === 'prize money' || type.toLowerCase() === 'prize') kind = 'PRIZE';
    else if (type.toLowerCase() === 'donation' || type.toLowerCase() === 'donations') kind = 'DONATION';
    else if (type.toLowerCase() === 'photo sales' || type.toLowerCase() === 'premium') kind = 'PREMIUM';
    else throw new Error('Invalid payout type requested');

    let available = 0;
    
    if (kind === 'PRIZE') {
      const stats = await this.getPrizeMoneyStatsAndList(userId, 1, 1);
      available = stats.stats.available;
    } else if (kind === 'DONATION') {
      const stats = await this.getDonationStatsAndList(userId, 1, 1);
      available = stats.stats.available;
    } else if (kind === 'PREMIUM') {
      const stats = await this.getPhotoSalesStatsAndList(userId, '', 1, 1);
      available = stats.stats.available;
    }

    if (amount > available) {
      throw new Error(`Requested amount exceeds available balance. Available: $${available.toFixed(2)}`);
    }

    const payout = await prisma.payout.create({
      data: {
        userId,
        kind,
        amount,
        accountType,
        accountNumber,
        status: 'PENDING'
      }
    });

    return payout;
  }
}
