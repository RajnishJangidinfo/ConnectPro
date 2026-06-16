import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import chatReducer from './chatSlice';
import feedReducer from './feedSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    feed: feedReducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
