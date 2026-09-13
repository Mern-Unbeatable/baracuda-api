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

  // Seed Album Types
  const albumTypes = [
    {
      kind: 'SINGLE',
      name: { en: 'Single Photo' },
      description: { en: 'Submit a single outstanding photograph.' },
      photoCount: 1,
      entryFee: 0,
      prizeMoney: 1500.00
    },
    {
      kind: 'SIX',
      name: { en: '6 Photos Story' },
      description: { en: 'Craft a visual narrative using six sequenced images.' },
      photoCount: 6,
      entryFee: 0,
      prizeMoney: 2500.00
    },
    {
      kind: 'TWELVE',
      name: { en: '12 Photos - Full Zodiac Story' },
      description: { en: 'Create a complete zodiac-themed visual journey.' },
      photoCount: 12,
      entryFee: 0,
      prizeMoney: 3500.00
    }
  ];

  for (const type of albumTypes) {
    const existingType = await prisma.albumType.findUnique({
      where: { kind: type.kind }
    });

    if (!existingType) {
      await prisma.albumType.create({ data: type });
      console.log(`✅ AlbumType '${type.kind}' seeded successfully.`);
    } else {
      console.log(`ℹ️ AlbumType '${type.kind}' already exists.`);
    }
  }

  // Seed an active competition so IN_COMPETITION works correctly
  const d = new Date();
  const currentYear = d.getFullYear();
  const currentMonth = d.getMonth() + 1;

  const existingComp = await prisma.competition.findUnique({
    where: {
      year_month: {
        year: currentYear,
        month: currentMonth
      }
    }
  });

  if (!existingComp) {
    const startsAt = new Date(currentYear, currentMonth - 1, 1);
    const endsAt = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    await prisma.competition.create({
      data: {
        title: { en: 'August Photography Competition' },
        year: currentYear,
        month: currentMonth,
        status: 'OPEN',
        startsAt,
        endsAt,
        timezone: 'Europe/London'
      }
    });
    console.log(`✅ Seeded active competition for ${currentMonth}/${currentYear}.`);
  } else {
    // Make sure it's active
    if (existingComp.status !== 'OPEN') {
      await prisma.competition.update({
        where: { id: existingComp.id },
        data: { status: 'OPEN' }
      });
      console.log(`✅ Updated existing competition for ${currentMonth}/${currentYear} to OPEN.`);
    } else {
      console.log(`ℹ️ Active competition for ${currentMonth}/${currentYear} already exists.`);
    }
  }

  // Seed Categories
  const catSlug = 'astrophotography';
  let category = await prisma.category.findUnique({ where: { slug: catSlug } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: { en: 'Astrophotography' },
        slug: catSlug,
        description: { en: 'Photography of astronomical objects, celestial events, and areas of the night sky.' },
        isActive: true
      }
    });
    console.log(`✅ Seeded category '${catSlug}'.`);

    // Seed Subcategories
    const subCats = [
      { name: { en: 'Deep Sky' }, slug: 'deep-sky' },
      { name: { en: 'Solar System' }, slug: 'solar-system' },
      { name: { en: 'Wide Field' }, slug: 'wide-field' }
    ];

    for (const sub of subCats) {
      await prisma.category.create({
        data: {
          ...sub,
          parentId: category.id,
          isActive: true
        }
      });
      console.log(`✅ Seeded subcategory '${sub.slug}'.`);
    }
  } else {
    console.log(`ℹ️ Category '${catSlug}' already exists.`);
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
