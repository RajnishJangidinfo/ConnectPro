import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant {
  userId: string;
  role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
  joinedAt: Date;
}

export interface IConversation extends Document {
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  participants: IParticipant[];
  lastMessageText?: string;
  lastMessageTime?: Date;
  createdAt: Date;
}

export interface IMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  senderId: string;
  content: string;
  mediaUrl?: string;
  readBy: string[]; // List of userIds who have read this message
  createdAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  userId: { type: String, required: true },
  role: { type: String, enum: ['ADMIN', 'MODERATOR', 'MEMBER'], default: 'MEMBER' },
  joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const ConversationSchema = new Schema<IConversation>({
  isGroup: { type: Boolean, default: false },
  groupName: { type: String },
  groupAvatar: { type: String, default: '' },
  participants: { type: [ParticipantSchema], required: true },
  lastMessageText: { type: String, default: '' },
  lastMessageTime: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const MessageSchema = new Schema<IMessage>({
  conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  mediaUrl: { type: String, default: '' },
  readBy: { type: [String], default: [] }
}, {
  timestamps: true
});

// Compound index for fast message history retrieval
MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ConversationModel = mongoose.model<IConversation>('Conversation', ConversationSchema);
export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);
