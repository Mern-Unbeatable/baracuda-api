import prisma from '../src/config/prisma.js';
import { getWeekStart } from '../src/modules/appreciation/appreciation.service.js';

async function seedAppreciations() {
  console.log('🌟 Seeding Artwork Appreciations...');

  const users = await prisma.user.findMany({ where: { role: 'USER' }, take: 25 });
  if (users.length < 2) {
    console.error('Not enough users in DB to seed appreciations.');
    return;
  }

  // Seed for the first 2 photographers
  const targetPhotographers = users.slice(0, 2);
  const currentWeek = getWeekStart();

  for (const targetPhotographer of targetPhotographers) {
    console.log(`\nSeeding for Photographer: ${targetPhotographer.username} (${targetPhotographer.id})`);

    // Target counts to match UI mockup: 24 Gold, 17 Silver, 10 Bronze
    const targets = [
      { tier: 'GOLD', count: 24 },
      { tier: 'SILVER', count: 17 },
      { tier: 'BRONZE', count: 10 }
    ];

    for (const t of targets) {
      let createdForTier = 0;
      // We distribute across past weeks (e.g., past 1 to 10 weeks)
      for (let w = 0; w < 10 && createdForTier < t.count; w++) {
        const weekDate = new Date(currentWeek.getTime() - w * 7 * 24 * 3600 * 1000);

        for (let u = 0; u < users.length && createdForTier < t.count; u++) {
          const sender = users[u];
          if (sender.id === targetPhotographer.id) continue;

          // Don't award for current week here; we'll control current week separately
          if (w === 0) continue;

          try {
            await prisma.artworkAppreciation.upsert({
              where: {
                senderId_receiverId_weekStart: {
                  senderId: sender.id,
                  receiverId: targetPhotographer.id,
                  weekStart: weekDate
                }
              },
              create: {
                senderId: sender.id,
                receiverId: targetPhotographer.id,
                tier: t.tier,
                weekStart: weekDate,
                createdAt: weekDate
              },
              update: {}
            });
            createdForTier++;
          } catch (err) {
            // Ignore
          }
        }
      }
    }

    // Set up a viewer from the remaining users who has already awarded SILVER this week
    const viewerUser = users.find(u => u.id !== targetPhotographer.id);
    if (viewerUser) {
      await prisma.artworkAppreciation.upsert({
        where: {
          senderId_receiverId_weekStart: {
            senderId: viewerUser.id,
            receiverId: targetPhotographer.id,
            weekStart: currentWeek
          }
        },
        create: {
          senderId: viewerUser.id,
          receiverId: targetPhotographer.id,
          tier: 'SILVER',
          weekStart: currentWeek
        },
        update: {}
      });
    }

    const stats = await prisma.artworkAppreciation.groupBy({
      by: ['tier'],
      where: { receiverId: targetPhotographer.id },
      _count: { tier: true }
    });

    console.log(`Stats for ${targetPhotographer.username}:`);
    stats.forEach(s => console.log(` - ${s.tier}: ${s._count.tier} awards`));
  }

  console.log('\n✅ Artwork Appreciations seeded successfully!');
}

seedAppreciations()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
