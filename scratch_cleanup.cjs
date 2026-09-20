const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function cleanup() {
  const profiles = await prisma.demoProfile.findMany();
  const emails = new Set();
  for (const p of profiles) {
    if (emails.has(p.email)) {
      await prisma.demoProfile.delete({ where: { id: p.id } });
      console.log('Deleted duplicate demo profile with email:', p.email);
    } else {
      emails.add(p.email);
    }
  }
}
cleanup().then(() => prisma.$disconnect());
