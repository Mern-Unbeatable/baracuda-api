import prisma from '../src/config/prisma.js';

const sampleComments = [
  {
    body: "The depth of field and natural lighting here are absolutely mesmerizing. Exceptional work!",
    body_pl: "Głębia ostrości i naturalne oświetlenie są tutaj absolutnie hipnotyzujące. Wyjątkowa praca!"
  },
  {
    body: "Incredible capture! The balance between shadows and highlights brings out so much emotion in this composition.",
    body_pl: "Niesamowite ujęcie! Równowaga między cieniami a światłami wyzwala mnóstwo emocji w tej kompozycji."
  },
  {
    body: "Stunning composition. The rule of thirds is applied masterfully. Definitely got my vote!",
    body_pl: "Wspaniała kompozycja. Zasada trójpodziału została tutaj zastosowana po mistrzowsku. Zdecydowanie masz mój głos!"
  },
  {
    body: "The sharpness and attention to detail in this shot are world-class. Truly inspiring photography.",
    body_pl: "Ostrość i dbałość o szczegóły w tym kadrze są na światowym poziomie. Naprawdę inspirująca fotografia."
  },
  {
    body: "Captivating atmosphere and mood. It looks and feels like a still from a high-budget cinematic movie.",
    body_pl: "Urzekająca atmosfera i nastrój. Wygląda jak kadr z wysokobudżetowego filmu kinowego."
  },
  {
    body: "Brilliant perspective! The natural framing leads the viewer's eye right into the heart of the story.",
    body_pl: "Genialna perspektywa! Naturalne kadrowanie prowadzi wzrok widza prosto w serce historii."
  },
  {
    body: "Such a serene and powerful mood. Masterpiece quality photograph!",
    body_pl: "Niezwykle spokojny, a zarazem potężny nastrój. Fotografia na poziomie arcydzieła!"
  },
  {
    body: "The color palette and textures here are simply exquisite. Hats off to the photographer!",
    body_pl: "Paleta kolorów i faktury są po prostu znakomite. Czapki z głów przed fotografem!"
  },
  {
    body: "Wonderful dynamic range. How did you capture the highlights so cleanly without overblowing?",
    body_pl: "Cudowny zakres dynamiczny. Jak udało Ci się tak czysto uchwycić światła bez prześwietlenia?"
  },
  {
    body: "One of the standout submissions in this entire collection. Good luck on the leaderboard!",
    body_pl: "Jedno z najbardziej wyróżniających się zgłoszeń w całej kolekcji. Powodzenia w tabeli liderów!"
  },
  {
    body: "The tones and gradients in the background are sublime. Truly great eye for subtle detail.",
    body_pl: "Tonalność i przejścia tonalne w tle są wzniosłe. Naprawdę świetne oko do subtelnych detali."
  },
  {
    body: "Pure visual poetry. You can feel the cold breeze and stillness of the moment.",
    body_pl: "Czysta poezja wizualna. Można niemal poczuć chłodny wietrzyk i bezruch tej chwili."
  }
];

const sampleReplies = [
  {
    body: "Thank you so much for the kind words! I waited nearly two hours for the golden hour light to hit just right.",
    body_pl: "Bardzo dziękuję za miłe słowa! Czekałem prawie dwie godziny, aż światło złotej godziny ułoży się idealnie."
  },
  {
    body: "Totally agree with this! The exposure and color balance are pure perfection.",
    body_pl: "Całkowicie się zgadzam! Ekspozycja i balans kolorów to czysta perfekcja."
  },
  {
    body: "Appreciate the feedback! Shot this with a 50mm f/1.4 prime lens at ISO 100.",
    body_pl: "Dziękuję za opinię! Zrobione obiektywem stałoogniskowym 50mm f/1.4 przy ISO 100."
  }
];

async function seedArtworkComments() {
  console.log('--- Starting Approved Comments Seeding for Artworks ---');

  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true }
  });

  if (users.length === 0) {
    console.error('No users found in database!');
    process.exit(1);
  }

  const submissions = await prisma.submission.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, userId: true, title: true }
  });

  console.log(`Found ${submissions.length} approved submissions to seed comments for.`);
  console.log(`Found ${users.length} users to author comments.`);

  let totalCommentsCreated = 0;

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    
    // Check existing approved comments
    const existingCommentsCount = await prisma.comment.count({
      where: { submissionId: sub.id, status: 'APPROVED' }
    });

    // If this submission already has 3 or more approved comments, just update commentsCount and continue
    if (existingCommentsCount >= 3) {
      await prisma.submission.update({
        where: { id: sub.id },
        data: { commentsCount: existingCommentsCount }
      });
      continue;
    }

    // Number of comments to create: between 3 and 5
    const commentsToCreate = 3 + (i % 3);
    const candidateUsers = users.filter(u => u.id !== sub.userId);
    const availableUsers = candidateUsers.length > 0 ? candidateUsers : users;

    let rootCommentId = null;

    for (let c = 0; c < commentsToCreate; c++) {
      const user = availableUsers[(i * 3 + c) % availableUsers.length];
      const commentTemplate = sampleComments[(i * 2 + c) % sampleComments.length];
      const hoursAgo = (c * 12) + 2 + (i % 24);
      const commentDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      const created = await prisma.comment.create({
        data: {
          publicCode: `cmt_${Math.random().toString(36).substring(2, 10)}`,
          submissionId: sub.id,
          userId: user.id,
          body: commentTemplate.body,
          body_pl: commentTemplate.body_pl,
          status: 'APPROVED', // Explicitly approved by admin
          isPinned: c === 0 && (i % 4 === 0), // Pin top comment occasionally
          createdAt: commentDate,
          updatedAt: commentDate
        }
      });

      totalCommentsCreated++;
      if (c === 0) rootCommentId = created.id;
    }

    // Add a reply to the first comment 50% of the time
    if (rootCommentId && (i % 2 === 0)) {
      const replyUser = (i % 4 === 0 && sub.userId) 
        ? users.find(u => u.id === sub.userId) || availableUsers[0]
        : availableUsers[(i + 1) % availableUsers.length];
      const replyTemplate = sampleReplies[i % sampleReplies.length];
      const replyDate = new Date(Date.now() - 1 * 60 * 60 * 1000);

      await prisma.comment.create({
        data: {
          publicCode: `cmt_${Math.random().toString(36).substring(2, 10)}`,
          submissionId: sub.id,
          userId: replyUser.id,
          body: replyTemplate.body,
          body_pl: replyTemplate.body_pl,
          status: 'APPROVED', // Explicitly approved by admin
          parentId: rootCommentId,
          createdAt: replyDate,
          updatedAt: replyDate
        }
      });
      totalCommentsCreated++;
    }

    // Update submission commentsCount to reflect accurate approved comments
    const finalCount = await prisma.comment.count({
      where: { submissionId: sub.id, status: 'APPROVED' }
    });

    await prisma.submission.update({
      where: { id: sub.id },
      data: { commentsCount: finalCount }
    });

    if ((i + 1) % 50 === 0 || i === submissions.length - 1) {
      console.log(`Processed ${i + 1}/${submissions.length} submissions... (Created ${totalCommentsCreated} approved comments so far)`);
    }
  }

  console.log(`\n--- Completed Seeding! Created ${totalCommentsCreated} Approved Comments across ${submissions.length} Submissions ---`);
  process.exit(0);
}

seedArtworkComments().catch(err => {
  console.error('Error seeding artwork comments:', err);
  process.exit(1);
});

