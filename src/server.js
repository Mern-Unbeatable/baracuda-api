import app from './app.js';
import config from './config/env.js';
import cron from 'node-cron';
import { CompetitionService } from './modules/competition/competition.service.js';

// Get port from environment variable or use default
const PORT = config.app.port;

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.app.env}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

// Initialize Competition cron jobs
const competitionService = new CompetitionService();
// Run at 00:00 (midnight) on the 1st of every month
cron.schedule('0 0 1 * *', async () => {
  console.log('[CRON] Executing processMonthlyCompetitions...');
  try {
    await competitionService.processMonthlyCompetitions();
    console.log('[CRON] Successfully processed monthly competitions.');
  } catch (err) {
    console.error('[CRON] Error processing competitions:', err);
  }
});

// Run every hour to check for expired suspensions
import prisma from './config/prisma.js';
cron.schedule('0 * * * *', async () => {
  try {
    const expiredSuspensions = await prisma.user.findMany({
      where: {
        status: 'SUSPENDED',
        suspensionEndsAt: {
          lte: new Date()
        }
      },
      select: { id: true }
    });

    if (expiredSuspensions.length > 0) {
      const ids = expiredSuspensions.map(u => u.id);
      await prisma.user.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'ACTIVE',
          suspensionEndsAt: null
        }
      });
      
      // Optionally create notifications for these users
      const notifications = ids.map(id => ({
        userId: id,
        type: 'SYSTEM',
        title: { en: 'Account Reactivated', bn: 'অ্যাকাউন্ট রিঅ্যাক্টিভেট' },
        body: { 
          en: 'Your suspension period has ended and your account is now fully active again.',
          bn: 'আপনার অ্যাকাউন্ট সাসপেনশনের মেয়াদ শেষ হয়েছে এবং অ্যাকাউন্টটি পুনরায় অ্যাক্টিভ করা হয়েছে।'
        }
      }));
      await prisma.notification.createMany({ data: notifications });
      
      console.log(`[CRON] Lifted suspension for ${ids.length} users.`);
    }
  } catch (err) {
    console.error('[CRON] Error processing user suspensions:', err);
  }
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  server.close(() => {
    process.exit(1);
  });
});

export default server;
