import prisma from '../src/config/prisma.js';

async function seedSellerOrders() {
  console.log('Seeding seller products and orders...');

  // 1. Identify target sellers
  const targetEmails = ['shanjid.maktech@gmail.com', 'admin@my12photos.com'];
  const sellers = await prisma.user.findMany({
    where: { email: { in: targetEmails } }
  });

  if (sellers.length === 0) {
    console.error('No target sellers found in database!');
    process.exit(1);
  }

  // 2. Identify potential buyers from existing users
  const potentialBuyers = await prisma.user.findMany({
    where: {
      email: { notIn: targetEmails }
    },
    take: 10
  });

  const sampleProductsData = [
    {
      category: 'ART_PRINTS',
      title: 'Limited Edition Fine Art Print - Autumn Glow',
      title_pl: 'Limitowana edycja wydruku Fine Art - Jesienny Blask',
      price: 75.00,
      setEditionSize: 'Limited Edition of 50',
      description: 'Gallery grade archival pigment print on 310gsm Hahnemühle Photo Rag paper. Signed and numbered by the artist.',
      description_pl: 'Wydruk pigmentowy klasy galeryjnej na papierze Hahnemühle Photo Rag 310 g/m2. Podpisany i ponumerowany przez artystę.',
      bannerImage: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
      images: [
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      category: 'PHOTOBOOKS',
      title: 'Monochrome Expressions Hardcover Photobook',
      title_pl: 'Monochromatyczne Ekspresje - Twarda Oprawa',
      price: 110.00,
      setEditionSize: 'Collector Edition',
      description: 'A curated 160-page fine art coffee table photography book featuring black and white visual essays across Europe.',
      description_pl: 'Kuratorki 160-stronicowy album fotograficzny w twardej oprawie z czarno-białymi esejami z całej Europy.',
      bannerImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=1200&q=80',
      images: [
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      category: 'DIGITAL_PRESET',
      title: 'Cinematic Mood Lightroom Presets (Desktop & Mobile)',
      title_pl: 'Kinowy Nastrój - Presety do Lightroom (Desktop & Mobile)',
      price: 35.00,
      setEditionSize: 'Instant Digital Download',
      description: '15 handcrafted cinematic colour profiles designed to bring warm, earthy tones and timeless nostalgia to your photos.',
      description_pl: '15 ręcznie wykonanych profili kolorów do Lightroom, które nadają zdjęciom ciepłe i nostalgiczne barwy.',
      bannerImage: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
      images: [
        'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80'
      ]
    },
    {
      category: 'APPAREL',
      title: 'Heavyweight Artist Signature Photo Hoodie',
      title_pl: 'Ciężka Bluza z Kapturem z Podpisem Artysty',
      price: 85.00,
      setEditionSize: 'Season 1 Exclusive',
      description: '450gsm 100% organic cotton oversized hoodie featuring high-definition direct-to-garment rear artwork print.',
      description_pl: 'Bluza oversize 450 g/m2 ze 100% bawełny organicznej z wysokiej jakości nadrukiem artystycznym na plecach.',
      bannerImage: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=1200&q=80',
      images: [
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=800&q=80'
      ]
    }
  ];

  for (const seller of sellers) {
    console.log(`\nSetting up products and orders for seller: ${seller.email} (${seller.id})`);

    // Ensure seller has products
    let sellerProducts = await prisma.product.findMany({
      where: { userId: seller.id }
    });

    if (sellerProducts.length === 0) {
      console.log(`Creating ${sampleProductsData.length} store products for ${seller.email}...`);
      for (const pData of sampleProductsData) {
        const prod = await prisma.product.create({
          data: {
            userId: seller.id,
            category: pData.category,
            title: pData.title,
            title_pl: pData.title_pl,
            price: pData.price,
            setEditionSize: pData.setEditionSize,
            description: pData.description,
            description_pl: pData.description_pl,
            bannerImage: pData.bannerImage,
            images: pData.images,
            isActive: true
          }
        });
        sellerProducts.push(prod);
      }
    }

    // Now seed 12 realistic orders for this month (October 2026)
    const orderPlans = [
      {
        status: 'PROCESSING',
        date: new Date('2026-10-19T07:15:00.000Z'), // Today
        productIdx: 0,
        quantity: 1,
        size: 'A2 (420 x 594 mm)',
        buyerName: 'Emily Clarke',
        buyerEmail: 'emily.clarke@example.com',
        city: 'London',
        country: 'United Kingdom'
      },
      {
        status: 'PROCESSING',
        date: new Date('2026-10-19T04:40:00.000Z'), // Today
        productIdx: 2,
        quantity: 2,
        size: 'Digital Download',
        buyerName: 'Lucas Henderson',
        buyerEmail: 'lucas.h@example.com',
        city: 'Manchester',
        country: 'United Kingdom'
      },
      {
        status: 'SHIPPED',
        date: new Date('2026-10-18T14:30:00.000Z'), // This Week (Yesterday)
        productIdx: 1,
        quantity: 1,
        size: 'Hardcover 12x12"',
        buyerName: 'Sophie Bennett',
        buyerEmail: 'sophie.b@example.com',
        city: 'Edinburgh',
        country: 'United Kingdom'
      },
      {
        status: 'SHIPPED',
        date: new Date('2026-10-17T11:20:00.000Z'), // This Week
        productIdx: 3,
        quantity: 1,
        size: 'L (Large)',
        buyerName: 'Alexander Wright',
        buyerEmail: 'alex.wright@example.com',
        city: 'Birmingham',
        country: 'United Kingdom'
      },
      {
        status: 'DELIVERED',
        date: new Date('2026-10-15T16:00:00.000Z'), // This Month
        productIdx: 0,
        quantity: 2,
        size: 'A1 (594 x 841 mm)',
        buyerName: 'Chloe Davies',
        buyerEmail: 'chloe.davies@example.com',
        city: 'Bristol',
        country: 'United Kingdom'
      },
      {
        status: 'DELIVERED',
        date: new Date('2026-10-13T09:45:00.000Z'), // This Month
        productIdx: 1,
        quantity: 1,
        size: 'Standard Hardcover',
        buyerName: 'Oliver Taylor',
        buyerEmail: 'oliver.t@example.com',
        city: 'Leeds',
        country: 'United Kingdom'
      },
      {
        status: 'PROCESSING',
        date: new Date('2026-10-18T18:10:00.000Z'), // This Week
        productIdx: 0,
        quantity: 1,
        size: 'A3 (297 x 420 mm)',
        buyerName: 'Isabella Moore',
        buyerEmail: 'isabella.m@example.com',
        city: 'Liverpool',
        country: 'United Kingdom'
      },
      {
        status: 'DELIVERED',
        date: new Date('2026-10-10T13:20:00.000Z'), // This Month
        productIdx: 2,
        quantity: 1,
        size: 'Digital Download',
        buyerName: 'Ethan Wilson',
        buyerEmail: 'ethan.w@example.com',
        city: 'Glasgow',
        country: 'United Kingdom'
      },
      {
        status: 'CANCELLED',
        date: new Date('2026-10-08T10:15:00.000Z'), // This Month
        productIdx: 3,
        quantity: 1,
        size: 'M (Medium)',
        buyerName: 'Amelia Johnson',
        buyerEmail: 'amelia.j@example.com',
        city: 'Cardiff',
        country: 'United Kingdom'
      },
      {
        status: 'DELIVERED',
        date: new Date('2026-10-06T15:30:00.000Z'), // This Month
        productIdx: 0,
        quantity: 1,
        size: 'A2 (420 x 594 mm)',
        buyerName: 'Harry Smith',
        buyerEmail: 'harry.smith@example.com',
        city: 'Newcastle',
        country: 'United Kingdom'
      },
      {
        status: 'SHIPPED',
        date: new Date('2026-10-16T12:00:00.000Z'), // This Month
        productIdx: 1,
        quantity: 1,
        size: 'Collector Edition',
        buyerName: 'Mia Williams',
        buyerEmail: 'mia.w@example.com',
        city: 'Sheffield',
        country: 'United Kingdom'
      },
      {
        status: 'DELIVERED',
        date: new Date('2026-10-03T11:00:00.000Z'), // This Month
        productIdx: 2,
        quantity: 1,
        size: 'Digital Download',
        buyerName: 'Jack Brown',
        buyerEmail: 'jack.brown@example.com',
        city: 'Belfast',
        country: 'United Kingdom'
      }
    ];

    console.log(`Seeding ${orderPlans.length} orders for ${seller.email}...`);

    for (let i = 0; i < orderPlans.length; i++) {
      const plan = orderPlans[i];
      const prod = sellerProducts[plan.productIdx % sellerProducts.length];
      const unitPrice = Number(prod.price);
      const totalAmount = unitPrice * plan.quantity;

      // Assign a buyer from DB or use plan buyer info
      const buyerUser = potentialBuyers[i % potentialBuyers.length] || null;

      const addressJson = JSON.stringify({
        street: `${100 + i * 12} High Street`,
        city: plan.city,
        postalCode: `SW${i + 1}A 2BC`,
        country: plan.country,
        mobile: `+44 7700 900${100 + i}`
      });

      const order = await prisma.order.create({
        data: {
          userId: buyerUser ? buyerUser.id : null,
          email: plan.buyerEmail,
          fullName: plan.buyerName,
          address: addressJson,
          total: totalAmount,
          currency: 'GBP',
          status: plan.status,
          paymentMethod: 'PAYPAL',
          paymentId: `PAYID-ORDER-${Date.now()}-${i}`,
          createdAt: plan.date,
          updatedAt: plan.date,
          items: {
            create: {
              productId: prod.id,
              price: unitPrice,
              quantity: plan.quantity,
              size: plan.size
            }
          }
        }
      });
    }

    console.log(`Successfully created orders for ${seller.email}`);
  }

  console.log('\nAll seller orders and products seeded successfully!');
  process.exit(0);
}

seedSellerOrders().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
