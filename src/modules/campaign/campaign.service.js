import prisma from '../../config/prisma.js';
import { HashUtil } from '../../utils/hash.js';
import config from '../../config/env.js';
import { ArtworkService } from '../artwork/artwork.service.js';

export class CampaignService {
  static async generateLink() {
    const generateToken = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let token;
    let isUnique = false;
    while (!isUnique) {
      token = generateToken();
      const existing = await prisma.campaignLink.findUnique({ where: { token } });
      if (!existing) isUnique = true;
    }

    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 10); // 10 days validity

    const link = await prisma.campaignLink.create({
      data: {
        token,
        validUntil,
        status: 'ACTIVE'
      }
    });

    return {
      linkId: link.id,
      promotionalUrl: `${config.app.promoCodeLink}/${link.token}`,
      validUntil: link.validUntil
    };
  }

  static async getStats() {
    const totalLinks = await prisma.campaignLink.count();
    const activeLinks = await prisma.campaignLink.count({
      where: { status: 'ACTIVE', validUntil: { gt: new Date() } }
    });
    const usedLinks = await prisma.campaignLink.count({
      where: { status: 'USED' }
    });
    const expiredLinks = await prisma.campaignLink.count({
      where: {
        OR: [
          { status: 'EXPIRED' },
          { status: 'ACTIVE', validUntil: { lt: new Date() } }
        ]
      }
    });

    const incompleteSubmissions = await prisma.campaignSubmission.count({
      where: { rewardStatus: 'NOT_ELIGIBLE' }
    });

    return {
      totalLinks,
      activeLinks,
      usedLinks,
      expiredLinks,
      incompleteReqs: incompleteSubmissions
    };
  }

  static async getLinks(query) {
    const { status, dateCreated, requirements, rewardStatus, page = 1, limit = 10 } = query;

    const where = {};

    if (status && status !== 'ALL') {
      if (status === 'EXPIRED') {
        where.OR = [
          { status: 'EXPIRED' },
          { status: 'ACTIVE', validUntil: { lt: new Date() } }
        ];
      } else if (status === 'ACTIVE') {
        where.status = 'ACTIVE';
        where.validUntil = { gt: new Date() };
      } else {
        where.status = status;
      }
    }

    if (dateCreated && dateCreated !== 'ALL') {
      const daysMap = {
        'LAST_7_DAYS': 7,
        'LAST_10_DAYS': 10,
        'LAST_15_DAYS': 15,
        'LAST_30_DAYS': 30
      };
      if (daysMap[dateCreated]) {
        const date = new Date();
        date.setDate(date.getDate() - daysMap[dateCreated]);
        where.createdAt = { gte: date };
      }
    }

    if (requirements && requirements !== 'ALL') {
      if (requirements === 'COMPLETED') {
        where.submission = {
          rewardStatus: { in: ['UNDER_REVIEW', 'PAID'] }
        };
      } else if (requirements === 'INCOMPLETE') {
        where.submission = {
          rewardStatus: 'NOT_ELIGIBLE'
        };
      }
    }

    if (rewardStatus && rewardStatus !== 'ALL') {
      where.submission = {
        ...where.submission,
        rewardStatus: rewardStatus
      };
    }

    const skip = (page - 1) * limit;

    const [links, total] = await Promise.all([
      prisma.campaignLink.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          submission: {
            select: {
              completedRequirements: true,
              totalRequirements: true,
              rewardStatus: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.campaignLink.count({ where })
    ]);

    // Map responses to match design
    const formattedLinks = links.map(link => {
      let calcStatus = link.status;
      if (link.status === 'ACTIVE' && link.validUntil < new Date()) {
        calcStatus = 'EXPIRED';
      }

      const isUsed = calcStatus === 'USED';

      return {
        id: link.id,
        promotionalUrl: `${config.app.promoCodeLink}/${link.token}`,
        dateIssued: link.createdAt,
        validity: isUsed ? 'used' : calcStatus === 'EXPIRED' ? '0 days' : `${Math.ceil((link.validUntil - new Date()) / (1000 * 60 * 60 * 24))} days left`,
        status: calcStatus,
        checklist: link.submission ? `${link.submission.completedRequirements}/${link.submission.totalRequirements}` : '------',
        reward: link.submission ? link.submission.rewardStatus.replace('_', ' ') : '------'
      };
    });

    return {
      data: formattedLinks,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getLinkDetails(id) {
    const link = await prisma.campaignLink.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                phone: true,
                country: true,
                paypalAccount: true
              }
            }
          }
        }
      }
    });

    if (!link) {
      throw new Error('Link not found');
    }

    return link;
  }

  static async changeRewardStatus(id, status) {
    const link = await prisma.campaignLink.findUnique({
      where: { id },
      include: { submission: true }
    });

    if (!link || !link.submission) {
      throw new Error('Link or submission not found');
    }

    const updated = await prisma.campaignSubmission.update({
      where: { id: link.submission.id },
      data: { rewardStatus: status }
    });

    return updated;
  }

  static async submitCampaign(token, body, files = {}, sourceLang = 'en') {
    return await prisma.$transaction(async (tx) => {
      // 1. Verify token
      const link = await tx.campaignLink.findUnique({ where: { token } });
      if (!link) throw new Error('Invalid promo link');
      if (link.status !== 'ACTIVE') throw new Error('Promo link is no longer active');
      if (link.validUntil < new Date()) throw new Error('Promo link has expired');

      // 2. Check if user exists
      const existingUser = await tx.user.findFirst({
        where: { OR: [{ email: body.email }, { username: body.username }] }
      });
      if (existingUser) {
        if (existingUser.email === body.email) {
          throw new Error('Email is already registered');
        }
        if (existingUser.username === body.username) {
          throw new Error('Username is already registered');
        }
      }

      // 3. Create User
      const hashedPassword = await HashUtil.hash(body.password);
      const user = await tx.user.create({
        data: {
          name: body.fullName,
          username: body.username,
          email: body.email,
          phone: body.phone,
          country: body.country,
          paypalAccount: body.paypalAccount,
          bio: body.about,
          socialLinks: body.socialLinks || {},
          password: hashedPassword,
          status: 'ACTIVE',
          isVerified: true,
          // Extract basic file urls if available
          avatar: files.profilePhoto ? files.profilePhoto[0].path : null,
          coverPhoto: files.coverPhoto ? files.coverPhoto[0].path : null,
          introVideo: files.introVideo ? files.introVideo[0].path : null,
        }
      });

      // 4. Evaluate Checklist
      const checklist = {
        registration: { status: true, label: "Registration Details" },
        profilePhoto: { status: !!files.profilePhoto, label: "Profile Photo" },
        coverPhoto: { status: !!files.coverPhoto, label: "Cover Photo" },
        introVideo: { status: !!files.introVideo, label: "Introduction Video" },
        singleArtwork: { 
          status: !!files.singlePhoto && !!body.singleTitle && !!body.singleQuality, 
          label: "Single Photo & Metadata" 
        },
        sixSeriesArtwork: { 
          status: files.sixPhotos && files.sixPhotos.length === 6 && !!body.sixTitle && !!body.sixTheme, 
          label: `Six Series & Metadata (Uploaded ${files.sixPhotos ? files.sixPhotos.length : 0} of 6)`,
          count: files.sixPhotos ? files.sixPhotos.length : 0,
          required: 6
        },
        twelveSeriesArtwork: { 
          status: files.twelvePhotos && files.twelvePhotos.length === 12 && !!body.twelveTitle && !!body.twelveTheme, 
          label: `Twelve Series & Metadata (Uploaded ${files.twelvePhotos ? files.twelvePhotos.length : 0} of 12)`,
          count: files.twelvePhotos ? files.twelvePhotos.length : 0,
          required: 12
        },
        videos: {
          status: !!files.singleVideo && !!files.sixVideo && !!files.twelveVideo,
          label: "Artwork Videos (Single, 6 Series, 12 Series)"
        }
      };

      let completedRequirements = 0;
      let totalRequirements = Object.keys(checklist).length; // 7

      for (const key in checklist) {
        if (checklist[key].status === true) {
          completedRequirements++;
        }
      }

      // Set rewardStatus based on checklist completion
      const rewardStatus = completedRequirements === totalRequirements ? 'UNDER_REVIEW' : 'NOT_ELIGIBLE';

      // 5. Create Submission Record
      const submission = await tx.campaignSubmission.create({
        data: {
          campaignLinkId: link.id,
          userId: user.id,
          checklist: checklist,
          totalRequirements,
          completedRequirements,
          rewardStatus
        }
      });

      // 6. Update Link Status
      await tx.campaignLink.update({
        where: { id: link.id },
        data: { status: 'USED' }
      });

      // 7. Create Submissions (Artworks) for Single, Six, Twelve if uploaded
      const artworkService = new ArtworkService();
      
      if (checklist.singleArtwork.status) {
        const singleData = {
          kind: 'SINGLE',
          title: body.singleTitle,
          story: body.singleStory,
          quality: body.singleQuality,
          resolution: body.singleResolution,
          categoryId: body.singleCategoryId,
          subcategoryId: body.singleSubcategoryId,
          zodiacSign: body.singleZodiacSign,
          isAiGenerated: body.isAiGenerated === 'true' || body.isAiGenerated === true,
          copyrightConfirmed: body.copyrightConfirmed === 'true' || body.copyrightConfirmed === true,
          competitionState: 'IN_COMPETITION'
        };
        const singleFiles = [
          ...(files.singlePhoto || []),
          ...(files.singleVideo || [])
        ];
        await artworkService.createArtwork(user.id, singleData, singleFiles, sourceLang, tx);
      }

      if (checklist.sixSeriesArtwork.status) {
        const sixData = {
          kind: 'SIX',
          theme: body.sixTheme,
          title: body.sixTitle,
          story: body.sixStory,
          quality: body.sixQuality,
          resolution: body.sixResolution,
          categoryId: body.sixCategoryId,
          subcategoryId: body.sixSubcategoryId,
          isAiGenerated: body.isAiGenerated === 'true' || body.isAiGenerated === true,
          copyrightConfirmed: body.copyrightConfirmed === 'true' || body.copyrightConfirmed === true,
          competitionState: 'IN_COMPETITION'
        };
        const sixFiles = [
          ...(files.sixPhotos || []),
          ...(files.sixVideo || [])
        ];
        await artworkService.createArtwork(user.id, sixData, sixFiles, sourceLang, tx);
      }

      if (checklist.twelveSeriesArtwork.status) {
        const twelveData = {
          kind: 'TWELVE',
          theme: body.twelveTheme,
          title: body.twelveTitle,
          story: body.twelveStory,
          quality: body.twelveQuality,
          resolution: body.twelveResolution,
          categoryId: body.twelveCategoryId,
          subcategoryId: body.twelveSubcategoryId,
          isAiGenerated: body.isAiGenerated === 'true' || body.isAiGenerated === true,
          copyrightConfirmed: body.copyrightConfirmed === 'true' || body.copyrightConfirmed === true,
          competitionState: 'IN_COMPETITION'
        };
        const twelveFiles = [
          ...(files.twelvePhotos || []),
          ...(files.twelveVideo || [])
        ];
        await artworkService.createArtwork(user.id, twelveData, twelveFiles, sourceLang, tx);
      }

      return {
        user: { id: user.id, email: user.email, username: user.username },
        submission: {
          id: submission.id,
          checklist,
          rewardStatus,
          score: `${completedRequirements}/${totalRequirements}`
        }
      };
    });
  }
}
