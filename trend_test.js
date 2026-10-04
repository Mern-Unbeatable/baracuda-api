import prisma from './src/config/prisma.js';

async function main() {
  const currentYear = new Date().getFullYear();
  try {
    const donationTrend = await prisma.$queryRaw`
      SELECT EXTRACT(MONTH FROM "createdAt") as month, COALESCE(SUM(amount), 0) as total
      FROM donations
      WHERE status = 'COMPLETED' AND EXTRACT(YEAR FROM "createdAt") = ${currentYear}
      GROUP BY EXTRACT(MONTH FROM "createdAt")
    `;
    console.log(donationTrend);
  } catch (err) {
    console.error(err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
