import { Server } from 'socket.io';
import { JwtUtil } from './utils/jwt.js';

let io;
// Keep track of connected users: { userId: socketId }
const connectedUsers = new Map();

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5500', 'https://baracuda260.maktechgroup.tech', 'https://www.baracuda260.maktechgroup.tech'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: Token missing'));
      
      const decoded = await JwtUtil.verifyToken(token);
      socket.user = decoded; // { id, role, ... }
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);
    
    // Store user socket mapping
    connectedUsers.set(userId, socket.id);

    // Broadcast online status to others
    socket.broadcast.emit('user_online', { userId });

    // Send the list of currently online users to the newly connected user (optional but helpful)
    socket.emit('online_users', Array.from(connectedUsers.keys()));

    // Join a specific chat room
    socket.on('join_room', ({ roomId }) => {
      socket.join(roomId);
      console.log(`User ${userId} joined room ${roomId}`);
    });

    // Leave a specific chat room
    socket.on('leave_room', ({ roomId }) => {
      socket.leave(roomId);
      console.log(`User ${userId} left room ${roomId}`);
    });

    // Typing indicators
    socket.on('typing', ({ roomId }) => {
      socket.to(roomId).emit('user_typing', { userId, roomId });
    });

    socket.on('stop_typing', ({ roomId }) => {
      socket.to(roomId).emit('user_stopped_typing', { userId, roomId });
    });

    // New message event
    socket.on('send_message', (message) => {
      // Broadcast to the specific room
      socket.to(message.roomId).emit('receive_message', message);
    });

    // Edit message event
    socket.on('edit_message', (data) => {
      socket.to(data.roomId).emit('message_edited', data);
    });

    // Delete message event
    socket.on('delete_message', (data) => {
      socket.to(data.roomId).emit('message_deleted', data);
    });

    // Mark messages as read event
    socket.on('mark_read', (data) => {
      socket.to(data.roomId).emit('messages_read', data); // data could be { roomId, readerId }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId} (Socket: ${socket.id})`);
      connectedUsers.delete(userId);
      socket.broadcast.emit('user_offline', { userId });
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io is not initialized!');
  }
  return io;
};

export const getConnectedUsers = () => {
  return Array.from(connectedUsers.keys());
};

export const isUserOnline = (userId) => {
  return connectedUsers.has(userId);
};
