import prisma from '../src/config/prisma.js';
import { HashUtil } from '../src/utils/hash.js';

const sampleImages = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
  'https://images.unsplash.com/photo-1511556532299-8f662fc26c06',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05',
  'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e',
  'https://images.unsplash.com/photo-1501785888041-af3ef285b470',
  'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401'
];

const sampleAvatars = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80'
];

const sampleVideos = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
];

async function seedRichData() {
  console.log('🚀 Starting Comprehensive Rich Data Seeding...');

  // 1. Fetch Admin and Users
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    console.error('Admin user not found!');
    return;
  }

  const allUsers = await prisma.user.findMany({ where: { role: 'USER' } });
  console.log(`Found ${allUsers.length} users in database.`);

  // 2. Ensure ALL Users have full, non-empty profile fields
  console.log('👤 Updating all user profiles with rich data...');
  const cities = ['London', 'New York', 'Paris', 'Tokyo', 'Berlin', 'Warsaw', 'Toronto', 'Sydney'];
  const countries = ['United Kingdom', 'United States', 'France', 'Japan', 'Germany', 'Poland', 'Canada', 'Australia'];

  for (let i = 0; i < allUsers.length; i++) {
    const u = allUsers[i];
    await prisma.user.update({
      where: { id: u.id },
      data: {
        avatar: u.avatar || sampleAvatars[i % sampleAvatars.length],
        coverPhoto: u.coverPhoto || sampleImages[i % sampleImages.length],
        introVideo: u.introVideo || sampleVideos[i % sampleVideos.length],
        bio: u.bio || `Professional landscape and astrophotographer with over 10 years of experience. Capturing the wonders of nature.`,
        bio_pl: u.bio_pl || `Profesjonalny fotograf krajobrazu i astrofotograf z ponad 10-letnim doświadczeniem.`,
        city: u.city || cities[i % cities.length],
        city_pl: u.city_pl || cities[i % cities.length],
        country: u.country || countries[i % countries.length],
        country_pl: u.country_pl || countries[i % countries.length],
        phone: u.phone || `+44 7911 12345${i}`,
        socialLinks: (u.socialLinks && u.socialLinks.length > 0) ? u.socialLinks : [
          `https://instagram.com/${u.username}`,
          `https://twitter.com/${u.username}`,
          `https://facebook.com/${u.username}`
        ],
        isVerified: true,
        status: 'ACTIVE'
      }
    });
  }

  // 3. Seed Follow relationships (Every user follows others so followers/following is never empty)
  console.log('🤝 Seeding follow relationships...');
  for (let i = 0; i < allUsers.length; i++) {
    const follower = allUsers[i];
    // Follow the next 3 users
    for (let j = 1; j <= 3; j++) {
      const following = allUsers[(i + j) % allUsers.length];
      if (follower.id !== following.id) {
        await prisma.follow.upsert({
          where: {
            followerId_followingId: {
              followerId: follower.id,
              followingId: following.id
            }
          },
          create: {
            followerId: follower.id,
            followingId: following.id
          },
          update: {}
        });
      }
    }
  }

  // 4. Update Album Types with iconKey and features
  console.log('🏷️ Updating Album Types with iconKey & features...');
  await prisma.albumType.updateMany({
    where: { kind: 'SINGLE' },
    data: { 
      iconKey: 'single_photo',
      description: 'Submit a single outstanding photograph to compete globally.',
      description_pl: 'Prześlij jedno wyjątkowe zdjęcie, aby rywalizować globalnie.',
      features: ['1 High-resolution Photo', 'Public & Competition Display', 'Global Voting Access'],
      features_pl: ['1 Zdjęcie wysokiej rozdzielczości', 'Ekspozycja publiczna i konkursowa', 'Globalne głosowanie']
    }
  });
  await prisma.albumType.updateMany({
    where: { kind: 'SIX' },
    data: { 
      iconKey: 'six_photo',
      description: 'Craft a visual narrative using six sequenced images.',
      description_pl: 'Stwórz wizualną narrację za pomocą sześciu ujęć.',
      features: ['6 Story Images', 'Sequential Narrative Layout', 'Eligible for Story Awards'],
      features_pl: ['6 Zdjęć narracyjnych', 'Układ sekwencyjny', 'Kwalifikacja do nagród za historię']
    }
  });
  await prisma.albumType.updateMany({
    where: { kind: 'TWELVE' },
    data: { 
      iconKey: 'twelve_photo',
      description: 'Create a complete zodiac-themed visual journey.',
      description_pl: 'Stwórz kompletną podróż wizualną o tematyce zodiaku.',
      features: ['12 Full Zodiac Cycle Images', 'Grand Prize Eligibility', 'Dedicated Showcase Badge'],
      features_pl: ['12 Zdjęć cyklu zodiaku', 'Kwalifikacja do nagrody głównej', 'Dedykowana odznaka wyróżnienia']
    }
  });

  // 5. Update Categories and Subcategories with descriptions
  console.log('📂 Ensuring Categories have descriptions & subcategories...');
  const existingCategories = await prisma.category.findMany();
  for (const cat of existingCategories) {
    await prisma.category.update({
      where: { id: cat.id },
      data: {
        description: cat.description || `Explore breathtaking photographs in the ${cat.name || 'curated'} category.`,
        description_pl: cat.description_pl || `Odkryj zapierające dech w piersiach zdjęcia w tej kategorii.`
      }
    });

    // Ensure subcategories exist
    const subCount = await prisma.category.count({ where: { parentId: cat.id } });
    if (subCount === 0 && !cat.parentId) {
      const subNames = ['Featured Shots', 'Creative Perspectives', 'Master Series'];
      for (const sName of subNames) {
        const sSlug = `${cat.slug}-${sName.toLowerCase().replace(/\s+/g, '-')}`;
        const exists = await prisma.category.findUnique({ where: { slug: sSlug } });
        if (!exists) {
          await prisma.category.create({
            data: {
              name: sName,
              name_pl: sName,
              slug: sSlug,
              description: `${sName} subcategory for ${cat.name || 'category'}`,
              description_pl: `Podkategoria ${sName}`,
              parentId: cat.id,
              isActive: true
            }
          });
        }
      }
    }
  }

  // 6. Ensure Active Competition & Submissions
  console.log('🏆 Ensuring active competition & submissions...');
  const d = new Date();
  const currentYear = d.getFullYear();
  const currentMonth = d.getMonth() + 1;

  let activeComp = await prisma.competition.findUnique({
    where: { year_month: { year: currentYear, month: currentMonth } }
  });

  if (!activeComp) {
    activeComp = await prisma.competition.create({
      data: {
        title: `Photography Competition - ${currentMonth}/${currentYear}`,
        title_pl: `Konkurs Fotograficzny - ${currentMonth}/${currentYear}`,
        year: currentYear,
        month: currentMonth,
        status: 'OPEN',
        startsAt: new Date(currentYear, currentMonth - 1, 1),
        endsAt: new Date(currentYear, currentMonth, 0, 23, 59, 59),
        timezone: 'Europe/London'
      }
    });
  }

  // 7. Ensure Submissions have media, images, video, and attach some to active competition
  console.log('🖼️ Enriching all submissions with images, video, and details...');
  const allSubmissions = await prisma.submission.findMany({
    include: { media: true, albumType: true }
  });

  const categories = await prisma.category.findMany({ where: { parentId: null } });

  for (let i = 0; i < allSubmissions.length; i++) {
    const sub = allSubmissions[i];
    const user = allUsers[i % allUsers.length];

    // Assign featuredImage if missing
    const featImg = sub.featuredImage || sampleImages[i % sampleImages.length];

    // Assign category if missing
    const catId = sub.categoryId || (categories.length > 0 ? categories[i % categories.length].id : null);

    // Make sure some are in IN_COMPETITION and some in PROFILE_ONLY
    const compState = (i % 2 === 0) ? 'IN_COMPETITION' : 'PROFILE_ONLY';
    // Make first 3 PENDING so admin recent competition has pending submissions!
    const status = (i < 3) ? 'PENDING' : 'APPROVED';

    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        featuredImage: featImg,
        story: sub.story || `Captured during golden hour in the wilderness. The lighting and atmosphere created an unforgettable composition.`,
        story_pl: sub.story_pl || `Uchwycone podczas złotej godziny w dziczy. Oświetlenie i atmosfera stworzyły niezapomnianą kompozycję.`,
        camera: sub.camera || 'Sony Alpha A7R V',
        resolution: sub.resolution || '9504 x 6336 (61 MP)',
        format: sub.format || 'RAW / DNG',
        quality: sub.quality || 'Ultra High Definition 4K',
        viewsCount: sub.viewsCount > 0 ? sub.viewsCount : (i + 1) * 45,
        likesCount: sub.likesCount > 0 ? sub.likesCount : (i + 1) * 12,
        votesCount: sub.votesCount > 0 ? sub.votesCount : (i + 1) * 25,
        competitionId: (compState === 'IN_COMPETITION') ? activeComp.id : sub.competitionId,
        competitionState: compState,
        status: status,
        categoryId: catId,
        userId: user.id
      }
    });

    // Seed SubmissionMedia (Image slot + Video slot)
    const requiredPhotos = sub.albumType?.photoCount || 1;
    for (let slot = 0; slot < requiredPhotos; slot++) {
      const mediaImgUrl = sampleImages[(i + slot) % sampleImages.length];
      await prisma.submissionMedia.upsert({
        where: {
          submissionId_slotIndex: {
            submissionId: sub.id,
            slotIndex: slot
          }
        },
        create: {
          submissionId: sub.id,
          slotIndex: slot,
          kind: 'IMAGE',
          url: mediaImgUrl,
          thumbnailUrl: mediaImgUrl,
          width: 3840,
          height: 2160,
          format: 'image/jpeg',
          bytes: 4500000
        },
        update: {
          url: mediaImgUrl,
          thumbnailUrl: mediaImgUrl
        }
      });
    }

    // Seed Video slot (slotIndex 99) so `artwork.video` is never null!
    const videoUrl = sampleVideos[i % sampleVideos.length];
    await prisma.submissionMedia.upsert({
      where: {
        submissionId_slotIndex: {
          submissionId: sub.id,
          slotIndex: 99
        }
      },
      create: {
        submissionId: sub.id,
        slotIndex: 99,
        kind: 'VIDEO',
        url: videoUrl,
        thumbnailUrl: featImg,
        width: 1920,
        height: 1080,
        format: 'video/mp4',
        bytes: 15000000
      },
      update: {
        url: videoUrl,
        kind: 'VIDEO',
        format: 'video/mp4'
      }
    });
  }

  // 8. Seed Likes & Votes on Submissions
  console.log('❤️ Seeding Likes and Votes...');
  for (let i = 0; i < allSubmissions.length; i++) {
    const sub = allSubmissions[i];
    for (let uIdx = 0; uIdx < 5; uIdx++) {
      const u = allUsers[(i + uIdx) % allUsers.length];
      await prisma.like.upsert({
        where: {
          submissionId_userId: {
            submissionId: sub.id,
            userId: u.id
          }
        },
        create: {
          submissionId: sub.id,
          userId: u.id
        },
        update: {}
      });

      // Vote
      await prisma.vote.upsert({
        where: {
          ipAddress_submissionId: {
            ipAddress: `192.168.1.${10 + uIdx + i}`,
            submissionId: sub.id
          }
        },
        create: {
          submissionId: sub.id,
          userId: u.id,
          ipAddress: `192.168.1.${10 + uIdx + i}`,
          kind: sub.kind || 'SINGLE',
          year: currentYear,
          month: currentMonth
        },
        update: {}
      });

      // Saved Artwork
      await prisma.savedArtwork.upsert({
        where: {
          submissionId_userId: {
            submissionId: sub.id,
            userId: u.id
          }
        },
        create: {
          submissionId: sub.id,
          userId: u.id
        },
        update: {}
      });
    }
  }

  // 9. Seed Comments (PENDING and APPROVED)
  console.log('💬 Seeding comments with various statuses...');
  const sampleComments = [
    'Outstanding depth and clarity! The colors are truly mesmerizing.',
    'Amazing composition! Was this taken using a wide-angle lens?',
    'Incredible perspective, great entry for this competition!',
    'Stunning work, you got my vote!',
    'Brilliant contrast and fine detail in the shadows.'
  ];

  for (let i = 0; i < 15; i++) {
    const sub = allSubmissions[i % allSubmissions.length];
    const u = allUsers[i % allUsers.length];
    const pCode = `CMT-${Date.now()}-${i}`;
    const commentStatus = i < 5 ? 'PENDING' : 'APPROVED';

    const existingCmt = await prisma.comment.findFirst({
      where: { submissionId: sub.id, userId: u.id }
    });

    if (!existingCmt) {
      await prisma.comment.create({
        data: {
          publicCode: pCode,
          submissionId: sub.id,
          userId: u.id,
          body: sampleComments[i % sampleComments.length],
          body_pl: 'Niesamowita głębia i kompozycja! Wspaniałe ujęcie.',
          status: commentStatus,
          isPinned: i === 0
        }
      });
    }
  }

  // 10. Seed Demo Profiles (Currently 0 records!)
  console.log('🎭 Seeding Demo Profiles...');
  const demoProfilesData = [
    {
      fullName: 'Alexander Wright',
      username: 'alex_wright_photo',
      phone: '+44 7700 900077',
      email: 'alex.wright@demo-profiles.com',
      bio: 'Award-winning landscape and documentary photographer based in Edinburgh, UK.',
      bio_pl: 'Nagradzany fotograf krajobrazu i dokumentu z Edynburga.',
      profilePhoto: sampleAvatars[0],
      coverPhoto: sampleImages[0],
      bannerUrl: sampleImages[1],
      socialLinks: ['https://instagram.com/alexwright', 'https://500px.com/alexwright']
    },
    {
      fullName: 'Elena Rostova',
      username: 'elena_wildlife',
      phone: '+44 7700 900088',
      email: 'elena.rostova@demo-profiles.com',
      bio: 'Wildlife enthusiast traveling across polar regions capturing endangered Arctic species.',
      bio_pl: 'Pasjonatka dzikiej przyrody podróżująca po regionach polarnych.',
      profilePhoto: sampleAvatars[1],
      coverPhoto: sampleImages[2],
      bannerUrl: sampleImages[3],
      socialLinks: ['https://instagram.com/elenawildlife', 'https://twitter.com/elenawild']
    },
    {
      fullName: 'Marcus Vance',
      username: 'marcus_astronomy',
      phone: '+44 7700 900099',
      email: 'marcus.vance@demo-profiles.com',
      bio: 'Deep space astrophotographer tracking nebulae and distant galaxies from high-altitude observatories.',
      bio_pl: 'Astrofotograf głębokiego nieba śledzący mgławice i odległe galaktyki.',
      profilePhoto: sampleAvatars[2],
      coverPhoto: sampleImages[4],
      bannerUrl: sampleImages[5],
      socialLinks: ['https://instagram.com/marcusastro']
    },
    {
      fullName: 'Sophia Martinez',
      username: 'sophia_streetart',
      phone: '+44 7700 900111',
      email: 'sophia.martinez@demo-profiles.com',
      bio: 'Urban architecture and candid street life photographer capturing vibrant city cultures.',
      bio_pl: 'Fotografka architektury miejskiej i życia ulicznego.',
      profilePhoto: sampleAvatars[3],
      coverPhoto: sampleImages[6],
      bannerUrl: sampleImages[7],
      socialLinks: ['https://instagram.com/sophiastreet']
    },
    {
      fullName: 'David Chen',
      username: 'david_macro',
      phone: '+44 7700 900222',
      email: 'david.chen@demo-profiles.com',
      bio: 'Microscopic and macro nature photography exploring hidden textures in flora and fauna.',
      bio_pl: 'Fotografia makro i mikroskopowa odkrywająca ukryte tekstury natury.',
      profilePhoto: sampleAvatars[4],
      coverPhoto: sampleImages[8],
      bannerUrl: sampleImages[9],
      socialLinks: ['https://instagram.com/davidmacro']
    }
  ];

  const defaultHash = await HashUtil.hash('demo12345');
  for (const dp of demoProfilesData) {
    const existing = await prisma.demoProfile.findUnique({ where: { username: dp.username } });
    if (!existing) {
      await prisma.demoProfile.create({
        data: {
          ...dp,
          password: defaultHash,
          createdById: adminUser.id,
          isActive: true
        }
      });
    }
  }

  // 11. Seed Payouts (PRIZE, DONATION, PREMIUM, STORE)
  console.log('💰 Seeding Payouts across all kinds...');
  const payoutKinds = ['PRIZE', 'DONATION', 'PREMIUM', 'STORE'];
  for (let i = 0; i < payoutKinds.length; i++) {
    const kind = payoutKinds[i];
    const u = allUsers[i % allUsers.length];

    // Check if payout exists for this kind
    const count = await prisma.payout.count({ where: { kind } });
    if (count === 0) {
      await prisma.payout.create({
        data: {
          userId: u.id,
          kind: kind,
          amount: 250.00 + (i * 150),
          currency: 'GBP',
          accountType: 'PayPal',
          accountNumber: u.email,
          status: i % 2 === 0 ? 'PENDING' : 'PAID'
        }
      });
    }

    // Also ensure regular user has at least one of each kind so user payment endpoints are populated!
    const userPayoutExists = await prisma.payout.findFirst({ where: { userId: allUsers[0].id, kind } });
    if (!userPayoutExists) {
      await prisma.payout.create({
        data: {
          userId: allUsers[0].id,
          kind: kind,
          amount: 320.00 + (i * 80),
          currency: 'GBP',
          accountType: 'PayPal',
          accountNumber: allUsers[0].email,
          status: 'PAID'
        }
      });
    }
  }

  // 12. Seed Donations Received by Users
  console.log('🎁 Seeding donations...');
  for (let i = 0; i < 5; i++) {
    const sub = allSubmissions[i % allSubmissions.length];
    const donor = allUsers[(i + 1) % allUsers.length];
    const recipient = allUsers[i % allUsers.length];

    await prisma.donation.create({
      data: {
        submissionId: sub.id,
        artistId: recipient.id,
        donorId: donor.id,
        donorName: donor.name || 'Art Patron',
        donorEmail: donor.email,
        amount: 25.00 * (i + 1),
        type: 'ONE_TIME',
        status: 'COMPLETED',
        message: 'Keep up the magnificent photography work!'
      }
    });
  }

  // 13. Seed Store Products across ALL categories
  console.log('🛍️ Seeding Store Products across all categories...');
  const productCategories = [
    'ART_PRINTS',
    'HANDMADE_CRAFTS',
    'APPAREL',
    'PHOTOBOOKS',
    'DIGITAL_PRESET',
    'OTHERS'
  ];

  for (let i = 0; i < productCategories.length; i++) {
    const pCat = productCategories[i];
    const u = allUsers[i % allUsers.length];

    const existingProduct = await prisma.product.findFirst({ where: { category: pCat } });
    if (!existingProduct) {
      await prisma.product.create({
        data: {
          userId: u.id,
          category: pCat,
          title: `Premium ${pCat.replace(/_/g, ' ')} Collection`,
          title_pl: `Kolekcja ${pCat.replace(/_/g, ' ')}`,
          price: 49.99 + (i * 15),
          description: `High-grade archival museum quality ${pCat.toLowerCase().replace(/_/g, ' ')} designed for photography enthusiasts.`,
          description_pl: `Wysokiej jakości produkt przeznaczony dla entuzjastów fotografii.`,
          bannerImage: sampleImages[i % sampleImages.length],
          images: [
            sampleImages[(i + 1) % sampleImages.length],
            sampleImages[(i + 2) % sampleImages.length]
          ],
          isActive: true
        }
      });
    }
  }

  // Also ensure regular user has products so `GET /api/v1/store` has data!
  const userProducts = await prisma.product.count({ where: { userId: allUsers[0].id } });
  if (userProducts === 0) {
    await prisma.product.create({
      data: {
        userId: allUsers[0].id,
        category: 'ART_PRINTS',
        title: 'Limited Edition Fine Art Canvas Print',
        title_pl: 'Limitowany druk na płótnie',
        price: 89.00,
        description: 'Signed limited edition print on heavyweight fine art canvas.',
        bannerImage: sampleImages[0],
        images: [sampleImages[1], sampleImages[2]],
        isActive: true
      }
    });
  }

  // 14. Seed Orders & OrderItems (Buyer & Seller)
  console.log('📦 Seeding Orders for Buyer and Seller status cards...');
  const allProducts = await prisma.product.findMany();
  const allPremiumPhotos = await prisma.premiumPhoto.findMany();

  const orderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'PAID'];
  for (let i = 0; i < orderStatuses.length; i++) {
    const status = orderStatuses[i];
    const buyer = allUsers[0]; // Regular user as buyer
    const product = allProducts[i % allProducts.length];
    const photo = allPremiumPhotos[i % allPremiumPhotos.length];

    const order = await prisma.order.create({
      data: {
        userId: buyer.id,
        email: buyer.email,
        fullName: buyer.name || 'John Doe',
        address: '123 Photography Lane, London, UK',
        total: 120.00 + (i * 25),
        currency: 'GBP',
        status: status,
        paymentMethod: 'PayPal',
        paymentId: `PAY-${Date.now()}-${i}`
      }
    });

    // Item 1: Store Product
    if (product) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          price: product.price,
          quantity: 1,
          size: 'A2 (420 x 594 mm)'
        }
      });
    }

    // Item 2: Premium Photo (so User My Purchases list has photos!)
    if (photo) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          premiumPhotoId: photo.id,
          price: photo.price || 25.00,
          quantity: 1
        }
      });
    }
  }

  // Also create orders where regular user is the SELLER
  if (userProducts > 0 || allProducts.some(p => p.userId === allUsers[0].id)) {
    const userSoldProduct = allProducts.find(p => p.userId === allUsers[0].id) || allProducts[0];
    for (let i = 0; i < 3; i++) {
      const otherBuyer = allUsers[(i + 1) % allUsers.length];
      const sellerOrder = await prisma.order.create({
        data: {
          userId: otherBuyer.id,
          email: otherBuyer.email,
          fullName: otherBuyer.name,
          address: '45 Studio Boulevard, Bristol, UK',
          total: Number(userSoldProduct.price),
          currency: 'GBP',
          status: orderStatuses[i % orderStatuses.length],
          paymentMethod: 'PayPal',
          paymentId: `SELLER-PAY-${Date.now()}-${i}`
        }
      });

      await prisma.orderItem.create({
        data: {
          orderId: sellerOrder.id,
          productId: userSoldProduct.id,
          price: userSoldProduct.price,
          quantity: 1,
          size: 'A1'
        }
      });
    }
  }

  // 15. Seed Photographer Messages / Posts (User & Public)
  console.log('📰 Seeding Photographer Posts / News...');
  for (let i = 0; i < allUsers.length; i++) {
    const u = allUsers[i];
    const postCount = await prisma.photographerMessage.count({ where: { userId: u.id } });
    if (postCount === 0) {
      const isVideo = i % 2 === 0;
      await prisma.photographerMessage.create({
        data: {
          userId: u.id,
          body: `Behind the scenes of our latest mountain expedition! Setting up camp at 3,000 meters altitude.`,
          body_pl: `Za kulisami naszej ostatniej wyprawy górskiej! Rozbijamy obóz na wysokości 3000 metrów.`,
          mediaUrl: isVideo ? sampleVideos[i % sampleVideos.length] : sampleImages[i % sampleImages.length],
          mediaType: isVideo ? 'VIDEO' : 'IMAGE',
          copyrightConfirmed: true,
          likesCount: 15 + i
        }
      });
    }
  }

  // 16. Seed Support Tickets (Pending and Answered)
  console.log('🎫 Seeding Support Tickets...');
  const userTicketsCount = await prisma.supportTicket.count({ where: { userId: allUsers[0].id } });
  if (userTicketsCount === 0) {
    // Ticket 1: Pending
    await prisma.supportTicket.create({
      data: {
        userId: allUsers[0].id,
        name: allUsers[0].name,
        email: allUsers[0].email,
        category: 'COMPETITION',
        title: 'Inquiry regarding 12-photos zodiac competition submission deadlines',
        title_pl: 'Zapytanie dotyczące terminów nadsyłania zgłoszeń',
        message: 'Hello, could you please confirm if the zodiac 12-photo story allows submitting multiple sequences in the same month?',
        status: 'PENDING'
      }
    });

    // Ticket 2: Answered
    await prisma.supportTicket.create({
      data: {
        userId: allUsers[0].id,
        name: allUsers[0].name,
        email: allUsers[0].email,
        category: 'BILLING',
        title: 'PayPal payout processing time',
        title_pl: 'Czas przetwarzania wypłaty PayPal',
        message: 'How long does it typically take for approved prize money payouts to appear in PayPal?',
        answer: 'Hello! Approved prize money withdrawals are sent instantly and usually arrive in your PayPal account within 1 to 2 business hours.',
        answer_pl: 'Wypłaty są wysyłane natychmiastowo i zazwyczaj docierają w ciągu 1-2 godzin roboczych.',
        status: 'ANSWERED',
        answeredAt: new Date()
      }
    });
  }

  // 17. Seed Admin Reports (Report and ModerationAudit)
  console.log('🚨 Seeding Reports & Moderation Audits...');
  const reportCount = await prisma.report.count();
  if (reportCount < 5) {
    const reportReasons = [
      'Inappropriate content description',
      'Potential copyright violation',
      'Spam commentary in discussions',
      'Unverified photographer credentials'
    ];

    for (let i = 0; i < reportReasons.length; i++) {
      const sub = allSubmissions[i % allSubmissions.length];
      const reporter = allUsers[(i + 2) % allUsers.length];

      await prisma.report.create({
        data: {
          submissionId: sub.id,
          userId: reporter.id,
          reason: reportReasons[i],
          details: 'Please review this artwork for community guidelines compliance.',
          status: i === 0 ? 'PENDING' : 'RESOLVED'
        }
      });
    }
  }

  const auditCount = await prisma.moderationAudit.count();
  if (auditCount < 5) {
    await prisma.moderationAudit.create({
      data: {
        userId: allUsers[1].id,
        adminId: adminUser.id,
        action: 'WARN',
        reason: 'Friendly reminder to follow community guidelines regarding comment etiquette.'
      }
    });
  }

  // 18. Seed Active Public Advertisements
  console.log('📢 Seeding Active Public Advertisements for Home & Gallery...');
  const adPages = ['Home', 'Gallery', 'Competitions'];
  for (let i = 0; i < adPages.length; i++) {
    const p = adPages[i];
    await prisma.advertisement.create({
      data: {
        name: `ProLens Optical Gear - ${p}`,
        email: 'partnerships@prolensgear.com',
        phone: '+44 20 7946 0991',
        businessType: 'ONLINE',
        businessName: 'ProLens Photography Equipment',
        selectPage: p,
        websiteUrl: 'https://prolensgear.example.com',
        description: 'Discover award-winning cinema and prime telephoto lenses crafted for professional astrophotographers.',
        description_pl: 'Odkryj nagradzany sprzęt fotograficzny i teleobiektywy stworzone dla profesjonalistów.',
        location: 'London, UK',
        location_pl: 'Londyn, Wielka Brytania',
        businessImage: sampleImages[i % sampleImages.length],
        durationDays: 30,
        amount: 100.00,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
        endsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000)
      }
    });
  }

  // 19. Seed Announcements with non-null links and end dates
  console.log('📣 Updating announcements with full links & dates...');
  await prisma.announcement.updateMany({
    data: {
      link: { url: 'https://my12photos.com/competitions', text: 'View Competition' },
      endDate: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      endTime: '23:59',
      activeState: 'active'
    }
  });

  // 20. Seed Chat Rooms & Messages
  console.log('💬 Seeding Chat Rooms and Messages...');
  const chatCount = await prisma.chatRoom.count();
  if (chatCount < 3) {
    for (let i = 0; i < 3; i++) {
      const u1 = allUsers[0]; // regular user
      const u2 = allUsers[(i + 1) % allUsers.length];

      const room = await prisma.chatRoom.create({
        data: {
          participants: {
            create: [
              { userId: u1.id },
              { userId: u2.id }
            ]
          }
        }
      });

      await prisma.chatMessage.createMany({
        data: [
          {
            roomId: room.id,
            senderId: u2.id,
            content: 'Hi! I saw your recent landscape series in the competition, absolutely marvelous work!'
          },
          {
            roomId: room.id,
            senderId: u1.id,
            content: 'Thank you so much! Really appreciate your feedback. Looking forward to your entries as well.'
          }
        ]
      });
    }
  }

  // 21. Seed Competition Winners with place, avatars, featured images & media
  console.log('🥇 Ensuring Competition Winners have full places, avatars & media...');
  const allWinners = await prisma.winner.findMany({
    include: { submission: true, user: true }
  });

  const places = ['FIRST', 'SECOND', 'THIRD', 'POPULAR_VOTE', 'EDITORS_CHOICE'];
  for (let i = 0; i < allWinners.length; i++) {
    const w = allWinners[i];
    const place = places[i % places.length];

    await prisma.winner.update({
      where: { id: w.id },
      data: {
        place: w.place || place,
        isWinner: true
      }
    });

    if (w.submissionId) {
      await prisma.submission.update({
        where: { id: w.submissionId },
        data: {
          prizeMoney: place === 'FIRST' ? 1500.00 : (place === 'SECOND' ? 1000.00 : 500.00),
          featuredImage: sampleImages[i % sampleImages.length],
          status: 'APPROVED'
        }
      });

      // Ensure media exists
      await prisma.submissionMedia.upsert({
        where: {
          submissionId_slotIndex: {
            submissionId: w.submissionId,
            slotIndex: 0
          }
        },
        create: {
          submissionId: w.submissionId,
          slotIndex: 0,
          kind: 'IMAGE',
          url: sampleImages[i % sampleImages.length],
          thumbnailUrl: sampleImages[i % sampleImages.length]
        },
        update: {
          url: sampleImages[i % sampleImages.length],
          thumbnailUrl: sampleImages[i % sampleImages.length]
        }
      });
    }

    if (w.userId) {
      await prisma.user.update({
        where: { id: w.userId },
        data: {
          avatar: sampleAvatars[i % sampleAvatars.length],
          country: 'United Kingdom'
        }
      });
    }
  }

  // 22. Seed Notifications
  console.log('🔔 Seeding User Notifications...');
  const notifCount = await prisma.notification.count({ where: { userId: allUsers[0].id } });
  if (notifCount < 5) {
    const notifs = [
      {
        type: 'COMPETITION',
        title: 'Competition Entry Approved',
        title_pl: 'Zgłoszenie do konkursu zaakceptowane',
        body: 'Your artwork has been approved and is now live for public voting in this month competition!',
        body_pl: 'Twoja praca została zatwierdzona i bierze udział w głosowaniu.'
      },
      {
        type: 'SALE',
        title: 'New Store Order Received',
        title_pl: 'Otrzymano nowe zamówienie',
        body: 'Congratulations! You sold an art print from your store. Check your seller dashboard for shipping details.',
        body_pl: 'Gratulacje! Sprzedałeś wydruk artystyczny.'
      },
      {
        type: 'FOLLOW',
        title: 'New Follower',
        title_pl: 'Nowy obserwujący',
        body: 'Elena Rostova started following your photography journey.',
        body_pl: 'Elena Rostova zaczęła Cię obserwować.'
      }
    ];

    for (const n of notifs) {
      await prisma.notification.create({
        data: {
          userId: allUsers[0].id,
          type: n.type,
          title: n.title,
          title_pl: n.title_pl,
          body: n.body,
          body_pl: n.body_pl,
          isRead: false
        }
      });
    }
  }

  // 23. Seed SiteSetting & AdSlots
  console.log('⚙️ Ensuring SiteSetting and AdSlots...');
  const siteSettingCount = await prisma.siteSetting.count();
  if (siteSettingCount === 0) {
    await prisma.siteSetting.create({
      data: {
        defaultLanguage: 'en',
        adsensePublisherId: 'pub-9876543210123456',
        adsenseEnabled: true,
        votingEnabled: true,
        pointsPerVote: 2,
        supportEmail: 'support@my12photos.com'
      }
    });
  }

  const slotPages = ['Home', 'Gallery', 'Competitions', 'Marketplace'];
  for (const sp of slotPages) {
    const exists = await prisma.adSlot.findFirst({ where: { page: sp } });
    if (!exists) {
      await prisma.adSlot.create({
        data: {
          name: `${sp} Banner Slot`,
          page: sp,
          htmlCode: '<div class="ad-banner">Sponsored Ad</div>',
          isActive: true
        }
      });
    }
  }

  console.log('✅ Seeding completed successfully!');
}

seedRichData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
