import prisma from '../src/config/prisma.js';

async function seedMyPurchases() {
  console.log('Seeding my purchases for marketplace...');

  // Target users who test this endpoint
  const targetEmails = [
    'shanjid.maktech@gmail.com',
    'admin@my12photos.com'
  ];

  const targetUsers = await prisma.user.findMany({
    where: { email: { in: targetEmails } }
  });

  if (targetUsers.length === 0) {
    console.error('Target users not found in database!');
    process.exit(1);
  }

  // Fetch available premium photos to purchase
  const photos = await prisma.premiumPhoto.findMany({
    take: 12,
    orderBy: { createdAt: 'desc' }
  });

  if (photos.length === 0) {
    console.error('No premium photos found to purchase!');
    process.exit(1);
  }

  for (const user of targetUsers) {
    console.log(`Creating purchased orders for ${user.email} (${user.id})...`);

    // Clean existing PAID photo orders for this user if any to avoid duplicate clutter
    const existingOrders = await prisma.order.findMany({
      where: {
        userId: user.id,
        items: { some: { premiumPhotoId: { not: null } } }
      },
      select: { id: true }
    });

    if (existingOrders.length > 0) {
      await prisma.order.deleteMany({
        where: { id: { in: existingOrders.map(o => o.id) } }
      });
      console.log(`Cleaned ${existingOrders.length} previous test photo purchases.`);
    }

    // Pick photos not owned by this user (or any photos)
    const availablePhotos = photos.filter(p => p.userId !== user.id);
    const photosToBuy = availablePhotos.length >= 6 ? availablePhotos : photos;

    // Create 8 purchases across different dates
    const countToSeed = Math.min(photosToBuy.length, 8);

    for (let i = 0; i < countToSeed; i++) {
      const photo = photosToBuy[i];
      const purchaseDate = new Date(Date.now() - (i * 2 + 1) * 24 * 60 * 60 * 1000); // staggered days ago
      const paymentId = `PAYID-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

      await prisma.order.create({
        data: {
          userId: user.id,
          email: user.email,
          fullName: user.name || user.username || 'Test Buyer',
          address: '45 Kensington High Street, London W8 5ED, UK',
          total: parseFloat(photo.price) || 25.00,
          currency: 'GBP',
          status: 'PAID',
          paymentMethod: i % 2 === 0 ? 'PAYPAL' : 'CARD',
          paymentId: paymentId,
          createdAt: purchaseDate,
          updatedAt: purchaseDate,
          items: {
            create: {
              premiumPhotoId: photo.id,
              price: parseFloat(photo.price) || 25.00,
              quantity: 1,
              size: 'ORIGINAL_RAW'
            }
          }
        }
      });
    }

    console.log(`Successfully seeded ${countToSeed} purchases for ${user.email}!`);
  }

  console.log('Finished seeding marketplace purchases.');
  process.exit(0);
}

seedMyPurchases().catch(err => {
  console.error('Error seeding purchases:', err);
  process.exit(1);
});

