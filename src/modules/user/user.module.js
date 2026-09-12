import { Router } from 'express';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';

/**
 * User Module
 * Acts as the entry point for the user feature domain.
 * Wires dependencies and exposes the configured router.
 */
export class UserModule {
  constructor() {
    this.router = Router();
    
    // Dependency Injection
    this.userService = new UserService();
    this.userController = new UserController(this.userService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.get('/', this.userController.getAllUsers);
    this.router.get('/:id', this.userController.getUserById);
    this.router.post('/', this.userController.createUser);
    this.router.put('/:id', this.userController.updateUser);
    this.router.delete('/:id', this.userController.deleteUser);
  }
}
