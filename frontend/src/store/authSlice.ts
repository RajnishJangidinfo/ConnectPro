import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface IUser {
  id: string;
  email: string;
  role: string;
}

export interface IProfile {
  id: string;
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  location: string;
  profilePicture: string;
  coverPhoto: string;
  website: string;
  githubUrl: string;
  linkedinUrl: string;
  skills: { id: string; name: string }[];
  workExperience: any[];
  education: any[];
  privacy: {
    profileVisible: boolean;
    showViews: boolean;
    openToWork: boolean;
  };
}

interface AuthState {
  token: string | null;
  user: IUser | null;
  profile: IProfile | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  token: typeof window !== 'undefined' ? localStorage.getItem('connectpro_token') : null,
  user: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('connectpro_user') || 'null') : null,
  profile: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('connectpro_profile') || 'null') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('connectpro_token') : false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoginSuccess: (state, action: PayloadAction<{ token: string; user: IUser; profile: IProfile | null }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.profile = action.payload.profile;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('connectpro_token', action.payload.token);
        localStorage.setItem('connectpro_user', JSON.stringify(action.payload.user));
        localStorage.setItem('connectpro_profile', JSON.stringify(action.payload.profile));
      }
    },
    updateLocalProfile: (state, action: PayloadAction<IProfile>) => {
      state.profile = action.payload;
      if (typeof window !== 'undefined') {
        localStorage.setItem('connectpro_profile', JSON.stringify(action.payload));
      }
    },
    setLogout: (state) => {
      state.token = null;
      state.user = null;
      state.profile = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('connectpro_token');
        localStorage.removeItem('connectpro_user');
        localStorage.removeItem('connectpro_profile');
      }
    }
  }
});

export const { setLoginSuccess, updateLocalProfile, setLogout } = authSlice.actions;
export default authSlice.reducer;
