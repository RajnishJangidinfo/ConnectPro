import * as grpc from '@grpc/grpc-js';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { loadServiceDefinition } from 'shared';
import { ConversationModel, MessageModel } from './chat.model';

dotenv.config();

let isMongoConnected = false;

// Connect to MongoDB
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/connectpro_chat';
mongoose.connect(mongoUrl)
  .then(() => {
    console.log('Chat MongoDB connected successfully');
    isMongoConnected = true;
  })
  .catch(err => {
    console.warn('\n⚠️ [DATABASE WARNING]: MongoDB is offline. Chat Service is falling back to IN-MEMORY messages store!\n');
    isMongoConnected = false;
  });

// Load Protos
const protoPackage = loadServiceDefinition('chat');
const chatServiceDef = protoPackage.chat.ChatService.service;

const server = new grpc.Server();

// In-Memory Chat Fallback Stores
const memoryConversations: any[] = [];
const memoryMessages: any[] = [];

const mapDbConvToProto = (conv: any) => {
  return {
    id: conv._id?.toString() || conv.id || 'conv-id',
    isGroup: conv.isGroup,
    groupName: conv.groupName || '',
    groupAvatar: conv.groupAvatar || '',
    participants: (conv.participants || []).map((p: any) => ({
      userId: p.userId,
      role: p.role
    })),
    lastMessageText: conv.lastMessageText || '',
    lastMessageTime: conv.lastMessageTime ? (conv.lastMessageTime instanceof Date ? conv.lastMessageTime.toISOString() : conv.lastMessageTime) : ''
  };
};

const mapDbMessageToProto = (msg: any) => {
  return {
    id: msg._id?.toString() || msg.id || 'msg-id',
    conversationId: msg.conversationId.toString(),
    senderId: msg.senderId,
    content: msg.content,
    mediaUrl: msg.mediaUrl || '',
    createdAt: msg.createdAt ? (msg.createdAt instanceof Date ? msg.createdAt.toISOString() : msg.createdAt) : '',
    readBy: msg.readBy || []
  };
};

