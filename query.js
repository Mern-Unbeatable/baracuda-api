import prisma from './src/config/prisma.js';
import { HashUtil } from './src/utils/hash.js';

async function main() {
  try {
    const password = 'Password123!';
    const hashedPassword = await HashUtil.hash(password);
    
    // Create a specific user to follow johndoe
    const testUser = await prisma.user.upsert({
      where: { email: 'test_follower@example.com' },
      update: {
        password: hashedPassword,
        status: 'ACTIVE',
        isVerified: true
      },
      create: {
        email: 'test_follower@example.com',
        username: 'test_follower',
        password: hashedPassword,
        name: 'Test Follower',
        role: 'USER',
        status: 'ACTIVE',
        isVerified: true
      }
    });

    const count = await prisma.user.count();
    console.log('Total users:', count);
    console.log(`Created/Updated test user: email: test_follower@example.com | password: ${password}`);
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
