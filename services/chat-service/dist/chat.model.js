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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageModel = exports.ConversationModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ParticipantSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'MODERATOR', 'MEMBER'], default: 'MEMBER' },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false });
const ConversationSchema = new mongoose_1.Schema({
    isGroup: { type: Boolean, default: false },
    groupName: { type: String },
    groupAvatar: { type: String, default: '' },
    participants: { type: [ParticipantSchema], required: true },
    lastMessageText: { type: String, default: '' },
    lastMessageTime: { type: Date, default: Date.now }
}, {
    timestamps: true
});
const MessageSchema = new mongoose_1.Schema({
    conversationId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    mediaUrl: { type: String, default: '' },
    readBy: { type: [String], default: [] }
}, {
    timestamps: true
});
// Compound index for fast message history retrieval
MessageSchema.index({ conversationId: 1, createdAt: -1 });
exports.ConversationModel = mongoose_1.default.model('Conversation', ConversationSchema);
exports.MessageModel = mongoose_1.default.model('Message', MessageSchema);
//# sourceMappingURL=chat.model.js.map