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
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.auth?.accessToken ||
        socket.handshake.headers?.authorization ||
        socket.handshake.headers?.Authorization ||
        '';
      const token = String(rawToken).replace(/^Bearer\s+/i, '').trim();
      if (!token) return next(new Error('Authentication error: Token missing'));

      const decoded = JwtUtil.verifyToken(token);
      socket.user = decoded; // { id, role, ... }
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log(`User connected: ${userId} (Socket: ${socket.id})`);

    // Support multiple tabs: userId -> Set<socketId>
    const existing = connectedUsers.get(userId);
    if (existing instanceof Set) {
      existing.add(socket.id);
    } else if (existing) {
      connectedUsers.set(userId, new Set([existing, socket.id]));
    } else {
      connectedUsers.set(userId, new Set([socket.id]));
      socket.broadcast.emit('user_online', { userId });
    }

    socket.emit('online_users', Array.from(connectedUsers.keys()));

    socket.on('get_online_users', () => {
      socket.emit('online_users', Array.from(connectedUsers.keys()));
    });

    socket.on('join_room', (payload = {}) => {
      const roomId = payload?.roomId || payload;
      if (!roomId) return;
      socket.join(String(roomId));
      console.log(`User ${userId} joined room ${roomId}`);
    });

    socket.on('leave_room', (payload = {}) => {
      const roomId = payload?.roomId || payload;
      if (!roomId) return;
      socket.leave(String(roomId));
      console.log(`User ${userId} left room ${roomId}`);
    });

    socket.on('typing', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('user_typing', { userId, roomId });
    });

    socket.on('stop_typing', ({ roomId }) => {
      if (!roomId) return;
      socket.to(roomId).emit('user_stopped_typing', { userId, roomId });
    });

    socket.on('send_message', (message) => {
      if (!message?.roomId) return;
      socket.to(message.roomId).emit('receive_message', message);
    });

    socket.on('edit_message', (data) => {
      if (!data?.roomId) return;
      socket.to(data.roomId).emit('message_edited', data);
    });

    socket.on('delete_message', (data) => {
      if (!data?.roomId) return;
      socket.to(data.roomId).emit('message_deleted', data);
    });

    socket.on('mark_read', (data) => {
      if (!data?.roomId) return;
      socket.to(data.roomId).emit('messages_read', data);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId} (Socket: ${socket.id})`);
      const sockets = connectedUsers.get(userId);
      if (sockets instanceof Set) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          connectedUsers.delete(userId);
          socket.broadcast.emit('user_offline', { userId });
        }
      } else {
        connectedUsers.delete(userId);
        socket.broadcast.emit('user_offline', { userId });
      }
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
  const entry = connectedUsers.get(userId);
  if (!entry) return false;
  if (entry instanceof Set) return entry.size > 0;
  return Boolean(entry);
};
