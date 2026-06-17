"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grpc = __importStar(require("@grpc/grpc-js"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
const shared_1 = require("shared");
const chat_model_1 = require("./chat.model");
dotenv.config();
let isMongoConnected = false;
// Connect to MongoDB
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/connectpro_chat';
mongoose_1.default.connect(mongoUrl)
    .then(() => {
    console.log('Chat MongoDB connected successfully');
    isMongoConnected = true;
})
    .catch(err => {
    console.warn('\n⚠️ [DATABASE WARNING]: MongoDB is offline. Chat Service is falling back to IN-MEMORY messages store!\n');
    isMongoConnected = false;
});
// Load Protos
const protoPackage = (0, shared_1.loadServiceDefinition)('chat');
const chatServiceDef = protoPackage.chat.ChatService.service;
const server = new grpc.Server();
// In-Memory Chat Fallback Stores
const memoryConversations = [];
const memoryMessages = [];
const mapDbConvToProto = (conv) => {
    return {
        id: conv._id?.toString() || conv.id || 'conv-id',
        isGroup: conv.isGroup,
        groupName: conv.groupName || '',
        groupAvatar: conv.groupAvatar || '',
        participants: (conv.participants || []).map((p) => ({
            userId: p.userId,
            role: p.role
        })),
        lastMessageText: conv.lastMessageText || '',
        lastMessageTime: conv.lastMessageTime ? (conv.lastMessageTime instanceof Date ? conv.lastMessageTime.toISOString() : conv.lastMessageTime) : ''
    };
};
const mapDbMessageToProto = (msg) => {
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
    createConversation: async (call, callback) => {
        try {
            const { isGroup, groupName, groupAvatar, participantIds } = call.request;
            if (!participantIds || participantIds.length < 2) {
                return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'At least two participants are required' });
            }
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                if (!isGroup) {
                    const sortedIds = [...participantIds].sort();
                    const existing = await chat_model_1.ConversationModel.findOne({
                        isGroup: false,
                        'participants.userId': { $all: sortedIds },
                        participants: { $size: sortedIds.length }
                    });
                    if (existing)
                        return callback(null, mapDbConvToProto(existing));
                }
                const participants = participantIds.map((userId, idx) => ({
                    userId, role: idx === 0 && isGroup ? 'ADMIN' : 'MEMBER', joinedAt: new Date()
                }));
                const newConv = new chat_model_1.ConversationModel({ isGroup, groupName: isGroup ? (groupName || 'New Group') : '', groupAvatar, participants });
                await newConv.save();
                callback(null, mapDbConvToProto(newConv));
            }
            else {
                // In-Memory logic
                if (!isGroup) {
                    const sortedIds = [...participantIds].sort();
                    const existing = memoryConversations.find(c => !c.isGroup &&
                        sortedIds.every((id) => c.participants.some((p) => p.userId === id)) &&
                        c.participants.length === sortedIds.length);
                    if (existing)
                        return callback(null, mapDbConvToProto(existing));
                }
                const newConv = {
                    id: `conv-${Date.now()}`,
                    isGroup,
                    groupName: isGroup ? (groupName || 'Group Chat') : '',
                    groupAvatar: groupAvatar || '',
                    participants: participantIds.map((userId, idx) => ({
                        userId, role: idx === 0 && isGroup ? 'ADMIN' : 'MEMBER', joinedAt: new Date()
                    })),
                    lastMessageText: '',
                    lastMessageTime: new Date()
                };
                memoryConversations.push(newConv);
                callback(null, mapDbConvToProto(newConv));
            }
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    getConversations: async (call, callback) => {
        try {
            const { userId } = call.request;
            let conversationsList = [];
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const conversations = await chat_model_1.ConversationModel.find({ 'participants.userId': userId }).sort({ lastMessageTime: -1 });
                conversationsList = conversations.map(mapDbConvToProto);
            }
            else {
                conversationsList = memoryConversations
                    .filter(c => c.participants.some((p) => p.userId === userId))
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
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    sendMessage: async (call, callback) => {
        try {
            const { conversationId, senderId, content, mediaUrl } = call.request;
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const conversation = await chat_model_1.ConversationModel.findById(conversationId);
                if (!conversation)
                    return callback({ code: grpc.status.NOT_FOUND, message: 'Conversation not found' });
                const newMessage = new chat_model_1.MessageModel({
                    conversationId: new mongoose_1.default.Types.ObjectId(conversationId),
                    senderId, content, mediaUrl, readBy: [senderId]
                });
                await newMessage.save();
                conversation.lastMessageText = content;
                conversation.lastMessageTime = new Date();
                await conversation.save();
                callback(null, mapDbMessageToProto(newMessage));
            }
            else {
                // In-Memory logic
                const conversation = memoryConversations.find(c => c.id === conversationId);
                if (!conversation)
                    return callback({ code: grpc.status.NOT_FOUND, message: 'Conversation not found' });
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
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    getMessages: async (call, callback) => {
        try {
            const { conversationId, limit, beforeMessageId } = call.request;
            const queryLimit = limit || 50;
            let messagesList = [];
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                let query = { conversationId: new mongoose_1.default.Types.ObjectId(conversationId) };
                if (beforeMessageId) {
                    const targetMsg = await chat_model_1.MessageModel.findById(beforeMessageId);
                    if (targetMsg)
                        query.createdAt = { $lt: targetMsg.createdAt };
                }
                const messages = await chat_model_1.MessageModel.find(query).sort({ createdAt: -1 }).limit(queryLimit);
                messagesList = messages.reverse().map(mapDbMessageToProto);
            }
            else {
                // In-Memory filtering
                let messages = memoryMessages.filter(m => m.conversationId === conversationId);
                if (beforeMessageId) {
                    const targetMsg = memoryMessages.find(m => m.id === beforeMessageId);
                    if (targetMsg)
                        messages = messages.filter(m => m.createdAt.getTime() < targetMsg.createdAt.getTime());
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
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    markAsRead: async (call, callback) => {
        try {
            const { conversationId, userId } = call.request;
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                await chat_model_1.MessageModel.updateMany({ conversationId: new mongoose_1.default.Types.ObjectId(conversationId), senderId: { $ne: userId }, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
            }
            else {
                memoryMessages.forEach(m => {
                    if (m.conversationId === conversationId && m.senderId !== userId && !m.readBy.includes(userId)) {
                        m.readBy.push(userId);
                    }
                });
            }
            callback(null, { success: true, message: 'Messages marked as read' });
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    }
});
const PORT = process.env.CHAT_PORT || '50054';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error('Failed to bind gRPC Chat Service:', err);
        return;
    }
    console.log(`Chat Service running on port ${port}`);
});
//# sourceMappingURL=server.js.map