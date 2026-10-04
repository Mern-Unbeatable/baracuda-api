import prisma from '../../config/prisma.js';
import { getIO, isUserOnline } from '../../socket.js';
import { UrlUtil } from '../../utils/urlUtil.js';

export class ChatService {
  
  // 1. Get or Create a chat room with a specific user
  async getOrCreateChat(req, currentUserId, targetUserId) {
    if (currentUserId === targetUserId) {
      throw new Error("You cannot chat with yourself");
    }

    // Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Find existing room where both users are participants
    // Prisma doesn't have an easy "find room with exactly these two participants", 
    // so we find rooms for current user, then include participants and filter.
    const currentUserRooms = await prisma.chatParticipant.findMany({
      where: { userId: currentUserId },
      select: { roomId: true }
    });
    const roomIds = currentUserRooms.map(r => r.roomId);

    let existingRoom = await prisma.chatRoom.findFirst({
      where: {
        id: { in: roomIds },
        participants: {
          some: { userId: targetUserId }
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    if (existingRoom) {
      existingRoom.participants.forEach(p => {
        if (p.user.avatar && !p.user.avatar.startsWith('http')) {
          p.user.avatar = UrlUtil.getAbsoluteUrl(req, p.user.avatar);
        }
        p.user.isOnline = isUserOnline(p.user.id);
      });
      return existingRoom;
    }

    // Create new room if it doesn't exist
    const newRoom = await prisma.chatRoom.create({
      data: {
        participants: {
          create: [
            { userId: currentUserId },
            { userId: targetUserId }
          ]
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          }
        }
      }
    });

    newRoom.participants.forEach(p => {
      if (p.user.avatar && !p.user.avatar.startsWith('http')) {
        p.user.avatar = UrlUtil.getAbsoluteUrl(req, p.user.avatar);
      }
      p.user.isOnline = isUserOnline(p.user.id);
    });

    return newRoom;
  }

  // 2. Get Chat List (Sidebar)
  async getChatList(req, userId, search = '') {
    // Get all rooms the user is in
    const rooms = await prisma.chatParticipant.findMany({
      where: { userId },
      select: { roomId: true }
    });
    const roomIds = rooms.map(r => r.roomId);

    // Fetch rooms with latest message and other participant details
    const chatRooms = await prisma.chatRoom.findMany({
      where: { id: { in: roomIds } },
      include: {
        participants: {
          where: { userId: { not: userId } },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                avatar: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Format output and apply search if provided
    let list = chatRooms.map(room => {
      const otherUser = room.participants[0]?.user;
      if (otherUser && otherUser.avatar && !otherUser.avatar.startsWith('http')) {
        otherUser.avatar = UrlUtil.getAbsoluteUrl(req, otherUser.avatar);
      }
      if (otherUser) {
        otherUser.isOnline = isUserOnline(otherUser.id);
      }

      const lastMessage = room.messages[0] || null;
      if (lastMessage && lastMessage.fileUrl && !lastMessage.fileUrl.startsWith('http')) {
        lastMessage.fileUrl = UrlUtil.getAbsoluteUrl(req, lastMessage.fileUrl);
      }

      // Calculate unread count for current user
      return {
        roomId: room.id,
        user: otherUser,
        lastMessage,
        updatedAt: room.updatedAt
      };
    });

    // Client requested search by name/username
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(chat => {
        const u = chat.user;
        if (!u) return false;
        return (u.name && u.name.toLowerCase().includes(s)) || (u.username && u.username.toLowerCase().includes(s));
      });
    }

    return list;
  }

  // 3. Get Messages in a Room
  async getMessages(req, roomId, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const messages = await prisma.chatMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' }, // Descending to get latest, but client might reverse
      skip,
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatar: true }
        }
      }
    });

    // Format media
    messages.forEach(msg => {
      if (msg.fileUrl && !msg.fileUrl.startsWith('http')) {
        msg.fileUrl = UrlUtil.getAbsoluteUrl(req, msg.fileUrl);
      }
      if (msg.sender && msg.sender.avatar && !msg.sender.avatar.startsWith('http')) {
        msg.sender.avatar = UrlUtil.getAbsoluteUrl(req, msg.sender.avatar);
      }
    });

    const total = await prisma.chatMessage.count({ where: { roomId } });

    return {
      messages,
      total,
      page,
      limit
    };
  }

  // 4. Send Message (Text or File)
  async sendMessage(req, userId, roomId, content, file) {
    // Verify room
    const participant = await prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!participant) {
      throw new Error("You are not a participant in this chat room");
    }

    let fileUrl = null;
    let fileType = null;
    let fileName = null;

    if (file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      fileUrl = `${baseUrl}/uploads/${file.filename}`;
      fileName = file.originalname;
      
      const mime = file.mimetype;
      if (mime.startsWith('image/')) fileType = 'image';
      else if (mime.startsWith('video/')) fileType = 'video';
      else if (mime.startsWith('audio/')) fileType = 'audio';
      else fileType = 'document';
    }

    if (!content && !fileUrl) {
      throw new Error("Message content or file is required");
    }

    const newMessage = await prisma.chatMessage.create({
      data: {
        roomId,
        senderId: userId,
        content,
        fileUrl,
        fileType,
        fileName
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatar: true }
        }
      }
    });

    // Update room updatedAt
    await prisma.chatRoom.update({
      where: { id: roomId },
      data: { updatedAt: new Date() }
    });

    // Format for response
    if (newMessage.fileUrl && !newMessage.fileUrl.startsWith('http')) {
      newMessage.fileUrl = UrlUtil.getAbsoluteUrl(req, newMessage.fileUrl);
    }
    if (newMessage.sender.avatar && !newMessage.sender.avatar.startsWith('http')) {
      newMessage.sender.avatar = UrlUtil.getAbsoluteUrl(req, newMessage.sender.avatar);
    }

    // Broadcast using Socket.IO (optional to do it here, but convenient)
    const io = getIO();
    io.to(roomId).emit('receive_message', newMessage);

    // Send push notification / emit to receiver if they are not in the room
    // ...

    return newMessage;
  }

  // 5. Edit Message
  async editMessage(req, userId, messageId, newContent) {
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== userId) throw new Error("Unauthorized to edit this message");
    if (msg.isDeleted) throw new Error("Cannot edit a deleted message");

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { 
        content: newContent,
        isEdited: true
      },
      include: {
        sender: {
          select: { id: true, name: true, username: true, avatar: true }
        }
      }
    });

    if (updated.fileUrl && !updated.fileUrl.startsWith('http')) {
      updated.fileUrl = UrlUtil.getAbsoluteUrl(req, updated.fileUrl);
    }
    if (updated.sender.avatar && !updated.sender.avatar.startsWith('http')) {
      updated.sender.avatar = UrlUtil.getAbsoluteUrl(req, updated.sender.avatar);
    }

    // Broadcast change
    const io = getIO();
    io.to(updated.roomId).emit('message_edited', updated);

    return updated;
  }

  // 6. Delete Message
  async deleteMessage(userId, messageId) {
    const msg = await prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error("Message not found");
    if (msg.senderId !== userId) throw new Error("Unauthorized to delete this message");

    const deleted = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { 
        isDeleted: true,
        content: 'This message was deleted',
        fileUrl: null,
        fileName: null,
        fileType: null
      }
    });

    // Broadcast change
    const io = getIO();
    io.to(deleted.roomId).emit('message_deleted', { messageId, roomId: deleted.roomId });

    return { success: true, message: "Message deleted" };
  }
  // 7. Mark Messages as Read
  async markMessagesAsRead(userId, roomId) {
    // Mark all messages sent by OTHERS in this room as read
    const updated = await prisma.chatMessage.updateMany({
      where: {
        roomId,
        senderId: { not: userId },
        isRead: false
      },
      data: { isRead: true }
    });

    // Update the participant's lastReadAt
    await prisma.chatParticipant.update({
      where: { roomId_userId: { roomId, userId } },
      data: { lastReadAt: new Date() }
    });

    return { success: true, count: updated.count };
  }
}
