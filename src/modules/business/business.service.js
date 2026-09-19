import prisma from '../../config/prisma.js';
import config from '../../config/env.js';

export class BusinessService {
  async createBusinessAlbum(userId, data, mediaFiles) {
    const {
      kind,
      theme,
      zodiacSign,
      zodiacSigns,
      categoryId,
      subcategoryId,
      title,
      story,
      isAiGenerated,
      copyrightConfirmed
    } = data;

    // Fetch user details to populate missing fields
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const albumEmail = user.email;
    const albumPhone = user.phone;
    const albumCountry = user.country;

    // Generate a unique frontend link ID
    const albumId = `ALB-${Math.floor(10000 + Math.random() * 90000)}`;
    const baseUrl = config.app.frontendUrl ? config.app.frontendUrl.replace(/\/$/, '') : 'http://localhost:3000';
    const businessLink = `${baseUrl}/business-links/${albumId}`;

    let imageMedias = [];
    let videoMedias = [];

    const images = mediaFiles.filter(f => f.fieldname === 'images');
    const videos = mediaFiles.filter(f => f.fieldname === 'video');

    if (kind === 'TWELVE') {
      const parsedSigns = typeof zodiacSigns === 'string' ? JSON.parse(zodiacSigns) : zodiacSigns;
      const signsOrder = parsedSigns || ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
      imageMedias = images.map((file, index) => ({
        kind: 'IMAGE',
        slotIndex: index,
        zodiacSign: signsOrder[index] || null,
        url: `/uploads/${file.filename}`,
        format: file.mimetype,
        bytes: file.size,
      }));
    } else if (kind === 'SIX') {
      const ZODIAC_SIGNS = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];
      imageMedias = images.map((file, index) => {
        let mappedSign = null;
        if (theme === 'RED') {
          mappedSign = ZODIAC_SIGNS[index] || null; // 0 to 5
        } else if (theme === 'BLUE') {
          mappedSign = ZODIAC_SIGNS[index + 6] || null; // 6 to 11
        }
        return {
          kind: 'IMAGE',
          slotIndex: theme === 'BLUE' ? index + 6 : index,
          zodiacSign: mappedSign,
          url: `/uploads/${file.filename}`,
          format: file.mimetype,
          bytes: file.size,
        };
      });
    } else {
      // SINGLE
      imageMedias = images.map((file, index) => ({
        kind: 'IMAGE',
        slotIndex: index,
        url: `/uploads/${file.filename}`,
        format: file.mimetype,
        bytes: file.size,
      }));
    }

    if (videos.length > 0) {
      videoMedias = videos.map(file => ({
        kind: 'VIDEO',
        slotIndex: 0,
        url: `/uploads/${file.filename}`,
        format: file.mimetype,
        bytes: file.size,
      }));
    }

    const allMedia = [...imageMedias, ...videoMedias];

    const album = await prisma.businessAlbum.create({
      data: {
        albumId,
        userId,
        email: albumEmail,
        phone: albumPhone,
        country: albumCountry,
        businessLink,
        kind,
        theme: theme || null,
        zodiacSign: zodiacSign || null,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        title: typeof title === 'string' ? JSON.parse(title) : title,
        story: typeof story === 'string' ? JSON.parse(story) : story,
        isAiGenerated: isAiGenerated || false,
        copyrightConfirmed: copyrightConfirmed || false,
        media: {
          create: allMedia
        }
      },
      select: { id: true, businessLink: true }
    });

    return album;
  }

  async getAllBusinessAlbums(skip = 0, take = 10) {
    const [albums, total] = await Promise.all([
      prisma.businessAlbum.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          albumId: true,
          userId: true,
          email: true,
          phone: true,
          country: true,
          createdAt: true,
          user: {
            select: { name: true }
          }
        }
      }),
      prisma.businessAlbum.count()
    ]);

    const formattedAlbums = albums.map(album => {
      const { user, ...rest } = album;
      return {
        ...rest,
        name: user?.name || null
      };
    });

    return { data: formattedAlbums, total };
  }

  async getBusinessAlbumDetails(id) {
    return prisma.businessAlbum.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true, email: true }
        },
        category: true,
        media: {
          orderBy: { slotIndex: 'asc' }
        }
      }
    });
  }
}
