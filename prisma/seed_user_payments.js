import prisma from '../src/config/prisma.js';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthNamesPl = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

async function seedUserPayments() {
  console.log('--- Starting User Payment Data Seeding for All Users ---');

  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${allUsers.length} total users in the database.`);

  // 1. Ensure reference taxonomy exists
  let categories = await prisma.category.findMany({ take: 10 });
  let albumTypes = await prisma.albumType.findMany();

  // 2. Ensure 24 competitions exist (2025 and 2026)
  const competitionList = [];
  for (const year of [2025, 2026]) {
    for (let month = 1; month <= 12; month++) {
      const monthStr = month.toString().padStart(2, '0');
      const startsAt = new Date(`${year}-${monthStr}-01T00:00:00.000Z`);
      const lastDay = new Date(year, month, 0).getDate();
      const endsAt = new Date(`${year}-${monthStr}-${lastDay}T23:59:59.999Z`);

      let status = 'CLOSED';
      if (year === 2026 && month === 10) status = 'OPEN';
      if (year === 2026 && month > 10) status = 'UPCOMING';

      const title = `${monthNames[month - 1]} ${year} Photography Competition`;
      const title_pl = `Konkurs Fotograficzny - ${monthNamesPl[month - 1]} ${year}`;

      const comp = await prisma.competition.upsert({
        where: { year_month: { year, month } },
        update: { title, status },
        create: {
          year,
          month,
          title,
          title_pl,
          status,
          startsAt,
          endsAt,
          timezone: 'Europe/London'
        }
      });
      competitionList.push(comp);
    }
  }
  console.log(`Ensured ${competitionList.length} competitions across 2025 and 2026.`);

  const kinds = ['SINGLE', 'SIX', 'TWELVE'];

  // Seed data for each user
  for (let u = 0; u < allUsers.length; u++) {
    const user = allUsers[u];
    console.log(`\n========================================`);
    console.log(`[User ${u + 1}/${allUsers.length}] Seeding: ${user.email} (${user.id})`);
    console.log(`========================================`);

    // ----------------------------------------------------
    // 1. STORE SALES SEEDING
    // ----------------------------------------------------
    console.log('-> Seeding Store Sales...');
    let userProducts = await prisma.product.findMany({ where: { userId: user.id } });
    if (userProducts.length === 0) {
      const p1 = await prisma.product.create({
        data: {
          userId: user.id,
          category: 'ART_PRINTS',
          title: 'Fine Art Print - Alpine Sunrise',
          title_pl: 'Wydruk Fine Art - Alpejski wschód słońca',
          price: 65.00,
          bannerImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
          images: ['https://images.unsplash.com/photo-1506744038136-46273834b3fb'],
          setEditionSize: 'Limited Edition (1 of 50)',
          description: 'A beautiful fine art print captured during sunrise in the Alps.',
          isActive: true
        }
      });
      const p2 = await prisma.product.create({
        data: {
          userId: user.id,
          category: 'PHOTOBOOKS',
          title: 'Monochrome Expressions Hardcover Photobook',
          title_pl: 'Monochromatyczne ekspresje - fotoksiążka',
          price: 110.00,
          bannerImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
          images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c'],
          setEditionSize: 'First Edition (1 of 100)',
          description: 'A premium hardcover collection of striking black and white photography.',
          isActive: true
        }
      });
      const p3 = await prisma.product.create({
        data: {
          userId: user.id,
          category: 'DIGITAL_PRESET',
          title: 'Cinematic Mood Lightroom Presets',
          title_pl: 'Filmowe presety Lightroom',
          price: 35.00,
          bannerImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794',
          images: ['https://images.unsplash.com/photo-1512820790803-83ca734da794'],
          setEditionSize: 'Digital Master Pack',
          description: 'Professional color grading presets for Lightroom and Photoshop.',
          isActive: true
        }
      });
      userProducts = [p1, p2, p3];
    }

    // Clean existing store orders for this user's products
    const existingStoreOrderItems = await prisma.orderItem.findMany({
      where: {
        product: { userId: user.id },
        order: { status: 'PAID' }
      },
      select: { orderId: true }
    });
    if (existingStoreOrderItems.length > 0) {
      const orderIds = [...new Set(existingStoreOrderItems.map(i => i.orderId))];
      await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    const buyers = [
      { name: 'Emma Watson', email: 'emma.watson@gmail.com' },
      { name: 'Oliver Smith', email: 'oliver.smith@yahoo.com' },
      { name: 'Sophie Martin', email: 'sophie.m@outlook.com' },
      { name: 'James Wilson', email: 'james.wilson@icloud.com' },
      { name: 'Lucas Davis', email: 'lucas.davis@gmail.com' },
      { name: 'Amelia Taylor', email: 'amelia.t@gmail.com' },
      { name: 'Henry Thomas', email: 'henry.thomas@live.co.uk' },
      { name: 'Charlotte Evans', email: 'charlotte.evans@gmail.com' },
      { name: 'Alexander Wright', email: 'alex.wright@gmail.com' },
      { name: 'Mia Johnson', email: 'mia.johnson@outlook.com' },
      { name: 'Daniel Brown', email: 'daniel.b@gmail.com' },
      { name: 'Grace Walker', email: 'grace.walker@yahoo.com' }
    ];

    for (let i = 0; i < buyers.length; i++) {
      const buyer = buyers[i];
      const product = userProducts[i % userProducts.length];
      const quantity = (i % 3 === 0) ? 2 : 1;
      const price = parseFloat(product.price) || 50.00;
      const orderTotal = price * quantity;
      const orderDate = new Date(Date.now() - (i * 2 + 1) * 24 * 60 * 60 * 1000);

      await prisma.order.create({
        data: {
          userId: null,
          email: buyer.email,
          fullName: buyer.name,
          address: `${10 + i} Oxford Street, London, UK`,
          total: orderTotal,
          currency: 'GBP',
          status: 'PAID',
          paymentMethod: i % 2 === 0 ? 'PAYPAL' : 'STRIPE',
          paymentId: `PAYID-STORE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          createdAt: orderDate,
          updatedAt: orderDate,
          items: {
            create: {
              productId: product.id,
              price: price,
              quantity: quantity,
              size: 'STANDARD'
            }
          }
        }
      });
    }

    // ----------------------------------------------------
    // 2. DONATIONS SEEDING
    // ----------------------------------------------------
    console.log('-> Seeding Donations...');
    let userSubmissions = await prisma.submission.findMany({
      where: { userId: user.id }
    });

    if (userSubmissions.length === 0) {
      const newSub = await prisma.submission.create({
        data: {
          userId: user.id,
          title: 'Fine Art Portfolio Masterpiece',
          kind: 'SINGLE',
          status: 'APPROVED',
          competitionState: 'PROFILE_ONLY',
          prizeMoney: 250,
          viewsCount: 350,
          likesCount: 95,
          featuredImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb'
        }
      });
      userSubmissions = [newSub];
    }

    await prisma.donation.deleteMany({
      where: { artistId: user.id }
    });

    const donationData = [
      { name: 'Liam Davies', email: 'liam.davies@gmail.com', amount: 25.00 },
      { name: 'Charlotte Taylor', email: 'charlotte.t@gmail.com', amount: 50.00 },
      { name: 'Noah Brown', email: 'noah.brown@yahoo.com', amount: 15.00 },
      { name: 'Amelia Wilson', email: 'amelia.w@outlook.com', amount: 100.00 },
      { name: 'Lucas Miller', email: 'lucas.m@gmail.com', amount: 20.00 },
      { name: 'Sophia Moore', email: 'sophia.moore@gmail.com', amount: 35.00 },
      { name: 'Mason Anderson', email: 'mason.a@icloud.com', amount: 75.00 },
      { name: 'Isabella Jackson', email: 'isabella.j@gmail.com', amount: 30.00 },
      { name: 'Ethan White', email: 'ethan.white@yahoo.com', amount: 10.00 },
      { name: 'Ava Harris', email: 'ava.harris@gmail.com', amount: 50.00 },
      { name: 'William Martin', email: 'william.m@outlook.com', amount: 40.00 },
      { name: 'Evelyn Clark', email: 'evelyn.clark@gmail.com', amount: 60.00 }
    ];

    for (let i = 0; i < donationData.length; i++) {
      const d = donationData[i];
      const sub = userSubmissions[i % userSubmissions.length];
      const donationDate = new Date(Date.now() - (i * 2 + 2) * 24 * 60 * 60 * 1000);

      await prisma.donation.create({
        data: {
          submissionId: sub.id,
          artistId: user.id,
          donorName: d.name,
          donorEmail: d.email,
          amount: d.amount,
          currency: 'GBP',
          message: 'Thank you for your inspiring art!',
          status: 'COMPLETED',
          type: 'ONE_TIME',
          paymentId: `PAYID-DON-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          createdAt: donationDate
        }
      });
    }

    // ----------------------------------------------------
    // 3. PRIZE MONEY / WINNERS SEEDING
    // ----------------------------------------------------
    console.log('-> Seeding Prize Money / Winners...');
    await prisma.winner.deleteMany({
      where: { userId: user.id }
    });

    const rankConfigs = {
      1: { place: 'FIRST', prize: 500, votes: 340, points: 150 },
      2: { place: 'SECOND', prize: 250, votes: 280, points: 120 },
      3: { place: 'THIRD', prize: 150, votes: 210, points: 95 },
      4: { place: 'POPULAR_VOTE', prize: 100, votes: 195, points: 80 }
    };

    for (let w = 0; w < 12; w++) {
      const slot = (u * 12) + w;
      const comp = competitionList[slot % competitionList.length];
      const kind = kinds[Math.floor(slot / competitionList.length) % kinds.length];
      const rank = Math.floor(slot / (competitionList.length * kinds.length)) + 1;
      const config = rankConfigs[rank] || rankConfigs[4];

      // Remove any collision for this unique tuple
      const existingWin = await prisma.winner.findUnique({
        where: {
          competitionId_kind_rank: {
            competitionId: comp.id,
            kind,
            rank
          }
        }
      });
      if (existingWin) {
        await prisma.winner.delete({ where: { id: existingWin.id } });
      }

      const targetCategory = categories[w % categories.length];
      const targetAlbumType = albumTypes.find(at => at.kind === kind) || albumTypes[0];

      const winSub = await prisma.submission.create({
        data: {
          userId: user.id,
          competitionId: comp.id,
          categoryId: targetCategory?.id || null,
          albumTypeId: targetAlbumType?.id || null,
          kind: kind,
          title: `${comp.title} - ${kind} Award Winner`,
          title_pl: `${comp.title} - Zwycięzca nagrody ${kind}`,
          status: 'APPROVED',
          competitionState: 'ENDED',
          prizeMoney: config.prize,
          featuredImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
          viewsCount: 500 + w * 50,
          likesCount: 150 + w * 20,
          votesCount: config.votes,
          points: config.points,
          rank: rank
        }
      });

      const winDate = new Date(comp.endsAt || Date.now() - (w * 15 + 5) * 24 * 60 * 60 * 1000);

      await prisma.winner.create({
        data: {
          competitionId: comp.id,
          submissionId: winSub.id,
          userId: user.id,
          kind: kind,
          place: config.place,
          rank: rank,
          isWinner: true,
          votes: config.votes,
          points: config.points,
          createdAt: winDate
        }
      });
    }

    // ----------------------------------------------------
    // 4. PAYMENT HISTORY (PAYOUTS) SEEDING
    // ----------------------------------------------------
    console.log('-> Seeding Payment History (Payouts)...');
    await prisma.payout.deleteMany({
      where: { userId: user.id }
    });

    const payoutConfigs = [
      { kind: 'PRIZE', amount: 500.00, status: 'PAID', daysAgo: 50, accType: 'Bank Transfer', accNum: 'GB82BARC20201555555555' },
      { kind: 'STORE', amount: 150.00, status: 'PAID', daysAgo: 45, accType: 'PayPal', accNum: user.email },
      { kind: 'DONATION', amount: 75.00, status: 'PAID', daysAgo: 40, accType: 'PayPal', accNum: user.email },
      { kind: 'PREMIUM', amount: 120.00, status: 'PAID', daysAgo: 35, accType: 'Bank Transfer', accNum: 'GB82BARC20201555555555' },
      { kind: 'PRIZE', amount: 250.00, status: 'PAID', daysAgo: 30, accType: 'Bank Transfer', accNum: 'GB82BARC20201555555555' },
      { kind: 'STORE', amount: 95.00, status: 'PAID', daysAgo: 25, accType: 'PayPal', accNum: user.email },
      { kind: 'DONATION', amount: 50.00, status: 'PAID', daysAgo: 20, accType: 'PayPal', accNum: user.email },
      { kind: 'STORE', amount: 65.00, status: 'PAID', daysAgo: 15, accType: 'Bank Transfer', accNum: 'GB82BARC20201555555555' },
      { kind: 'PREMIUM', amount: 80.00, status: 'PAID', daysAgo: 10, accType: 'PayPal', accNum: user.email },
      { kind: 'PRIZE', amount: 150.00, status: 'PENDING', daysAgo: 5, accType: 'Bank Transfer', accNum: 'GB82BARC20201555555555' },
      { kind: 'STORE', amount: 70.00, status: 'PENDING', daysAgo: 3, accType: 'PayPal', accNum: user.email },
      { kind: 'DONATION', amount: 45.00, status: 'PENDING', daysAgo: 1, accType: 'PayPal', accNum: user.email },
      { kind: 'PREMIUM', amount: 35.00, status: 'REJECTED', daysAgo: 60, accType: 'PayPal', accNum: 'invalid-account@error.com' }
    ];

    for (const p of payoutConfigs) {
      const pDate = new Date(Date.now() - p.daysAgo * 24 * 60 * 60 * 1000);
      await prisma.payout.create({
        data: {
          userId: user.id,
          kind: p.kind,
          amount: p.amount,
          currency: 'GBP',
          accountType: p.accType,
          accountNumber: p.accNum,
          status: p.status,
          createdAt: pDate,
          updatedAt: pDate
        }
      });
    }
  }

  console.log('\n--- ALL USERS PAYMENT DATA SEEDED SUCCESSFULLY! ---');
  process.exit(0);
}

seedUserPayments().catch(err => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
