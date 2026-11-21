import 'dotenv/config';
import prisma from '../src/config/prisma.js';
import { HashUtil } from '../src/utils/hash.js';

const email = 'maya.store@my12photos.com';
const username = 'mayastore';
const password = 'StoreTest123!';

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { id: true, avatar: true },
  });

  const hashed = await HashUtil.hash(password);
  const userData = {
    email,
    username,
    password: hashed,
    name: 'Maya Store',
    role: 'USER',
    status: 'ACTIVE',
    isVerified: true,
    bio: 'Documentary photographer and print seller.',
    country: 'United Kingdom',
    city: 'London',
    phone: '+447700900123',
    avatar: 'https://i.pravatar.cc/300?u=mayastore',
    coverPhoto: 'https://picsum.photos/seed/mayastore-cover/1600/600',
    socialLinks: ['https://instagram.com/mayastore'],
  };

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: userData,
        select: { id: true, email: true, username: true, name: true, status: true },
      })
    : await prisma.user.create({
        data: userData,
        select: { id: true, email: true, username: true, name: true, status: true },
      });

  console.log(existing ? 'UPDATED_USER' : 'CREATED_USER', user);

  const productCount = await prisma.product.count({ where: { userId: user.id } });
  if (productCount === 0) {
    const product = await prisma.product.create({
      data: {
        userId: user.id,
        title: 'Harbour Light Print',
        description: 'Limited edition art print of a harbour at dusk.',
        price: 48.0,
        category: 'ART_PRINTS',
        categories: ['ART_PRINTS'],
        bannerImage: 'https://picsum.photos/seed/mayastore-p1/800/600',
        images: [
          'https://picsum.photos/seed/mayastore-p1/800/600',
          'https://picsum.photos/seed/mayastore-p1b/800/600',
        ],
        setEditionSize: '25',
        country: 'United Kingdom',
        city: 'London',
        shippingScope: 'WORLDWIDE',
        isActive: true,
      },
      select: { id: true, title: true },
    });
    console.log('CREATED_PRODUCT', product);
  } else {
    const products = await prisma.product.findMany({
      where: { userId: user.id },
      select: { id: true, title: true },
      take: 5,
    });
    console.log('EXISTING_PRODUCTS', products);
  }

  console.log('\nLogin credentials:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Username: ${username}`);
  console.log(`  Profile:  /photographer/${username}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
