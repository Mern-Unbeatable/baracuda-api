import prisma from '../../config/prisma.js';
import { TranslateUtil } from '../../utils/translate.js';

export class AnnouncementService {
  computeDisplayStatus(announcement) {
    if (announcement.activeState === 'inactive') {
      return 'Inactive';
    }

    const now = new Date();
    
    // Parse startDate + startTime
    const startDateTime = new Date(announcement.startDate);
    const [startHours, startMinutes] = announcement.startTime.split(':');
    startDateTime.setHours(parseInt(startHours, 10) || 0, parseInt(startMinutes, 10) || 0, 0, 0);

    if (now < startDateTime) {
      return 'Scheduled';
    }

    if (!announcement.noEndDate && announcement.endDate && announcement.endTime) {
      const endDateTime = new Date(announcement.endDate);
      const [endHours, endMinutes] = announcement.endTime.split(':');
      endDateTime.setHours(parseInt(endHours, 10) || 0, parseInt(endMinutes, 10) || 0, 0, 0);

      if (now > endDateTime) {
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
        data.message_pl = await TranslateUtil.translateText(data.message, 'pl', 'en');
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
      orderBy: { createdAt: 'desc' }
    });

    return announcements
      .map(ann => ({ ...ann, displayStatus: this.computeDisplayStatus(ann) }))
      .filter(ann => ann.displayStatus === 'Active');
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
        data.message_pl = await TranslateUtil.translateText(data.message, 'pl', 'en');
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
