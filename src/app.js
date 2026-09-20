import express from 'express';
import { UserModule } from './modules/user/user.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CategoryModule } from './modules/category/category.module.js';
import { ArtworkModule } from './modules/artwork/artwork.module.js';
import { CompetitionModule } from './modules/competition/competition.module.js';
import { MarketplaceModule } from './modules/marketplace/marketplace.module.js';
import { PostModule } from './modules/post/post.module.js';
import { AdvertisementModule } from './modules/advertisement/advertisement.module.js';
import { BusinessModule } from './modules/business/business.module.js';
import { NewsletterModule } from './modules/newsletter/newsletter.module.js';
import { AlbumTypeModule } from './modules/album-type/album-type.module.js';
import paymentRouter from './modules/payment/payment.module.js';
import config from './config/env.js';

/**
 * Main Application Class
 * Bootstraps the Express application, sets up middlewares, modules, and error handling.
 */
class App {
  constructor() {
    this.app = express();
    
    this.initializeMiddlewares();
    this.initializeModules();
    this.initializeErrorHandling();
  }

  initializeMiddlewares() {
    // Middleware to parse JSON request bodies
    this.app.use(express.json());
    
    // Middleware to parse URL-encoded request bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Serve uploaded files statically
    this.app.use('/uploads', express.static('uploads'));
  }

  initializeModules() {
    // Basic Routes
    this.app.get('/', (req, res) => {
      res.status(200).json({ 
        status: 'OK', 
        message: 'Welcome to the API',
        version: '1.0.0',
        Email: "shanjidahmed66@gmail.com",
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/test', (req, res) => res.send('OK'));
    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
      });
    });

    // Feature Modules
    const authModule = new AuthModule();
    this.app.use('/api/v1/auth', authModule.router);

    const userModule = new UserModule();
    this.app.use('/api/v1/admin/users', userModule.router);
    
    this.app.use('/api/v1/categories', CategoryModule.router);

    const artworkModule = new ArtworkModule();
    this.app.use('/api/v1/artworks', artworkModule.router);

    const competitionModule = new CompetitionModule();
    this.app.use('/api/v1/competitions', competitionModule.router);

    const marketplaceModule = new MarketplaceModule();
    this.app.use('/api/v1/marketplace', marketplaceModule.router);

    const postModule = new PostModule();
    this.app.use('/api/v1/posts', postModule.router);

    const advertisementModule = new AdvertisementModule();
    this.app.use('/api/v1/advertisements', advertisementModule.router);

    const businessModule = new BusinessModule();
    this.app.use('/api/v1/business-links', businessModule.router);

    const newsletterModule = new NewsletterModule();
    this.app.use('/api/v1/newsletter', newsletterModule.router);

    const albumTypeModule = new AlbumTypeModule();
    this.app.use('/api/v1/album-types', albumTypeModule.router);

    this.app.use('/api/v1/payments', paymentRouter);
  }

  initializeErrorHandling() {
    // 404 handler - catch all undefined routes
    this.app.use((req, res) => {
      res.status(404).json({ 
        error: 'Not Found',
        message: 'The requested resource does not exist'
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error('Error:', err);
      
      // Catch specific Multer format errors
      if (err.message && (err.message.includes('Supported formats are') || err.message.includes('Only mp4 videos'))) {
        err.status = 400;
      }
      
      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(config.app.env === 'development' && { stack: err.stack })
      });
    });
  }
}

// Export the raw express instance for the server
export default new App().app;
