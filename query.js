import prisma from './src/config/prisma.js';

async function main() {
  try {
    const subs = await prisma.submission.findMany({
      select: { id: true, title: true, competitionState: true },
      take: 5
    });
    console.log(subs);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
