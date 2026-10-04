import prisma from '../../config/prisma.js';
import { EmailUtil } from '../../utils/email.js';
import config from '../../config/env.js';
import { TranslateUtil } from '../../utils/translate.js';

export class NewsletterService {
  async subscribe(email) {
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (existing) {
      return existing; // Already subscribed
    }

    return prisma.newsletterSubscriber.create({
      data: {
        email
      }
    });
  }

  async getAllSubscribers(skip = 0, take = 10) {
    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        skip,
        take,
        orderBy: { subscribedAt: 'desc' },
      }),
      prisma.newsletterSubscriber.count()
    ]);

    return { data: subscribers, total };
  }

  async sendCampaign(data, bannerFile) {
    const { subject, subject_pl, title, title_pl, content, content_pl, ctaText, ctaText_pl, ctaUrl, target, selectedIds } = data;
    
    // Construct base URL from env
    const baseUrl = config.app.backendUrl ? config.app.backendUrl.replace(/\/$/, '') : 'http://localhost:3000';

    // Save full banner URL if a file is uploaded
    const bannerUrl = bannerFile ? `${baseUrl}/uploads/${bannerFile.filename}` : null;

    // Create Campaign Record
    const campaign = await prisma.newsletterCampaign.create({
      data: {
        subject: subject,
        subject_pl: subject_pl || (subject ? await TranslateUtil.translateText(subject, 'en', 'pl') : null),
        title: title,
        title_pl: title_pl || (title ? await TranslateUtil.translateText(title, 'en', 'pl') : null),
        content: content,
        content_pl: content_pl || (content ? await TranslateUtil.translateText(content, 'en', 'pl') : null),
        bannerUrl,
        ctaText,
        ctaText_pl: ctaText_pl || (ctaText ? await TranslateUtil.translateText(ctaText, 'en', 'pl') : null),
        ctaUrl,
        target,
        selectedIds: selectedIds ? selectedIds.split(',').map(s => s.trim()) : [],
        status: 'DRAFT',
      }
    });

    try {
      // Find Target Audience
      let targetEmails = [];

      if (target === 'EVERYONE') {
        const subscribers = await prisma.newsletterSubscriber.findMany({ select: { email: true } });
        targetEmails = subscribers.map(s => s.email);
      } else if (target === 'NEW_SUBSCRIBERS') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const subscribers = await prisma.newsletterSubscriber.findMany({
          where: { subscribedAt: { gte: sevenDaysAgo } },
          select: { email: true }
        });
        targetEmails = subscribers.map(s => s.email);
      } else if (target === 'SELECTED') {
        if (!selectedIds) {
          throw new Error('selectedIds required when target is SELECTED');
        }
        // Assume selectedIds are emails for simplicity if they contain '@'
        const rawSelected = selectedIds.split(',').map(s => s.trim());
        const emailSet = new Set();
        
        // Resolve valid emails and UUIDs
        const idsToFetch = [];
        for (const str of rawSelected) {
          if (str.includes('@')) {
            emailSet.add(str);
          } else if (str.length > 0) {
            idsToFetch.push(str);
          }
        }
        
        // Fetch emails for the provided IDs
        if (idsToFetch.length > 0) {
          const subscribers = await prisma.newsletterSubscriber.findMany({
            where: { id: { in: idsToFetch } },
            select: { email: true }
          });
          subscribers.forEach(s => emailSet.add(s.email));
        }
        
        targetEmails = Array.from(emailSet);
      }

      if (targetEmails.length > 0) {
        // Send emails asynchronously (Could be replaced with a Queue in production)
        Promise.allSettled(
          targetEmails.map(email => 
            EmailUtil.sendCampaignEmail(email, campaign.subject, campaign)
          )
        ).then(results => {
          const failed = results.filter(r => r.status === 'rejected');
          if (failed.length > 0) {
            console.error(`Failed to send to ${failed.length} subscribers`, failed);
          }
          prisma.newsletterCampaign.update({
            where: { id: campaign.id },
            data: { status: 'SENT', sentAt: new Date() }
          }).catch(console.error);
        });
      } else {
        // No targets found
        await prisma.newsletterCampaign.update({
          where: { id: campaign.id },
          data: { status: 'FAILED' }
        });
      }

      return campaign;
    } catch (err) {
      await prisma.newsletterCampaign.update({
        where: { id: campaign.id },
        data: { status: 'FAILED' }
      });
      throw err;
    }
  }
}
