import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface IComment {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface IPost {
  id: string;
  authorId: string;
  content: string;
  mediaUrl: string;
  tags: string[];
  likesCount: number;
  likes?: string[];
  comments: IComment[];
  createdAt: string;
  authorName: string;
  authorHeadline: string;
  authorAvatar: string;
}

interface FeedState {
  posts: IPost[];
}

const initialState: FeedState = {
  posts: []
};

const feedSlice = createSlice({
  name: 'feed',
  initialState,
  reducers: {
    setPosts: (state, action: PayloadAction<IPost[]>) => {
      state.posts = action.payload;
    },
    addPost: (state, action: PayloadAction<IPost>) => {
      state.posts.unshift(action.payload);
    },
    toggleLikePost: (state, action: PayloadAction<{ postId: string; userId: string }>) => {
      const { postId, userId } = action.payload;
      const post = state.posts.find(p => p.id === postId);
      if (post) {
        // Toggle client-side likesCount (approximate)
        post.likesCount += 1; // Simplification for UI toggle
      }
    },
    addCommentToPost: (state, action: PayloadAction<{ postId: string; comment: IComment }>) => {
      const { postId, comment } = action.payload;
      const post = state.posts.find(p => p.id === postId);
      if (post) {
        post.comments.push(comment);
      }
    }
  }
});

export const { setPosts, addPost, toggleLikePost, addCommentToPost } = feedSlice.actions;
export default feedSlice.reducer;
