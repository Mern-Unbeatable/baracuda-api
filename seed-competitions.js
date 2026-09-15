import prisma from './src/config/prisma.js';

async function seedData() {
  console.log('Starting seed...');

  try {
    // 1. Get current competition
    const competition = await prisma.competition.findFirst({
      where: { status: 'OPEN' }
    });

    if (!competition) {
      console.log('No open competition found. Please make sure the server is running and has created one.');
      return;
    }

    // 2. Ensure we have a few test users
    const users = [];
    for (let i = 1; i <= 5; i++) {
      const user = await prisma.user.upsert({
        where: { email: `testuser${i}@example.com` },
        update: {},
        create: {
          email: `testuser${i}@example.com`,
          username: `testuser${i}`,
          name: `Test User ${i}`,
          password: 'password123',
          isVerified: true
        }
      });
      users.push(user);
    }

    console.log('Created/Fetched test users.');

    // 3. Create submissions with random votes for each AlbumKind
    const kinds = ['SINGLE', 'SIX', 'TWELVE'];

    for (const kind of kinds) {
      // Clear existing dummy submissions for this kind in this competition to avoid duplicates if run multiple times
      await prisma.submission.deleteMany({
        where: {
          competitionId: competition.id,
          kind: kind,
          title: {
            path: ['en'],
            string_contains: 'Dummy'
          }
        }
      });

      console.log(`Seeding submissions for ${kind}...`);
      
      const albumType = await prisma.albumType.findFirst({ where: { kind: kind } });
      if (!albumType) {
        console.log(`Missing AlbumType for kind: ${kind}. Skipping...`);
        continue;
      }
      
      for (let i = 0; i < users.length; i++) {
        const votes = Math.floor(Math.random() * 100) + 1; // 1 to 100 votes
        
        await prisma.submission.create({
          data: {
            user: { connect: { id: users[i].id } },
            competition: { connect: { id: competition.id } },
            albumType: { connect: { id: albumType.id } },
            kind: kind,
            title: { en: `Dummy ${kind} Submission by User ${i + 1}` },
            story: { en: 'This is a test submission for leaderboard testing.' },
            status: 'APPROVED',
            votesCount: votes,
            points: votes * 10,
          }
        });
      }
    }

    console.log('Seed completed successfully! You can now check the leaderboards in Postman.');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

seedData();
