import prisma from '../src/config/prisma.js';

const sampleImages = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
  'https://images.unsplash.com/photo-1511556532299-8f662fc26c06',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e'
];

async function seedUserData() {
  console.log('🌱 Seeding specific test user data...');

  const regularUser = await prisma.user.findFirst({ where: { role: 'USER' } });
  if (!regularUser) {
    console.error('No regular user found!');
    return;
  }
  console.log(`Target User: ${regularUser.username} (${regularUser.id})`);

  // 1. Assign 3 Submissions to this user with promotions and ranks
  const submissions = await prisma.submission.findMany({ take: 3 });
  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        userId: regularUser.id,
        rank: i + 1,
        status: 'APPROVED',
        competitionState: 'IN_COMPETITION'
      }
    });

    // Promotion
    await prisma.promotedAlbum.upsert({
      where: { submissionId: sub.id },
      create: {
        submissionId: sub.id,
        userId: regularUser.id,
        amountPaid: 45.00,
        durationDays: 14,
        isActive: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000)
      },
      update: {
        isActive: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000)
      }
    });
  }

  // 2. Assign 3 PremiumPhotos to regularUser
  const premiumPhotos = await prisma.premiumPhoto.findMany({ take: 3 });
  for (let i = 0; i < premiumPhotos.length; i++) {
    await prisma.premiumPhoto.update({
      where: { id: premiumPhotos[i].id },
      data: {
        user: { connect: { id: regularUser.id } },
        isActive: true,
        price: 35.00 + (i * 10)
      }
    });
  }

  // 3. Create PAID Order containing PremiumPhotos for regularUser (My Purchases)
  const otherSeller = await prisma.user.findFirst({
    where: { role: 'USER', id: { not: regularUser.id } }
  });

  const photoToBuy = premiumPhotos[0];
  const paidOrder = await prisma.order.create({
    data: {
      userId: regularUser.id,
      email: regularUser.email,
      fullName: regularUser.name || 'Test User',
      address: '742 Evergreen Terrace, London, UK',
      total: 55.00,
      currency: 'GBP',
      status: 'PAID',
      paymentMethod: 'PayPal',
      paymentId: `PAID-PURCHASE-${Date.now()}`,
      items: {
        create: [
          {
            premiumPhotoId: photoToBuy.id,
            price: 55.00,
            quantity: 1
          }
        ]
      }
    }
  });
  console.log(`Created PAID order for purchases: ${paidOrder.id}`);

  // 4. Create Payouts for regularUser (PRIZE, PREMIUM, DONATION, STORE)
  const kinds = ['PRIZE', 'PREMIUM', 'DONATION', 'STORE'];
  for (const k of kinds) {
    await prisma.payout.create({
      data: {
        userId: regularUser.id,
        kind: k,
        amount: 250.00,
        currency: 'GBP',
        accountType: 'PayPal',
        accountNumber: regularUser.email,
        status: 'PAID'
      }
    });
  }

  // 5. Create Support Ticket for regularUser
  await prisma.supportTicket.create({
    data: {
      userId: regularUser.id,
      name: regularUser.name,
      email: regularUser.email,
      category: 'ACCOUNT',
      title: 'Profile verification inquiry',
      title_pl: 'Zapytanie o weryfikację profilu',
      message: 'Hello, I have submitted my identity documents for professional photographer verification.',
      attachments: [sampleImages[0]],
      answer: 'Your verification is currently under review by our moderation team.',
      answer_pl: 'Twoja weryfikacja jest obecnie sprawdzana przez nasz zespół moderacyjny.',
      answeredAt: new Date(),
      status: 'ANSWERED'
    }
  });

  await prisma.supportTicket.create({
    data: {
      userId: regularUser.id,
      name: regularUser.name,
      email: regularUser.email,
      category: 'BILLING',
      title: 'Payout processing time question',
      title_pl: 'Pytanie o czas przetwarzania wypłaty',
      message: 'When can I expect my prize money payout to arrive in my PayPal account?',
      attachments: [sampleImages[1]],
      status: 'PENDING'
    }
  });

  // Update all tickets with empty attachments
  await prisma.supportTicket.updateMany({
    where: { attachments: { isEmpty: true } },
    data: {
      attachments: [sampleImages[0]]
    }
  });

  // 6. Update Store Products with setEditionSize
  await prisma.product.updateMany({
    data: {
      setEditionSize: 'Limited Edition (1 of 50)',
      isActive: true
    }
  });

  // Also ensure regularUser has a product
  const userProd = await prisma.product.findFirst({ where: { userId: regularUser.id } });
  if (!userProd) {
    await prisma.product.create({
      data: {
        userId: regularUser.id,
        category: 'ART_PRINTS',
        title: 'Nebula Over Mountain Peaks Canvas',
        price: 75.00,
        setEditionSize: 'Limited Edition (1 of 25)',
        description: 'Archival museum-grade canvas art print.',
        bannerImage: sampleImages[0],
        images: [sampleImages[1]],
        isActive: true
      }
    });
  }

  // 7. Update Chat Messages with non-null fileUrl, fileType, fileName
  const lastMsg = await prisma.chatMessage.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  if (lastMsg) {
    await prisma.chatMessage.update({
      where: { id: lastMsg.id },
      data: {
        fileUrl: sampleImages[0],
        fileType: 'image/jpeg',
        fileName: 'mountain_nebula_preview.jpg'
      }
    });
  }

  console.log('✅ Specific test user data seeded successfully!');
}

seedUserData()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
