import { ResponseUtil } from '../../utils/response.js';

export class ChatController {
  constructor(chatService) {
    this.chatService = chatService;
  }

  getOrCreateChat = async (req, res, next) => {
    try {
      const { targetUserId } = req.body;
      if (!targetUserId) {
        return ResponseUtil.error(res, 'targetUserId is required', 400);
      }
      const room = await this.chatService.getOrCreateChat(req, req.user.id, targetUserId);
      return ResponseUtil.success(res, 'Chat room fetched successfully', room);
    } catch (error) {
      next(error);
    }
  };

  getChatList = async (req, res, next) => {
    try {
      const { search } = req.query;
      const list = await this.chatService.getChatList(req, req.user.id, search);
      return ResponseUtil.success(res, 'Chat list fetched successfully', list);
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      
      const result = await this.chatService.getMessages(req, roomId, page, limit);
      return ResponseUtil.success(res, 'Messages fetched successfully', result);
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const { content } = req.body;
      const file = req.file;

      const message = await this.chatService.sendMessage(req, req.user.id, roomId, content, file);
      return ResponseUtil.success(res, 'Message sent successfully', message, 201);
    } catch (error) {
      next(error);
    }
  };

  editMessage = async (req, res, next) => {
    try {
      const { messageId } = req.params;
      const { content } = req.body;
      
      const message = await this.chatService.editMessage(req, req.user.id, messageId, content);
      return ResponseUtil.success(res, 'Message edited successfully', message);
    } catch (error) {
      next(error);
    }
  };

  deleteMessage = async (req, res, next) => {
    try {
      const { messageId } = req.params;
      
      const result = await this.chatService.deleteMessage(req.user.id, messageId);
      return ResponseUtil.success(res, 'Message deleted successfully', result);
    } catch (error) {
      next(error);
    }
  };

  markMessagesAsRead = async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const result = await this.chatService.markMessagesAsRead(req.user.id, roomId);
      return ResponseUtil.success(res, 'Messages marked as read', result);
    } catch (error) {
      next(error);
    }
  };
}
