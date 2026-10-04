const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = '130283e7-3843-4e36-af7f-6de0d6cfcd7a'; // We'll just fetch ANY user to test
  const user = await prisma.user.findFirst();
  if(!user) return console.log('No user');

  const rankQuery = await prisma.$queryRaw`
    SELECT \`rank\` FROM (
      SELECT u.id, RANK() OVER (ORDER BY COALESCE(SUM(s.votesCount), 0) DESC) as \`rank\`
      FROM users u
      LEFT JOIN submissions s ON u.id = s.userId
      GROUP BY u.id
    ) as ranked
    WHERE id = ${user.id}
  `;
  
  console.log(rankQuery);
}

main().catch(console.error).finally(() => prisma.$disconnect());
