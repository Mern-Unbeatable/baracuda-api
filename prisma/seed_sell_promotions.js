import prisma from '../src/config/prisma.js';

async function seedSellPromotions() {
  console.log('Seeding ACTIVE promotions for Sell Photos (Premium Photos)...');

  const now = new Date(); // e.g. 2026-10-21

  // Fetch all premium photos
  const photos = await prisma.premiumPhoto.findMany({
    include: {
      user: true,
      promotions: true
    },
    take: 10
  });

  if (photos.length === 0) {
    console.error('No PremiumPhotos found in database!');
    process.exit(1);
  }

  console.log(`Found ${photos.length} PremiumPhotos in database.`);

  const curatedTitles = [
    {
      title: 'Golden Sunset over Lake Como',
      title_pl: 'Złoty zachód słońca nad jeziorem Como',
      story: 'Captured in high dynamic range during the quiet autumn twilight in Bellagio.',
      story_pl: 'Uchwycone w wysokiej dynamice podczas cichego jesiennego zmierzchu w Bellagio.',
      price: 25.00,
      durationDays: 14,
      amountPaid: 60,
      daysFromNow: 12
    },
    {
      title: 'Nordic Coastal Fjord Panorama',
      title_pl: 'Panorama fiordu wybrzeża nordyckiego',
      story: 'Breathtaking aerial capture of turquoise waters cutting through towering granite peaks.',
      story_pl: 'Zapierające dech w piersiach ujęcie z lotu ptaka turkusowych wód przecinających granitowe szczyty.',
      price: 45.00,
      durationDays: 30,
      amountPaid: 100,
      daysFromNow: 25
    },
    {
      title: 'Urban Architecture Geometry in Tokyo',
      title_pl: 'Geometria architektury miejskiej w Tokio',
      story: 'Minimalist perspective of modern glass and steel skyscraper facades reflecting morning skies.',
      story_pl: 'Minimalistyczna perspektywa nowoczesnych szklanych i stalowych drapaczy chmur.',
      price: 30.00,
      durationDays: 7,
      amountPaid: 40,
      daysFromNow: 6
    },
    {
      title: 'Wild Stallions of the Camargue',
      title_pl: 'Dzikie ogiery z Camargue',
      story: 'Dynamic action shot of white horses galloping through shallow coastal saltwater marshes.',
      story_pl: 'Dynamiczne ujęcie białych koni galopujących przez płytkie przybrzeżne słone bagna.',
      price: 55.00,
      durationDays: 14,
      amountPaid: 60,
      daysFromNow: 10
    },
    {
      title: 'Misty Redwood Forest Cathedral',
      title_pl: 'Mglisty las sekwoi - naturalna katedra',
      story: 'God rays piercing dense coastal fog among centuries-old giant California redwoods.',
      story_pl: 'Promienie słoneczne przebijające się przez gęstą mgłę przybrzeżną wśród sekwoi.',
      price: 35.00,
      durationDays: 30,
      amountPaid: 100,
      daysFromNow: 22
    },
    {
      title: 'Neon Nights of Shinjuku Rain',
      title_pl: 'Neonowe noce Shinjuku w deszczu',
      story: 'Vibrant cyberpunk aesthetic reflections on wet asphalt in the heart of Tokyo nightlife.',
      story_pl: 'Żywe odbicia cyberpunkowej estetyki na mokrym asfalcie w centrum Tokio.',
      price: 40.00,
      durationDays: 14,
      amountPaid: 60,
      daysFromNow: 9
    },
    {
      title: 'Autumn Solitude in the Scottish Highlands',
      title_pl: 'Jesienna samotność w Highlands',
      story: 'Golden heather hills and brooding storm clouds gathering over an ancient Scottish glen.',
      story_pl: 'Złote wzgórza wrzosowe i burzowe chmury gromadzące się nad starożytną doliną.',
      price: 50.00,
      durationDays: 7,
      amountPaid: 40,
      daysFromNow: 5
    },
    {
      title: 'Serene Alpine Glacier Ridge',
      title_pl: 'Spokojna grań lodowca alpejskiego',
      story: 'Pristine deep blue crevasses and snow ridges under a crystal clear turquoise mountain sky.',
      story_pl: 'Nieskazitelne błękitne szczeliny i śnieżne granie pod krystalicznym niebem.',
      price: 65.00,
      durationDays: 30,
      amountPaid: 100,
      daysFromNow: 28
    }
  ];

  let seededCount = 0;

  for (let i = 0; i < Math.min(photos.length, curatedTitles.length); i++) {
    const photo = photos[i];
    const data = curatedTitles[i];

    // Update photo details with nice title and price
    await prisma.premiumPhoto.update({
      where: { id: photo.id },
      data: {
        title: data.title,
        title_pl: data.title_pl,
        story: data.story,
        story_pl: data.story_pl,
        price: data.price,
        isActive: true
      }
    });

    const startsAt = new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000)); // Started 2 days ago
    const endsAt = new Date(now.getTime() + (data.daysFromNow * 24 * 60 * 60 * 1000)); // Ends in future

    // Upsert PromotedAlbum record
    await prisma.promotedAlbum.upsert({
      where: { premiumPhotoId: photo.id },
      update: {
        userId: photo.userId,
        durationDays: data.durationDays,
        startsAt,
        endsAt,
        amountPaid: data.amountPaid,
        isActive: true
      },
      create: {
        premiumPhotoId: photo.id,
        userId: photo.userId,
        durationDays: data.durationDays,
        startsAt,
        endsAt,
        amountPaid: data.amountPaid,
        isActive: true
      }
    });

    seededCount++;
    console.log(`[${seededCount}] Promoted Sell Photo: "${data.title}" | Paid: $${data.amountPaid} | Ends: ${endsAt.toISOString().split('T')[0]}`);
  }

  console.log(`\nSuccessfully seeded ${seededCount} ACTIVE Sell Photo promotions!`);
  process.exit(0);
}

seedSellPromotions().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
