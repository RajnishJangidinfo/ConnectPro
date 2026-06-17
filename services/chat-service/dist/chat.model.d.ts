import mongoose, { Document } from 'mongoose';
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
    readBy: string[];
    createdAt: Date;
}
export declare const ConversationModel: mongoose.Model<IConversation, {}, {}, {}, mongoose.Document<unknown, {}, IConversation, {}, {}> & IConversation & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const MessageModel: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage, {}, {}> & IMessage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
