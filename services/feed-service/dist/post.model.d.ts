import mongoose, { Document } from 'mongoose';
export interface IComment {
    userId: string;
    content: string;
    createdAt: Date;
}
export interface IPost extends Document {
    authorId: string;
    content: string;
    mediaUrl?: string;
    tags: string[];
    likes: string[];
    comments: IComment[];
    shares: string[];
    createdAt: Date;
    updatedAt: Date;
}
export declare const PostModel: mongoose.Model<IPost, {}, {}, {}, mongoose.Document<unknown, {}, IPost, {}, {}> & IPost & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