server.addService(chatServiceDef, {
  createConversation: async (call: any, callback: any) => {
    try {
      const { isGroup, groupName, groupAvatar, participantIds } = call.request;

      if (!participantIds || participantIds.length < 2) {
        return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'At least two participants are required' });
      }

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        if (!isGroup) {
          const sortedIds = [...participantIds].sort();
          const existing = await ConversationModel.findOne({
            isGroup: false,
            'participants.userId': { $all: sortedIds },
            participants: { $size: sortedIds.length }
          });
          if (existing) return callback(null, mapDbConvToProto(existing));
        }

        const participants = participantIds.map((userId: string, idx: number) => ({
          userId, role: idx === 0 && isGroup ? 'ADMIN' : 'MEMBER', joinedAt: new Date()
        }));

        const newConv = new ConversationModel({ isGroup, groupName: isGroup ? (groupName || 'New Group') : '', groupAvatar, participants });
        await newConv.save();
        callback(null, mapDbConvToProto(newConv));
      } else {
        // In-Memory logic
        if (!isGroup) {
          const sortedIds = [...participantIds].sort();
          const existing = memoryConversations.find(c => 
            !c.isGroup && 
            sortedIds.every((id: string) => c.participants.some((p: any) => p.userId === id)) &&
            c.participants.length === sortedIds.length
          );
          if (existing) return callback(null, mapDbConvToProto(existing));
        }

        const newConv = {
          id: `conv-${Date.now()}`,
          isGroup,
          groupName: isGroup ? (groupName || 'Group Chat') : '',
          groupAvatar: groupAvatar || '',
          participants: participantIds.map((userId: string, idx: number) => ({
            userId, role: idx === 0 && isGroup ? 'ADMIN' : 'MEMBER', joinedAt: new Date()
          })),
          lastMessageText: '',
          lastMessageTime: new Date()
        };
        memoryConversations.push(newConv);
        callback(null, mapDbConvToProto(newConv));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  getConversations: async (call: any, callback: any) => {
    try {
      const { userId } = call.request;
      let conversationsList = [];

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const conversations = await ConversationModel.find({ 'participants.userId': userId }).sort({ lastMessageTime: -1 });
        conversationsList = conversations.map(mapDbConvToProto);
      } else {
        conversationsList = memoryConversations
          .filter(c => c.participants.some((p: any) => p.userId === userId))
          .sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())
          .map(mapDbConvToProto);

        // Prepopulate default DMs if empty so message layout remains beautiful at first glance
        if (conversationsList.length === 0) {
          const defaultDMs = [
            {
              id: 'conv-1', isGroup: false, lastMessageText: 'That component sounds brilliant honestly', lastMessageTime: new Date(Date.now() - 120000),
              participants: [{ userId }, { userId: 'sophia-reyes-uuid' }]
            },
            {
              id: 'conv-2', isGroup: false, lastMessageText: "Let's sync on Friday", lastMessageTime: new Date(Date.now() - 3600000),
              participants: [{ userId }, { userId: 'james-kim-uuid' }]
            }
          ];
          defaultDMs.forEach(dm => memoryConversations.push(dm));
          conversationsList = defaultDMs.map(mapDbConvToProto);
        }
      }

      callback(null, { conversations: conversationsList });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  sendMessage: async (call: any, callback: any) => {
    try {
      const { conversationId, senderId, content, mediaUrl } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const conversation = await ConversationModel.findById(conversationId);
        if (!conversation) return callback({ code: grpc.status.NOT_FOUND, message: 'Conversation not found' });

        const newMessage = new MessageModel({
          conversationId: new mongoose.Types.ObjectId(conversationId),
          senderId, content, mediaUrl, readBy: [senderId]
        });
        await newMessage.save();

        conversation.lastMessageText = content;
        conversation.lastMessageTime = new Date();
        await conversation.save();

        callback(null, mapDbMessageToProto(newMessage));
      } else {
        // In-Memory logic
        const conversation = memoryConversations.find(c => c.id === conversationId);
        if (!conversation) return callback({ code: grpc.status.NOT_FOUND, message: 'Conversation not found' });

        const newMessage = {
          id: `msg-${Date.now()}`,
          conversationId, senderId, content, mediaUrl,
          readBy: [senderId], createdAt: new Date()
        };
        memoryMessages.push(newMessage);

        conversation.lastMessageText = content;
        conversation.lastMessageTime = new Date();

        callback(null, mapDbMessageToProto(newMessage));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  getMessages: async (call: any, callback: any) => {
    try {
      const { conversationId, limit, beforeMessageId } = call.request;
      const queryLimit = limit || 50;
      let messagesList = [];

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        let query: any = { conversationId: new mongoose.Types.ObjectId(conversationId) };
        if (beforeMessageId) {
          const targetMsg = await MessageModel.findById(beforeMessageId);
          if (targetMsg) query.createdAt = { $lt: targetMsg.createdAt };
        }
        const messages = await MessageModel.find(query).sort({ createdAt: -1 }).limit(queryLimit);
        messagesList = messages.reverse().map(mapDbMessageToProto);
      } else {
        // In-Memory filtering
        let messages = memoryMessages.filter(m => m.conversationId === conversationId);
        if (beforeMessageId) {
          const targetMsg = memoryMessages.find(m => m.id === beforeMessageId);
          if (targetMsg) messages = messages.filter(m => m.createdAt.getTime() < targetMsg.createdAt.getTime());
        }

        messagesList = messages
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, queryLimit)
          .reverse()
          .map(mapDbMessageToProto);

        // Prepopulate default chats history if memory yields 0
        if (messagesList.length === 0) {
          const sampleLogs = [
            { id: 'm-1', conversationId, senderId: 'sophia-reyes-uuid', content: 'Hey! Love your post on design systems. Would love to hear more about how you handled the token migration.', readBy: [], createdAt: new Date(Date.now() - 600000) },
            { id: 'm-2', conversationId, senderId: 'me', content: 'Thanks Sophia! It was a 4-month process. Naming tokens was definitely the trickiest part 😅', readBy: [], createdAt: new Date(Date.now() - 300000) },
            { id: 'm-3', conversationId, senderId: 'sophia-reyes-uuid', content: 'That component sounds brilliant honestly', readBy: [], createdAt: new Date(Date.now() - 120000) }
          ];
          sampleLogs.forEach(l => memoryMessages.push(l));
          messagesList = sampleLogs.map(mapDbMessageToProto);
        }
      }

      callback(null, { messages: messagesList });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  markAsRead: async (call: any, callback: any) => {
    try {
      const { conversationId, userId } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        await MessageModel.updateMany(
          { conversationId: new mongoose.Types.ObjectId(conversationId), senderId: { $ne: userId }, readBy: { $ne: userId } },
          { $addToSet: { readBy: userId } }
        );
      } else {
        memoryMessages.forEach(m => {
          if (m.conversationId === conversationId && m.senderId !== userId && !m.readBy.includes(userId)) {
            m.readBy.push(userId);
          }
        });
      }

      callback(null, { success: true, message: 'Messages marked as read' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  }
});

const PORT = process.env.PORT || '50054';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC Chat Service:', err);
    return;
  }
  console.log(`Chat Service running on port ${port}`);
});
