import mongoose, { Schema, Document } from 'mongoose';

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
  likes: string[]; // List of userIds who liked the post
  comments: IComment[];
  shares: string[]; // List of userIds who shared it
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new Schema<IPost>({
  authorId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  mediaUrl: { type: String, default: '' },
  tags: { type: [String], default: [], index: true },
  likes: { type: [String], default: [] },
  comments: { type: [CommentSchema], default: [] },
  shares: { type: [String], default: [] }
}, {
  timestamps: true
});

// Create index for feed query pagination
PostSchema.index({ createdAt: -1 });

export const PostModel = mongoose.model<IPost>('Post', PostSchema);
