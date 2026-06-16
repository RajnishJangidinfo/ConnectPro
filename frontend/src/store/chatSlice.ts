import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface IConversation {
  id: string;
  isGroup: boolean;
  groupName: string;
  groupAvatar: string;
  lastMessageText: string;
  lastMessageTime: string;
  otherUser?: {
    userId: string;
    firstName: string;
    lastName: string;
    headline: string;
    avatar: string;
  };
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  mediaUrl: string;
  createdAt: string;
  readBy: string[];
}

interface ChatState {
  conversations: IConversation[];
  activeConversationId: string | null;
  messages: { [conversationId: string]: IMessage[] };
  typingStatus: { [conversationId: string]: { [userId: string]: boolean } };
}

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingStatus: {}
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<IConversation[]>) => {
      state.conversations = action.payload;
    },
    setActiveConversationId: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload;
    },
    setMessages: (state, action: PayloadAction<{ conversationId: string; messages: IMessage[] }>) => {
      state.messages[action.payload.conversationId] = action.payload.messages;
    },
    addMessage: (state, action: PayloadAction<IMessage>) => {
      const { conversationId } = action.payload;
      if (!state.messages[conversationId]) {
        state.messages[conversationId] = [];
      }
      // Avoid duplicate keys
      const exists = state.messages[conversationId].some(m => m.id === action.payload.id);
      if (!exists) {
        state.messages[conversationId].push(action.payload);
      }
      
      // Update last message preview in conversations list
      const conv = state.conversations.find(c => c.id === conversationId);
      if (conv) {
        conv.lastMessageText = action.payload.content;
        conv.lastMessageTime = action.payload.createdAt;
      }
      
      // Re-sort conversations
      state.conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
    },
    setTyping: (state, action: PayloadAction<{ conversationId: string; userId: string; typing: boolean }>) => {
      const { conversationId, userId, typing } = action.payload;
      if (!state.typingStatus[conversationId]) {
        state.typingStatus[conversationId] = {};
      }
      state.typingStatus[conversationId][userId] = typing;
    }
  }
});

export const { setConversations, setActiveConversationId, setMessages, addMessage, setTyping } = chatSlice.actions;
export default chatSlice.reducer;
