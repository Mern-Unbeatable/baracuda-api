import prisma from './src/config/prisma.js';

async function migrate() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE winners ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE winners ADD COLUMN IF NOT EXISTS "isWinner" BOOLEAN DEFAULT false`);
    
    // Update ranks based on existing place
    await prisma.$executeRawUnsafe(`UPDATE winners SET rank = 1, "isWinner" = true WHERE place = 'FIRST'`);
    await prisma.$executeRawUnsafe(`UPDATE winners SET rank = 2 WHERE place = 'SECOND'`);
    await prisma.$executeRawUnsafe(`UPDATE winners SET rank = 3 WHERE place = 'THIRD'`);
    
    // Set unique ranks for rows where rank is still 0 (if there are duplicates)
    // We just need to give them some rank to avoid unique constraint failure
    // It's just a dev DB so we can assign arbitrary ranks
    const winners = await prisma.$queryRawUnsafe(`SELECT id, "competitionId", kind FROM winners WHERE rank = 0`);
    
    for (let i = 0; i < winners.length; i++) {
        await prisma.$executeRawUnsafe(`UPDATE winners SET rank = ${i + 4} WHERE id = '${winners[i].id}'`);
    }

    console.log('Successfully updated existing data');
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
migrate();
