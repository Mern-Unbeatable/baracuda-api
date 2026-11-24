import prisma from '../../config/prisma.js';
import { TranslateUtil } from '../../utils/translate.js';

export class AnnouncementService {
  /**
   * Combine a Prisma `@db.Date` value with an "HH:mm" clock time into a
   * local Date. Using UTC calendar parts avoids off-by-one-day shifts when
   * the server timezone is behind UTC.
   */
  combineDateAndTime(dateValue, timeStr) {
    if (!dateValue) return null;
    const base = new Date(dateValue);
    if (Number.isNaN(base.getTime())) return null;

    const year = base.getUTCFullYear();
    const month = base.getUTCMonth();
    const day = base.getUTCDate();
    const [rawH = '0', rawM = '0'] = String(timeStr || '00:00').split(':');
    const hours = Number.parseInt(rawH, 10) || 0;
    const minutes = Number.parseInt(String(rawM).replace(/\D.*/, ''), 10) || 0;

    return new Date(year, month, day, hours, minutes, 0, 0);
  }

  computeDisplayStatus(announcement) {
    if (announcement.activeState === 'inactive') {
      return 'Inactive';
    }

    const now = new Date();
    const startDateTime = this.combineDateAndTime(
      announcement.startDate,
      announcement.startTime,
    );

    if (startDateTime && now < startDateTime) {
      return 'Scheduled';
    }

    if (!announcement.noEndDate && announcement.endDate && announcement.endTime) {
      const endDateTime = this.combineDateAndTime(
        announcement.endDate,
        announcement.endTime,
      );

      if (endDateTime && now > endDateTime) {
        return 'Expired';
      }
    }

    return 'Active';
  }

  async create(data, sourceLang = 'en') {
    if (data.message) {
      if (sourceLang === 'pl') {
        data.message_pl = data.message;
        data.message = await TranslateUtil.translateText(data.message, 'en', 'pl');
      } else {
      }
    }

    if (data.link && data.link.buttonName) {
      if (sourceLang === 'pl') {
        data.link.buttonName_pl = data.link.buttonName;
        data.link.buttonName = await TranslateUtil.translateText(data.link.buttonName, 'en', 'pl');
      } else {
        data.link.buttonName_pl = await TranslateUtil.translateText(data.link.buttonName, 'pl', 'en');
      }
    }

    return await prisma.announcement.create({
      data: {
        ...data,
        link: data.link ? data.link : null,
      }
    });
  }

  async getAll(skip, take) {
    const announcements = await prisma.announcement.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.announcement.count();

    const dataWithStatus = announcements.map(ann => ({
      ...ann,
      displayStatus: this.computeDisplayStatus(ann)
    }));

    return { total, data: dataWithStatus };
  }

  async getPublic() {
    const announcements = await prisma.announcement.findMany({
      where: { activeState: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    const priorityRank = { high: 0, medium: 1, low: 2 };

    return announcements
      .map((ann) => ({ ...ann, displayStatus: this.computeDisplayStatus(ann) }))
      .filter((ann) => ann.displayStatus === 'Active')
      .sort((a, b) => {
        const aRank = priorityRank[a.priority] ?? 9;
        const bRank = priorityRank[b.priority] ?? 9;
        if (aRank !== bRank) return aRank - bRank;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  async getStats() {
    const all = await prisma.announcement.findMany();
    
    let active = 0;
    let scheduled = 0;
    let expired = 0;
    let inactive = 0;
    let total = all.length;

    all.forEach(ann => {
      const status = this.computeDisplayStatus(ann);
      if (status === 'Active') active++;
      else if (status === 'Scheduled') scheduled++;
      else if (status === 'Expired') expired++;
      else if (status === 'Inactive') inactive++;
    });

    return { total, active, scheduled, expired, inactive };
  }

  async getDetails(id) {
    const ann = await prisma.announcement.findUnique({ where: { id } });
    if (!ann) return null;
    
    return {
      ...ann,
      displayStatus: this.computeDisplayStatus(ann)
    };
  }

  async update(id, data, sourceLang = 'en') {
    if (data.message) {
      if (sourceLang === 'pl') {
        data.message_pl = data.message;
        data.message = await TranslateUtil.translateText(data.message, 'en', 'pl');
      } else {
      }
    }

    if (data.link && data.link.buttonName) {
      if (sourceLang === 'pl') {
        data.link.buttonName_pl = data.link.buttonName;
        data.link.buttonName = await TranslateUtil.translateText(data.link.buttonName, 'en', 'pl');
      } else {
        data.link.buttonName_pl = await TranslateUtil.translateText(data.link.buttonName, 'pl', 'en');
      }
    }

    return await prisma.announcement.update({
      where: { id },
      data: {
        ...data,
        link: data.link ? data.link : null,
        endDate: data.noEndDate ? null : data.endDate,
        endTime: data.noEndDate ? null : data.endTime,
      }
    });
  }

  async delete(id) {
    return await prisma.announcement.delete({ where: { id } });
  }
}
