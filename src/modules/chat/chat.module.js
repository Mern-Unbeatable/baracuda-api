import { Router } from 'express';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { upload } from '../../utils/upload.js';

export class ChatModule {
  constructor() {
    this.router = Router();
    this.chatService = new ChatService();
    this.chatController = new ChatController(this.chatService);
    
    this.initializeRoutes();
  }

  initializeRoutes() {
    this.router.use(requireAuth);

    // Get or Create a chat room with a specific user
    this.router.post('/room', this.chatController.getOrCreateChat);

    // Get list of all active chats (sidebar)
    this.router.get('/list', this.chatController.getChatList);

    // Get messages for a specific room
    this.router.get('/:roomId/messages', this.chatController.getMessages);

    // Send a message to a specific room (supports file upload)
    this.router.post('/:roomId/messages', upload.single('file'), this.chatController.sendMessage);

    // Edit a specific message
    this.router.put('/messages/:messageId', this.chatController.editMessage);

    // Delete a specific message
    this.router.delete('/messages/:messageId', this.chatController.deleteMessage);

    // Mark messages as read in a room
    this.router.put('/:roomId/read', this.chatController.markMessagesAsRead);
  }
}
