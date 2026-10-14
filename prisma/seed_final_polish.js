import prisma from '../src/config/prisma.js';

const sampleImages = [
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
  'https://images.unsplash.com/photo-1511556532299-8f662fc26c06',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e'
];
const sampleVideo = 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';

async function main() {
  console.log('🚀 Starting Final Polish Seeder...');

  const regularUser = await prisma.user.findFirst({ where: { role: 'USER' } });
  if (!regularUser) throw new Error('No regular user found');

  // 1. Update Submissions & SubmissionMedia (populate zodiacSign, rank & prizeMoney)
  console.log('Updating Submissions & SubmissionMedia...');
  await prisma.submission.updateMany({
    data: {
      zodiacSign: 'LEO',
      prizeMoney: 250.00,
      rank: 1
    }
  });

  const allUserSubmissions = await prisma.submission.findMany({ where: { userId: regularUser.id } });
  for (let i = 0; i < allUserSubmissions.length; i++) {
    const s = allUserSubmissions[i];
    await prisma.submission.update({
      where: { id: s.id },
      data: { rank: i + 1 }
    });

    await prisma.promotedAlbum.upsert({
      where: { submissionId: s.id },
      create: {
        submissionId: s.id,
        userId: regularUser.id,
        amountPaid: 45.00,
        durationDays: 14,
        isActive: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000)
      },
      update: {
        isActive: true,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 14 * 24 * 3600 * 1000)
      }
    });
  }

  await prisma.submissionMedia.updateMany({
    data: {
      zodiacSign: 'LEO'
    }
  });

  // 2. Update PremiumPhotos & PremiumPhotoMedia
  console.log('Updating PremiumPhotos & Media...');
  await prisma.premiumPhoto.updateMany({
    data: {
      story: 'A breathtaking high-resolution capture showcasing authentic lighting and pristine detail.',
      story_pl: 'Zapierające dech w piersiach ujęcie w wysokiej rozdzielczości, prezentujące autentyczne oświetlenie i nieskazitelne detale.',
      license: 'Standard Commercial License (Royalty Free)',
      camera: 'Sony Alpha A7R V',
      resolution: '9504 x 6336',
      format: 'RAW / TIFF / JPEG',
      quality: 'Ultra HD 8K',
      zodiacSign: 'SCORPIO'
    }
  });

  await prisma.premiumPhotoMedia.updateMany({
    data: {
      zodiacSign: 'SCORPIO'
    }
  });

  // Ensure each PremiumPhoto has a VIDEO media record
  const allPhotos = await prisma.premiumPhoto.findMany({ select: { id: true } });
  for (const p of allPhotos) {
    const existingVideo = await prisma.premiumPhotoMedia.findFirst({
      where: { premiumPhotoId: p.id, kind: 'VIDEO' }
    });
    if (!existingVideo) {
      await prisma.premiumPhotoMedia.create({
        data: {
          premiumPhotoId: p.id,
          kind: 'VIDEO',
          slotIndex: 0,
          url: sampleVideo,
          format: 'video/mp4',
          bytes: 1048576,
          zodiacSign: 'SCORPIO'
        }
      });
    }
  }

  // 3. Assign Winners to regularUser so Prize Money endpoint returns rich list
  console.log('Assigning Winners to regularUser...');
  const winners = await prisma.winner.findMany({ take: 3 });
  for (let i = 0; i < winners.length; i++) {
    const win = winners[i];
    await prisma.winner.update({
      where: { id: win.id },
      data: {
        userId: regularUser.id
      }
    });
    // Ensure the linked submission also belongs to regularUser
    await prisma.submission.update({
      where: { id: win.submissionId },
      data: {
        userId: regularUser.id,
        prizeMoney: 250.00
      }
    });
  }

  // 4. Update Support Tickets (ensure answer & answeredAt & attachments)
  console.log('Updating Support Tickets...');
  await prisma.supportTicket.updateMany({
    data: {
      answer: 'Thank you for reaching out to Baracuda support. Your inquiry has been processed and answered by our team.',
      answer_pl: 'Dziękujemy za kontakt z działem wsparcia Baracuda. Twoje zapytanie zostało przetworzone i udzielono na nie odpowiedzi.',
      answeredAt: new Date(),
      attachments: [sampleImages[0]]
    }
  });

  // 5. Update Chat Messages (ensure fileUrl, fileType, fileName)
  console.log('Updating Chat Messages...');
  await prisma.chatMessage.updateMany({
    data: {
      fileUrl: sampleImages[0],
      fileType: 'image/jpeg',
      fileName: 'photography_asset_sample.jpg'
    }
  });

  // 6. Update OrderItems (ensure size)
  console.log('Updating OrderItems...');
  await prisma.orderItem.updateMany({
    data: {
      size: 'Original (4K)'
    }
  });

  console.log('✅ Final Polish Seeding completed successfully!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
