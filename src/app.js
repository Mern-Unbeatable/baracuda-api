import express from 'express';
import { UserModule } from './modules/user/user.module.js';
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

    this.app.get('/health', (req, res) => {
      res.status(200).json({ 
        status: 'OK', 
        message: 'Server is running',
        timestamp: new Date().toISOString()
      });
    });

    // Feature Modules
    const userModule = new UserModule();
    this.app.use('/api/users', userModule.router);
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
      
      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(config.app.env === 'development' && { stack: err.stack })
      });
    });
  }
}

// Export the raw express instance for the server
export default new App().app;
