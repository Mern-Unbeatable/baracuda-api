import prisma from './src/config/prisma.js';

async function seedPastWinners() {
  console.log('Starting past winners seed for August 2026...');

  try {
    const year = 2026;
    const month = 8;
    
    // 1. Create or get CLOSED competition for August 2026
    const startsAt = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endsAt = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 1);
    
    let competition = await prisma.competition.findUnique({
      where: { year_month: { year, month } }
    });
    
    if (!competition) {
      competition = await prisma.competition.create({
        data: {
          title: { en: 'August 2026 Photography Competition' },
          year,
          month,
          status: 'CLOSED',
          startsAt,
          endsAt,
          timezone: 'UTC'
        }
      });
      console.log('Created August 2026 Competition');
    }

    // 2. Ensure we have a few test users
    const users = [];
    for (let i = 1; i <= 10; i++) {
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

    // 3. Create past submissions and winners for each AlbumKind
    const kinds = ['SINGLE', 'SIX', 'TWELVE'];

    for (const kind of kinds) {
      // Clear existing dummy winners for this kind in this competition
      await prisma.winner.deleteMany({
        where: {
          competitionId: competition.id,
          kind: kind
        }
      });
      await prisma.submission.deleteMany({
        where: {
          competitionId: competition.id,
          kind: kind,
          title: {
            path: ['en'],
            string_contains: 'August Dummy'
          }
        }
      });

      console.log(`Seeding winners for ${kind}...`);
      
      const albumType = await prisma.albumType.findFirst({ where: { kind: kind } });
      if (!albumType) {
        console.log(`Missing AlbumType for kind: ${kind}. Skipping...`);
        continue;
      }
      
      for (let i = 0; i < 5; i++) { // Top 5 for demo
        const votes = (5 - i) * 10; // Rank 1: 50 votes, Rank 2: 40 votes...
        const rank = i + 1;
        
        // 3a. Create the submission
        const submission = await prisma.submission.create({
          data: {
            user: { connect: { id: users[i].id } },
            competition: { connect: { id: competition.id } },
            albumType: { connect: { id: albumType.id } },
            kind: kind,
            title: { en: `August Dummy ${kind} Submission Rank ${rank}` },
            story: { en: 'This is a past test submission.' },
            status: 'APPROVED',
            votesCount: votes,
            points: votes * 10,
          }
        });
        
        // 3b. Create the Winner record
        await prisma.winner.create({
          data: {
            competition: { connect: { id: competition.id } },
            submission: { connect: { id: submission.id } },
            user: { connect: { id: users[i].id } },
            kind: kind,
            rank: rank,
            isWinner: rank === 1,
            votes: votes,
            points: votes * 10
          }
        });
      }
    }

    console.log('Seed completed successfully! You can now check the Winners Archive for August 2026.');
  } catch (error) {
    console.error('Seed failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

seedPastWinners();
