import prisma from '../src/config/prisma.js';
import { HashUtil } from '../src/utils/hash.js';

async function main() {
  const adminEmail = 'admin@my12photos.com';
  
  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await HashUtil.hash('admin123');
    
    await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        username: 'admin',
        name: 'Super Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        isVerified: true
      }
    });
    console.log(`✅ Admin user seeded successfully. Email: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Admin user already exists. Email: ${adminEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
