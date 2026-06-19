'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import { RootState } from '../store';
import { setLoginSuccess, setLogout, updateLocalProfile } from '../store/authSlice';
import { setConversations, setActiveConversationId, setMessages, addMessage, setTyping } from '../store/chatSlice';
import { setPosts, addPost, toggleLikePost, addCommentToPost } from '../store/feedSlice';
import {
  Home, Users, MessageSquare, Users2, Bell, Shield, LogOut, Search, Sun, Moon,
  Plus, Send, Paperclip, Image as ImageIcon, Mic, ThumbsUp, MessageCircle, Repeat,
  MapPin, Mail, X, CheckCircle, Briefcase, GraduationCap, Award, Info, Lock, Copy
} from 'lucide-react';

const GATEWAY_URL = (process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3002').replace(/\/$/, '');
const API_URL = `${GATEWAY_URL}/api/v1`;

export default function ConnectProApp() {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const chat = useSelector((state: RootState) => state.chat);
  const feed = useSelector((state: RootState) => state.feed);

  // App Routing State
  const [currentPage, setCurrentPage] = useState<'login' | 'register' | 'forgot' | 'app'>('login');
  const [currentAppTab, setCurrentAppTab] = useState<'feed' | 'profile' | 'messages' | 'connections' | 'groups' | 'search' | 'admin' | 'logs' | 'superadmin'>('feed');

  // UI States
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'info' | 'warning' }[]>([]);
  const [logsList, setLogsList] = useState<any[]>([]);
  const [logsSearchQuery, setLogsSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(2);
  const [notifications, setNotifications] = useState([
    { id: '1', unread: true, actor: 'Sophia Reyes', text: 'accepted your connection request', time: '5m ago' },
    { id: '2', unread: true, actor: 'James Kim', text: 'sent you a message: "Let\'s sync on Friday"', time: '1h ago' }
  ]);

  // Form Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');

  // Feed inputs
  const [postText, setPostText] = useState('');
  const [postMedia, setPostMedia] = useState('');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

  // Connection Lists
  const [connectionsList, setConnectionsList] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [networkTab, setNetworkTab] = useState<'connections' | 'requests' | 'suggestions'>('connections');

  // Message / Chat state
  const [typedMessage, setTypedMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Group Inputs
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [myGroups, setMyGroups] = useState([
    { id: 'g1', name: 'Design Systems Guild', desc: 'A community for designers and engineers building scalable component libraries and design tokens.', members: '12.4k', type: 'Private', avatar: '🎨' },
    { id: 'g2', name: 'AI Product Leaders', desc: 'Executives and PMs building AI-first products. Strategy, ethics, and the future of human-AI collaboration.', members: '34.1k', type: 'Public', avatar: '🤖' },
    { id: 'g3', name: 'Startup Founders Network', desc: 'Connect with founders at every stage. Share learnings, find co-founders, and get early-stage advice.', members: '8.7k', type: 'Private', avatar: '🚀' }
  ]);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editHeadline, setEditHeadline] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editBio, setEditBio] = useState('');

  // Search input
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPeople, setSearchPeople] = useState<any[]>([]);
  const [requestSentIds, setRequestSentIds] = useState<Set<string>>(new Set());

  // Super Admin – User Management
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersSearch, setAdminUsersSearch] = useState('');
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);
  const [selectedUserForConnections, setSelectedUserForConnections] = useState<any | null>(null);
  const [userConnections, setUserConnections] = useState<any[]>([]);
  const [userConnectionsLoading, setUserConnectionsLoading] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);

  // Forgot Password popup states
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Check User details states
  const [showCheckUserModal, setShowCheckUserModal] = useState(false);
  const [selectedCheckUser, setSelectedCheckUser] = useState<any | null>(null);
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [isAdminUpdatingPassword, setIsAdminUpdatingPassword] = useState(false);

  const fetchAdminUsers = async () => {
    if (!auth.token) return;
    setAdminUsersLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) setAdminUsers(data.users || []);
      else showToast(data.error || 'Failed to fetch users', 'warning');
    } catch {
      showToast('Could not reach user management API', 'warning');
    } finally {
      setAdminUsersLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, role: data.user.role } : u));
        showToast(`Role updated to ${role}`, 'success');
      } else showToast(data.error || 'Role update failed', 'warning');
    } catch { showToast('Failed to update role', 'warning'); }
  };

  const handleToggleStatus = async (userId: string, isActive: boolean) => {
    try {
      const res = await fetch(`${API_URL}/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.token}` },
        body: JSON.stringify({ isActive })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: data.user.isActive } : u));
        showToast(isActive ? 'Account activated' : 'Account deactivated', 'success');
      } else showToast(data.error || 'Status update failed', 'warning');
    } catch { showToast('Failed to update status', 'warning'); }
    setConfirmDeactivate(null);
  };

  const handleShowConnections = async (user: any) => {
    setSelectedUserForConnections(user);
    setShowConnectionsModal(true);
    setUserConnectionsLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${user.id}/connections`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) setUserConnections(data.connections || []);
      else showToast(data.error || 'Failed to fetch connections', 'warning');
    } catch {
      showToast('Could not reach connections API', 'warning');
    } finally {
      setUserConnectionsLoading(false);
    }
  };

  const handleResetPasswordAndLogin = async () => {
    if (!forgotEmail || !forgotNewPassword) {
      showToast('Email and new password are required', 'warning');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      showToast('Passwords do not match', 'warning');
      return;
    }
    setIsResettingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPassword })
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(setLoginSuccess({ token: data.token, user: data.user, profile: data.profile }));
        postClientAuditLog('PASSWORD_RESET_AUTO_LOGIN_FRONTEND', `User reset password and logged in automatically.`);
        showToast('Password updated! You are now logged in.', 'success');
        setIsForgotModalOpen(false);
        setCurrentPage('app');
      } else {
        showToast(data.error || 'Failed to reset password', 'warning');
      }
    } catch (err) {
      showToast('Error connecting to authentication service', 'warning');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCheckUser = (user: any) => {
    setSelectedCheckUser(user);
    setAdminNewPassword('');
    setShowCheckUserModal(true);
  };

  const handleAdminResetPassword = async () => {
    if (!selectedCheckUser || !adminNewPassword) {
      showToast('Please type a new password', 'warning');
      return;
    }
    setIsAdminUpdatingPassword(true);
    try {
      const res = await fetch(`${API_URL}/admin/users/${selectedCheckUser.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ newPassword: adminNewPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminUsers(prev => prev.map(u => u.id === selectedCheckUser.id ? { ...u, passwordHash: data.user.passwordHash || u.passwordHash } : u));
        if (selectedCheckUser.id === auth.user?.id) {
          showToast('Your password was updated successfully!', 'success');
        } else {
          showToast(`Password updated for ${selectedCheckUser.email}`, 'success');
        }
        setAdminNewPassword('');
        setSelectedCheckUser((prev: any) => prev ? { ...prev, passwordHash: data.user.passwordHash || prev.passwordHash } : null);
      } else {
        showToast(data.error || 'Failed to update password', 'warning');
      }
    } catch {
      showToast('Error resetting user password', 'warning');
    } finally {
      setIsAdminUpdatingPassword(false);
    }
  };

  useEffect(() => {
    if (currentAppTab === 'superadmin' && auth.token) fetchAdminUsers();
  }, [currentAppTab, auth.token]);

  // Toast Handler
  const showToast = (msg: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/logs`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setLogsList(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const postClientAuditLog = async (action: string, details: string) => {
    try {
      await fetch(`${API_URL}/audit/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ action, details })
      });
    } catch (err) {
      console.error('Failed to send audit log:', err);
    }
  };

  useEffect(() => {
    if (currentAppTab === 'logs' && auth.token) {
      fetchAuditLogs();
    }
  }, [currentAppTab, auth.token]);

  // Switch Theme
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  // Route syncing with Auth
  useEffect(() => {
    if (auth.isAuthenticated) {
      setCurrentPage('app');
      setCurrentAppTab('feed');
      fetchFeed();
      fetchConversations();
      fetchConnections();
      fetchSuggestions();
    } else {
      setCurrentPage('login');
    }
  }, [auth.isAuthenticated]);

  // Establish WebSockets Connection
  useEffect(() => {
    if (!auth.token) return;

    const socket = io(GATEWAY_URL, {
      auth: { token: auth.token }
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO Connected to API Gateway');
    });

    socket.on('receive_message', (data: any) => {
      dispatch(addMessage(data.message));
      if (chat.activeConversationId !== data.conversationId) {
        showToast(`New message: "${data.message.content.substring(0, 20)}..."`, 'info');
      }
    });

    socket.on('user_typing', (data: any) => {
      dispatch(setTyping({
        conversationId: data.conversationId,
        userId: data.userId,
        typing: data.typing
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [auth.token, chat.activeConversationId]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.activeConversationId]);

  // REST API Requests
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return showToast('Please enter credentials', 'warning');

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      dispatch(setLoginSuccess({
        token: data.token,
        user: data.user,
        profile: data.profile
      }));
      showToast('Welcome back, ' + (data.profile?.firstName || 'Alex') + '! 👋', 'success');
    } catch (err: any) {
      showToast(err.message, 'warning');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !firstName || !lastName) {
      return showToast('Missing required registration fields', 'warning');
    }

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, password, firstName, lastName, headline, location
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      dispatch(setLoginSuccess({
        token: data.token,
        user: data.user,
        profile: data.profile
      }));
      showToast('Account setup complete! Welcome to ConnectPro 🎉', 'success');
    } catch (err: any) {
      showToast(err.message, 'warning');
    }
  };

  const handleLogout = () => {
    dispatch(setLogout());
    setCurrentPage('login');
    showToast('Signed out successfully.', 'info');
  };

  // Fetch News Feed
  const fetchFeed = async () => {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/posts`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(setPosts(data.posts || []));
      }
    } catch (err) { }
  };

  // Submit Post
  const handlePublishPost = async () => {
    if (!postText.trim()) return showToast('Please type something', 'warning');
    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ content: postText, mediaUrl: postMedia })
      });
      const newPost = await res.json();
      if (res.ok) {
        dispatch(addPost({
          ...newPost,
          authorName: `${auth.profile?.firstName} ${auth.profile?.lastName}`,
          authorHeadline: auth.profile?.headline || 'Professional',
          authorAvatar: auth.profile?.profilePicture || ''
        }));
        setPostText('');
        setPostMedia('');
        setIsPostModalOpen(false);
        showToast('Post published successfully!', 'success');
      }
    } catch (err) { }
  };

  // Post Like
  const handleLike = async (postId: string) => {
    try {
      const res = await fetch(`${API_URL}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      if (res.ok) {
        dispatch(toggleLikePost({ postId, userId: auth.user?.id || '' }));
        showToast('Liked post!', 'success');
      }
    } catch (err) { }
  };

  // Comment on Post
  const handleComment = async (postId: string) => {
    const commentVal = commentInputs[postId];
    if (!commentVal || !commentVal.trim()) return;

    try {
      const res = await fetch(`${API_URL}/posts/${postId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ content: commentVal })
      });
      if (res.ok) {
        dispatch(addCommentToPost({
          postId,
          comment: {
            id: Date.now().toString(),
            userId: auth.user?.id || '',
            content: commentVal,
            createdAt: new Date().toISOString()
          }
        }));
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        showToast('Comment added!', 'success');
      }
    } catch (err) { }
  };

  // Fetch Message Conversations
  const fetchConversations = async () => {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/chats/conversations`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(setConversations(data.conversations || []));
      }
    } catch (err) { }
  };

  // Open Message Conversation Thread
  const handleOpenConversation = async (convId: string) => {
    dispatch(setActiveConversationId(convId));
    if (socketRef.current) {
      socketRef.current.emit('join_room', convId);
    }
    try {
      const res = await fetch(`${API_URL}/chats/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(setMessages({ conversationId: convId, messages: data.messages || [] }));
        await fetch(`${API_URL}/chats/conversations/${convId}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${auth.token}` }
        });
      }
    } catch (err) { }
  };

  // Send Chat Message
  const handleSendChatMessage = async () => {
    if (!typedMessage.trim() || !chat.activeConversationId) return;
    try {
      const res = await fetch(`${API_URL}/chats/conversations/${chat.activeConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ content: typedMessage })
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(addMessage(data));

        if (socketRef.current) {
          socketRef.current.emit('chat_message', {
            conversationId: chat.activeConversationId,
            message: data
          });
          socketRef.current.emit('typing_stop', { conversationId: chat.activeConversationId });
        }

        setTypedMessage('');
        setIsTyping(false);
      }
    } catch (err) { }
  };

  // Handle Typing indicator triggers
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTypedMessage(e.target.value);
    if (!socketRef.current || !chat.activeConversationId) return;

    if (!isTyping && e.target.value.length > 0) {
      setIsTyping(true);
      socketRef.current.emit('typing_start', { conversationId: chat.activeConversationId });
    } else if (isTyping && e.target.value.length === 0) {
      setIsTyping(false);
      socketRef.current.emit('typing_stop', { conversationId: chat.activeConversationId });
    }
  };

  // Fetch Connections & Suggestions
  const fetchConnections = async () => {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/connections?status=ACCEPTED`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) setConnectionsList(data.connections || []);

      const pendingRes = await fetch(`${API_URL}/connections?status=PENDING`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const pendingData = await pendingRes.json();
      if (pendingRes.ok) setPendingRequests(pendingData.connections || []);
    } catch (err) { }
  };

  const fetchSuggestions = async () => {
    if (!auth.token) return;
    try {
      const res = await fetch(`${API_URL}/connections/suggestions`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok) setSuggestions(data.suggestions || []);
    } catch (err) { }
  };

  const handleSendConnectionInvite = async (targetId: string) => {
    try {
      const res = await fetch(`${API_URL}/connections/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ receiverId: targetId })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Connection invitation sent!', 'success');
        fetchSuggestions();
      } else {
        showToast(data.message || 'Failed to send request', 'warning');
      }
    } catch (err) { }
  };

  const handleAcceptConnection = async (senderId: string) => {
    try {
      const res = await fetch(`${API_URL}/connections/request/accept`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({ senderId })
      });
      if (res.ok) {
        showToast('Connection accepted successfully!', 'success');
        fetchConnections();
      }
    } catch (err) { }
  };

  const handleSaveProfileUpdates = async () => {
    try {
      const res = await fetch(`${API_URL}/profiles/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          firstName: editFirstName,
          lastName: editLastName,
          headline: editHeadline,
          location: editLocation,
          bio: editBio
        })
      });
      const data = await res.json();
      if (res.ok) {
        dispatch(updateLocalProfile(data));
        showToast('Profile updated!', 'success');
        setIsEditProfileOpen(false);
      }
    } catch (err) { }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`${API_URL}/profiles/search?username=${encodeURIComponent(searchQuery.trim())}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
      });
      const data = await res.json();
      if (res.ok && data.profiles && data.profiles.length > 0) {
        setSearchPeople(data.profiles);
      } else {
        showToast('No users found matching that username', 'warning');
        setSearchPeople([]);
      }
    } catch (err) {
      setSearchPeople([]);
    }
  };

  const handleDirectDM = async (targetUserId: string) => {
    try {
      const res = await fetch(`${API_URL}/chats/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        },
        body: JSON.stringify({
          isGroup: false,
          participantIds: [targetUserId]
        })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchConversations();
        setCurrentAppTab('messages');
        handleOpenConversation(data.id);
      }
    } catch (err) { }
  };

  const openProfileEditor = () => {
    setEditFirstName(auth.profile?.firstName || '');
    setEditLastName(auth.profile?.lastName || '');
    setEditHeadline(auth.profile?.headline || '');
    setEditLocation(auth.profile?.location || '');
    setEditBio(auth.profile?.bio || '');
    setIsEditProfileOpen(true);
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
    setNotifCount(0);
    showToast('All alerts read', 'success');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Toast notifications */}
      <div className="toast-container" id="toastContainer">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠️' : 'ℹ'}</span>
            {toast.msg}
          </div>
        ))}
      </div>

      {/* 1. AUTH PAGES LAYOUT */}
      {currentPage !== 'app' && (
        <div className="auth-shell">

          {/* Left Decorative Branding Hero */}
          <div className="auth-hero">
            <div className="auth-logo" style={{ color: '#fff', fontSize: '1.4rem', marginBottom: '2rem' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontFamily: 'var(--font-serif)' }}>C</span>
              ConnectPro
            </div>
            <h1>Where professionals build the future together.</h1>
            <p>Join 900 million professionals on the platform trusted by industry leaders, innovators, and teams worldwide.</p>
            <div className="auth-stats">
              <div><span className="auth-stat-val">900M+</span><span className="auth-stat-label">Members</span></div>
              <div><span className="auth-stat-val">58M+</span><span className="auth-stat-label">Companies</span></div>
              <div><span className="auth-stat-val">150+</span><span className="auth-stat-label">Countries</span></div>
            </div>
          </div>

          {/* Right Interactive Form Panel */}
          <div className="auth-form-panel" style={{ overflowY: 'auto' }}>

            {/* LOGIN PANEL */}
            {currentPage === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="auth-logo">
                  <span style={{ fontFamily: 'var(--font-serif)' }}>C</span>
                  ConnectPro
                </div>
                <h2 className="auth-title">Welcome back</h2>
                <p className="auth-subtitle">Sign in to your professional network</p>

                <div className="oauth-row">
                  <button type="button" className="oauth-btn" onClick={() => showToast('Connecting to Google…', 'info')}>
                    <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    Continue with Google
                  </button>
                  <button type="button" className="oauth-btn" onClick={() => showToast('Connecting to GitHub…', 'info')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                    Continue with GitHub
                  </button>
                </div>

                <div className="auth-divider">or sign in with email</div>

                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="you@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Password
                    <a onClick={() => {
                      setForgotEmail(email);
                      setForgotNewPassword('');
                      setForgotConfirmPassword('');
                      setIsForgotModalOpen(true);
                    }} style={{ fontSize: '.78rem', textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}>Forgot password?</a>
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block btn-lg mt-3">Sign in</button>

                <div className="auth-switch">
                  Don't have an account? <a onClick={() => setCurrentPage('register')}>Create one — it's free</a>
                </div>
              </form>
            )}

            {/* REGISTER PANEL */}
            {currentPage === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="auth-logo">
                  <span style={{ fontFamily: 'var(--font-serif)' }}>C</span>
                  ConnectPro
                </div>
                <h2 className="auth-title">Create your account</h2>
                <p className="auth-subtitle">Join the world's largest professional network</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">First name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Alex"
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Morgan"
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="alex@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="8+ characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Job title</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Senior Product Designer"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="San Francisco, CA"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '.5rem' }}>Create account</button>
                <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '.75rem' }}>
                  By creating an account, you agree to ConnectPro's <a>Terms</a> and <a>Privacy Policy</a>.
                </p>
                <div className="auth-switch">
                  Already on ConnectPro? <a onClick={() => setCurrentPage('login')}>Sign in</a>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD PANEL */}
            {currentPage === 'forgot' && (
              <div>
                <div className="auth-logo">
                  <span style={{ fontFamily: 'var(--font-serif)' }}>C</span>
                  ConnectPro
                </div>
                <h2 className="auth-title">Forgot your password?</h2>
                <p className="auth-subtitle">Enter your email and we'll send a reset link.</p>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input type="email" className="form-control" placeholder="you@company.com" />
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    showToast('Reset link sent! Check your email.', 'success');
                    setCurrentPage('login');
                  }}
                >
                  Send reset link
                </button>
                <div className="auth-switch mt-3">
                  <a onClick={() => setCurrentPage('login')}>← Back to sign in</a>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 2. MAIN APP SHELL */}
      {currentPage === 'app' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>

          {/* Navigation */}
          <nav className="app-nav">
            <div className="nav-logo" onClick={() => setCurrentAppTab('feed')} style={{ cursor: 'pointer' }}>
              <span className="nav-logo-icon" style={{ fontFamily: 'var(--font-serif)' }}>C</span>
              ConnectPro
            </div>
            <div className="nav-search">
              <span className="nav-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSearch(e as any);
                    setCurrentAppTab('search');
                  }
                }}
              />
            </div>
            <nav className="nav-links">
              <div
                className={`nav-link ${currentAppTab === 'feed' ? 'active' : ''}`}
                onClick={() => setCurrentAppTab('feed')}
              >
                <span style={{ fontSize: '1.2rem' }}>🏠</span>
                <span>Feed</span>
              </div>
              <div
                className={`nav-link ${currentAppTab === 'connections' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentAppTab('connections');
                  fetchConnections();
                  fetchSuggestions();
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>👥</span>
                <span>Network</span>
                {pendingRequests.length > 0 && <span className="badge">{pendingRequests.length}</span>}
              </div>
              <div
                className={`nav-link ${currentAppTab === 'messages' ? 'active' : ''}`}
                onClick={() => {
                  setCurrentAppTab('messages');
                  fetchConversations();
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>💬</span>
                <span>Messages</span>
                <span className="badge">5</span>
              </div>
              <div
                className={`nav-link ${currentAppTab === 'groups' ? 'active' : ''}`}
                onClick={() => setCurrentAppTab('groups')}
              >
                <span style={{ fontSize: '1.2rem' }}>🏛️</span>
                <span>Groups</span>
              </div>
              <div
                className={`nav-link ${notifOpen ? 'active' : ''}`}
                onClick={() => setNotifOpen(!notifOpen)}
              >
                <span style={{ fontSize: '1.2rem' }}>🔔</span>
                <span>Alerts</span>
                {notifCount > 0 && <span className="badge">{notifCount}</span>}
              </div>
              {(auth.user?.role === 'ADMIN' || auth.user?.role === 'SUPER_ADMIN') && (
                <>
                  <div
                    className={`nav-link ${currentAppTab === 'admin' ? 'active' : ''}`}
                    onClick={() => setCurrentAppTab('admin')}
                  >
                    <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                    <span>Admin</span>
                  </div>
                  <div
                    className={`nav-link ${currentAppTab === 'logs' ? 'active' : ''}`}
                    onClick={() => setCurrentAppTab('logs')}
                  >
                    <span style={{ fontSize: '1.2rem' }}>📜</span>
                    <span>Logs</span>
                  </div>
                </>
              )}
              {auth.user?.role === 'SUPER_ADMIN' && (
                <div
                  className={`nav-link ${currentAppTab === 'superadmin' ? 'active' : ''}`}
                  onClick={() => setCurrentAppTab('superadmin')}
                  style={currentAppTab === 'superadmin' ? { color: '#f59e0b' } : { color: '#f59e0b', opacity: 0.85 }}
                >
                  <span style={{ fontSize: '1.2rem' }}>👑</span>
                  <span>Super Admin</span>
                </div>
              )}
              <div
                className={`nav-avatar-btn ${currentAppTab === 'profile' ? 'active' : ''}`}
                onClick={() => setCurrentAppTab('profile')}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '.75rem' }}>
                  {auth.profile?.firstName ? `${auth.profile.firstName.charAt(0)}${auth.profile.lastName ? auth.profile.lastName.charAt(0) : ''}` : 'Me'}
                </div>
                <span>Me</span>
              </div>
              <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ color: 'var(--danger)', fontSize: '.78rem' }}>Sign out</button>
            </nav>
          </nav>

          {/* Notifications Panel */}
          <div className={`notif-panel ${notifOpen ? 'open' : ''}`}>
            <div className="notif-header">
              <h3>Notifications</h3>
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
            </div>
            <div>
              {notifications.map(n => (
                <div
                  key={n.id}
                  className={`notif-item ${n.unread ? 'unread' : ''}`}
                  onClick={() => {
                    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, unread: false } : item));
                    setNotifCount(c => Math.max(0, c - 1));
                  }}
                >
                  <div className="notif-avatar">
                    {n.actor.split(' ').map(x => x[0]).join('')}
                  </div>
                  <div className="notif-text">
                    <strong>{n.actor}</strong> {n.text}
                    <div className="notif-time">{n.time}</div>
                  </div>
                  {n.unread && <div className="notif-dot" />}
                </div>
              ))}
              {notifications.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No notifications yet.
                </div>
              )}
            </div>
          </div>

          {/* MAIN PAGE CONTENT SWITCH */}
          <main style={{ flex: 1 }}>

            {/* TAB CONTENT: Feed */}
            {currentAppTab === 'feed' && (
              <div className="main-layout">
                {/* Left Profile Sidebar Card */}
                <div className="sidebar-col">
                  <div className="sidebar-card">
                    <div className="profile-sidebar-banner" />
                    <div className="profile-sidebar-body">
                      <div className="profile-sidebar-avatar">
                        {auth.profile?.firstName ? `${auth.profile.firstName.charAt(0)}${auth.profile.lastName ? auth.profile.lastName.charAt(0) : ''}` : 'CP'}
                      </div>
                      <h3 className="profile-sidebar-name" onClick={() => setCurrentAppTab('profile')} style={{ cursor: 'pointer' }}>
                        {auth.profile ? `${auth.profile.firstName} ${auth.profile.lastName || ''}`.trim() : 'Guest Member'}
                      </h3>
                      <p className="profile-sidebar-title">{auth.profile?.headline || 'ConnectPro Member'}</p>
                      <div className="sidebar-divider" />
                      <div className="sidebar-stat">
                        <span>Profile views</span>
                        <span>284</span>
                      </div>
                      <div className="sidebar-stat">
                        <span>Connections</span>
                        <span>{connectionsList.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Feed Stream */}
                <div className="feed-col">
                  {/* Post composer panel */}
                  <div className="post-composer">
                    <div className="composer-row">
                      <div className="composer-avatar">
                        {auth.profile?.firstName ? `${auth.profile.firstName.charAt(0)}${auth.profile.lastName ? auth.profile.lastName.charAt(0) : ''}` : 'CP'}
                      </div>
                      <button
                        onClick={() => setIsPostModalOpen(true)}
                        className="composer-input"
                      >
                        Share an update, tech token, or project milestone...
                      </button>
                    </div>
                    <div className="composer-actions">
                      <div className="composer-action" onClick={() => setIsPostModalOpen(true)}>📷 Photo</div>
                      <div className="composer-action" onClick={() => setIsPostModalOpen(true)}>🎥 Video</div>
                      <div className="composer-action" onClick={() => setIsPostModalOpen(true)}>💼 Job</div>
                      <div className="composer-action" onClick={() => setIsPostModalOpen(true)}>📝 Write article</div>
                    </div>
                  </div>

                  {/* Feed stream list */}
                  {feed.posts.length === 0 ? (
                    <div className="post-card" style={{ padding: '4rem', textAlign: 'center' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Your network timeline is currently quiet.</p>
                      <button onClick={fetchFeed} className="btn btn-primary btn-sm mt-3">Refresh Feed</button>
                    </div>
                  ) : (
                    feed.posts.map(post => {
                      const isLiked = post.likes?.includes(auth.user?.id || '');
                      return (
                        <div key={post.id} className="post-card">
                          {/* Header metadata */}
                          <div className="post-header">
                            <div className="post-avatar">
                              {post.authorName ? post.authorName.split(' ').map(x => x[0]).join('') : 'C'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="post-author-name hover:underline cursor-pointer">{post.authorName}</div>
                              <div className="post-author-meta">{post.authorHeadline}</div>
                              <div className="post-author-meta">Just now</div>
                            </div>
                            <div className="post-menu">•••</div>
                          </div>

                          {/* Content text */}
                          <div className="post-body">
                            {post.content}
                          </div>

                          {/* Media item preview */}
                          {post.mediaUrl && (
                            <img src={post.mediaUrl} alt="Post media" className="post-image" />
                          )}

                          {/* Likes & Comments Counters */}
                          <div className="post-reactions">
                            <span>👍 {post.likesCount || 0} likes</span>
                            <span>💬 {post.comments ? post.comments.length : 0} comments</span>
                          </div>

                          {/* Fast actions controls */}
                          <div className="post-actions">
                            <div
                              className={`post-action ${isLiked ? 'liked' : ''}`}
                              onClick={() => handleLike(post.id)}
                            >
                              👍 Like
                            </div>
                            <div className="post-action">
                              💬 Comment
                            </div>
                            <div className="post-action" onClick={() => showToast('Reposted!', 'success')}>
                              🔁 Repost
                            </div>
                            <div className="post-action" onClick={() => showToast('Shared link!', 'info')}>
                              ↗ Share
                            </div>
                          </div>

                          {/* Comments listing */}
                          <div style={{ padding: '1rem', background: 'var(--surface2)', borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <input
                                type="text"
                                value={commentInputs[post.id] || ''}
                                onChange={e => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="Add a comment..."
                                className="form-control"
                                style={{ fontSize: '0.82rem' }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleComment(post.id);
                                }}
                              />
                              <button onClick={() => handleComment(post.id)} className="btn btn-primary btn-sm">Post</button>
                            </div>

                            {post.comments && post.comments.map(c => (
                              <div key={c.id} style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'flex-start' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0 }}>
                                  U
                                </div>
                                <div style={{ background: 'var(--surface)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', flex: 1, border: '1px solid var(--border)' }}>
                                  <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>Network Member</div>
                                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{c.content}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right sidebar */}
                <div className="right-col">
                  {/* Suggestions Widget */}
                  <div className="widget-card">
                    <div className="widget-title">People you may know</div>
                    {suggestions.slice(0, 3).map(sug => (
                      <div key={sug.userId} className="suggestion-item">
                        <div className="suggestion-avatar">
                          {sug.firstName[0]}{sug.lastName[0]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="suggestion-name">{sug.firstName} {sug.lastName}</div>
                          <div className="suggestion-meta" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{sug.headline}</div>
                        </div>
                        <button
                          onClick={() => handleSendConnectionInvite(sug.userId)}
                          className="connect-btn"
                        >
                          + Connect
                        </button>
                      </div>
                    ))}
                    {suggestions.length === 0 && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>No suggestions available</p>
                    )}
                  </div>

                  {/* Trending Widget */}
                  <div className="widget-card">
                    <div className="widget-title">Trending topics</div>
                    <div className="trend-item">
                      <div className="trend-label">Trending in Technology</div>
                      <div className="trend-text" onClick={() => showToast('Searching #OpenSourceAI…', 'info')}>#OpenSourceAI</div>
                      <div className="trend-count">12.4k posts this week</div>
                    </div>
                    <div className="trend-item">
                      <div className="trend-label">Trending in Design</div>
                      <div className="trend-text" onClick={() => showToast('Searching #AgenticDesign…', 'info')}>#AgenticDesign</div>
                      <div className="trend-count">4.8k posts</div>
                    </div>
                    <div className="trend-item">
                      <div className="trend-label">Trending in Leadership</div>
                      <div className="trend-text" onClick={() => showToast('Searching #RemoteFirst…', 'info')}>#RemoteFirst</div>
                      <div className="trend-count">8.1k posts</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Connections/Network */}
            {currentAppTab === 'connections' && (
              <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.25rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h1 style={{ fontSize: '1.3rem', fontWeight: 705 }}>My Network</h1>
                  <button className="btn btn-primary btn-sm" onClick={() => setCurrentAppTab('search')}>🔍 Discover people</button>
                </div>

                <div className="tabs">
                  <div className={`tab ${networkTab === 'connections' ? 'active' : ''}`} onClick={() => setNetworkTab('connections')}>Connections ({connectionsList.length})</div>
                  <div className={`tab ${networkTab === 'requests' ? 'active' : ''}`} onClick={() => setNetworkTab('requests')}>Pending requests ({pendingRequests.length})</div>
                  <div className={`tab ${networkTab === 'suggestions' ? 'active' : ''}`} onClick={() => setNetworkTab('suggestions')}>Suggestions</div>
                </div>

                {networkTab === 'connections' && (
                  <div>
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <input className="form-control" style={{ maxWidth: '300px', fontSize: '0.85rem' }} placeholder="Search connections..." />
                    </div>
                    <div className="connections-grid">
                      {connectionsList.map(conn => (
                        <div key={conn.userId} className="connection-card">
                          <div className="connection-banner"></div>
                          <div className="connection-body">
                            <div className="connection-avatar">
                              {conn.firstName ? conn.firstName[0] : ''}{conn.lastName ? conn.lastName[0] : ''}
                            </div>
                            <div className="connection-name">{conn.firstName || 'ConnectPro'} {conn.lastName || 'Member'}</div>
                            <div className="connection-title">{conn.headline || 'Professional Member'}</div>
                            <div className="connection-mutual">
                              {(() => {
                                let hash = 0;
                                const idStr = conn.userId || '';
                                for (let i = 0; i < idStr.length; i++) {
                                  hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
                                }
                                return (Math.abs(hash) % 18) + 2;
                              })()} mutual connections
                            </div>
                            <div className="connection-actions">
                              <button className="btn btn-outline btn-sm" onClick={() => handleDirectDM(conn.userId)}>💬</button>
                              <button className="btn btn-primary btn-sm" onClick={() => showToast(`Viewing profile of ${conn.firstName}`, 'info')}>View</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => showToast('More options', 'info')}>•••</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {connectionsList.length === 0 && (
                        <div style={{ gridColumn: '1 / -1', padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <p style={{ fontSize: '1rem', fontWeight: 600 }}>No active connections found.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {networkTab === 'requests' && (
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-secondary)' }}>Pending connection requests</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: '480px' }}>
                      {pendingRequests.map(req => (
                        <div key={req.userId} style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'var(--primary)', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem' }}>
                            {req.firstName ? `${req.firstName[0]}${req.lastName?.[0] || ''}` : (req.userId?.substring(0, 2)?.toUpperCase() || '?')}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {req.firstName && req.lastName ? `${req.firstName} ${req.lastName}` : req.firstName || req.lastName || 'ConnectPro Member'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{req.headline || 'Professional on ConnectPro'}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Wants to connect with you</div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleAcceptConnection(req.userId)}>Accept</button>
                            <button className="btn btn-outline btn-sm" onClick={() => showToast('Request ignored')}>Ignore</button>
                          </div>
                        </div>
                      ))}
                      {pendingRequests.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', padding: '2rem 0' }}>No pending connection requests found.</p>
                      )}
                    </div>
                  </div>
                )}

                {networkTab === 'suggestions' && (
                  <div className="connections-grid">
                    {suggestions.map(sug => (
                      <div key={sug.userId} className="connection-card">
                        <div className="connection-banner"></div>
                        <div className="connection-body">
                          <div className="connection-avatar">
                            {sug.firstName[0]}{sug.lastName[0]}
                          </div>
                          <div className="connection-name">{sug.firstName} {sug.lastName}</div>
                          <div className="connection-title">{sug.headline}</div>
                          <div className="connection-mutual">8 mutual connections</div>
                          <div className="connection-actions">
                            <button className="btn btn-primary btn-sm btn-block" onClick={() => handleSendConnectionInvite(sug.userId)}>+ Connect</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {suggestions.length === 0 && (
                      <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>No recommendations found.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Chat / Messages */}
            {currentAppTab === 'messages' && (
              <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.25rem 1rem' }}>
                <div className="msg-layout">
                  {/* Left Conversation List */}
                  <div className="msg-list">
                    <div className="msg-list-header">
                      <h2>Messages</h2>
                      <input
                        className="form-control"
                        style={{ fontSize: '0.82rem' }}
                        placeholder="Search conversations..."
                      />
                    </div>
                    {chat.conversations.map(conv => (
                      <div
                        key={conv.id}
                        onClick={() => handleOpenConversation(conv.id)}
                        className={`conv-item ${chat.activeConversationId === conv.id ? 'active' : ''}`}
                      >
                        <div className="conv-avatar">
                          {conv.otherUser?.firstName ? `${conv.otherUser.firstName[0]}${conv.otherUser.lastName[0]}` : 'CP'}
                          <div className="conv-online" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="conv-name">
                            {conv.isGroup ? conv.groupName : `${conv.otherUser?.firstName} ${conv.otherUser?.lastName}`}
                          </div>
                          <div className="conv-preview">{conv.lastMessageText || 'No messages yet'}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                          <div className="conv-time">Just now</div>
                        </div>
                      </div>
                    ))}
                    {chat.conversations.length === 0 && (
                      <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No conversations yet.</p>
                    )}
                  </div>

                  {/* Right Chat Area */}
                  <div className="chat-area">
                    {chat.activeConversationId ? (
                      <>
                        <div className="chat-header">
                          <div className="conv-avatar" style={{ width: '38px', height: '38px', fontSize: '0.8rem' }}>
                            {chat.conversations.find(c => c.id === chat.activeConversationId)?.otherUser?.firstName?.substring(0, 1) || 'C'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {chat.conversations.find(c => c.id === chat.activeConversationId)?.isGroup ?
                                chat.conversations.find(c => c.id === chat.activeConversationId)?.groupName :
                                `${chat.conversations.find(c => c.id === chat.activeConversationId)?.otherUser?.firstName} ${chat.conversations.find(c => c.id === chat.activeConversationId)?.otherUser?.lastName}`
                              }
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>● Active now</div>
                          </div>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => showToast('Calling…', 'info')}>📞</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => showToast('Video call…', 'info')}>📹</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => showToast('More options', 'info')}>•••</button>
                          </div>
                        </div>

                        <div className="chat-messages">
                          {(chat.messages[chat.activeConversationId] || []).map(msg => {
                            const isMe = msg.senderId === auth.user?.id;
                            return (
                              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                                <div className={`chat-bubble ${isMe ? 'me' : 'them'}`}>
                                  {msg.content}
                                </div>
                                <div className={`chat-meta ${isMe ? 'me' : ''}`}>
                                  {isMe ? '10:44 AM · ✓✓ Read' : 'Just now'}
                                </div>
                              </div>
                            );
                          })}

                          {/* Typing indicator */}
                          {(() => {
                            const activeConv = chat.conversations.find(c => c.id === chat.activeConversationId);
                            const otherPartId = activeConv?.otherUser?.userId || '';
                            const isTypingActive = chat.typingStatus[chat.activeConversationId || '']?.[otherPartId];
                            if (isTypingActive) {
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.2rem 0' }}>
                                  <div className="conv-avatar" style={{ width: '28px', height: '28px', fontSize: '0.65rem' }}>T</div>
                                  <div className="typing-indicator" style={{ backgroundColor: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '4px 18px 18px 18px', padding: '0.45rem 0.85rem' }}>
                                    <div className="typing-dot"></div>
                                    <div className="typing-dot"></div>
                                    <div className="typing-dot"></div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          <div ref={messagesEndRef} />
                        </div>

                        <div className="chat-input-row">
                          <button className="btn btn-ghost" style={{ fontSize: '1.1rem' }} onClick={() => showToast('Attach file', 'info')}>📎</button>
                          <button className="btn btn-ghost" style={{ fontSize: '1.1rem' }} onClick={() => showToast('Share image', 'info')}>🖼️</button>
                          <input
                            className="chat-input"
                            placeholder="Write a message..."
                            value={typedMessage}
                            onChange={handleTyping}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSendChatMessage();
                            }}
                          />
                          <button className="btn btn-ghost" style={{ fontSize: '1.1rem' }} onClick={() => showToast('Voice note', 'info')}>🎤</button>
                          <button className="chat-send" onClick={handleSendChatMessage}>➤</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        <span style={{ fontSize: '3rem' }}>💬</span>
                        <p style={{ fontWeight: 650, marginTop: '1rem' }}>Select a conversation thread to begin live chats.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: Groups */}
            {currentAppTab === 'groups' && (
              <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.25rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h1 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Groups</h1>
                  <button className="btn btn-primary btn-sm" onClick={() => setIsGroupModalOpen(true)}>+ Create group</button>
                </div>
                <div className="groups-grid">
                  {myGroups.map(grp => (
                    <div key={grp.id} className="group-card">
                      <div className="group-banner" style={{ background: 'linear-gradient(135deg,#7C3AED,#5B3EA8)', color: '#fff', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px' }}>
                        {grp.avatar || '🎨'}
                      </div>
                      <div className="group-body">
                        <div className="group-name">{grp.name}</div>
                        <div className="group-desc">{grp.desc}</div>
                        <div className="group-meta">
                          <span>👥 {grp.members} members</span>
                          <span>🔒 {grp.type}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                          <button
                            type="button"
                            onClick={() => showToast(`Opening group workspace: ${grp.name}`, 'info')}
                            className="btn btn-primary btn-sm"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMyGroups(prev => prev.filter(g => g.id !== grp.id));
                              showToast(`Left group ${grp.name}`, 'success');
                            }}
                            className="btn btn-outline btn-sm"
                          >
                            Leave
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: User Profile */}
            {currentAppTab === 'profile' && (
              <div className="main-layout wide">
                <div className="profile-main-card">
                  <div className="profile-cover">
                    <button className="btn btn-outline btn-sm profile-cover-edit" style={{ backgroundColor: 'rgba(255,255,255,.85)' }} onClick={() => showToast('Cover photo updated!', 'success')}>
                      📷 Edit cover
                    </button>
                  </div>
                  <div className="profile-info-section">
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
                      <div className="profile-avatar-large">
                        {auth.profile?.firstName ? `${auth.profile.firstName.charAt(0)}${auth.profile.lastName ? auth.profile.lastName.charAt(0) : ''}` : 'Me'}
                      </div>
                      <div style={{ paddingBottom: '0.5rem', flex: 1 }}>
                        <div className="profile-name">{auth.profile ? `${auth.profile.firstName} ${auth.profile.lastName || ''}`.trim() : 'Guest Member'}</div>
                        <div className="profile-headline">{auth.profile?.headline || 'ConnectPro Member'}</div>
                        <div className="profile-location">
                          📍 {auth.profile?.location || 'Add location'} · <a onClick={() => setCurrentAppTab('connections')}>{connectionsList.length > 0 ? connectionsList.length : '0'} connections</a>
                        </div>
                      </div>
                      <div style={{ paddingBottom: '0.5rem' }}>
                        <button className="btn btn-outline btn-sm" onClick={openProfileEditor}>✏️ Edit profile</button>
                      </div>
                    </div>
                    <div className="profile-stats-row">
                      <div className="profile-stat"><span className="profile-stat-val">{connectionsList.length || '842'}</span> connections</div>
                      <div className="profile-stat"><span className="profile-stat-val">1.2k</span> followers</div>
                      <div className="profile-stat"><span className="profile-stat-val">{feed.posts.filter(p => p.authorName === `${auth.profile?.firstName} ${auth.profile?.lastName}`).length || '48'}</span> posts</div>
                      <div className="profile-stat"><span className="profile-stat-val">284</span> profile views this week</div>
                    </div>
                    <div className="profile-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => setCurrentAppTab('messages')}>💬 Message</button>
                      <button className="btn btn-outline btn-sm" onClick={() => showToast('Following profile!', 'success')}>+ Follow</button>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        navigator.clipboard.writeText(auth.user?.id || '');
                        showToast('Profile ID copied!', 'success');
                      }}>🔗 Share ID</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => showToast('More options', 'info')}>•••</button>
                    </div>
                  </div>
                </div>

                {/* About Section */}
                <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-3">
                  <h3 className="font-extrabold text-slate-850 dark:text-white text-sm tracking-wide uppercase">About</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-350 leading-relaxed font-light whitespace-pre-wrap">
                    {auth.profile?.bio || "Describe your background, skills, and product achievements here."}
                  </p>
                </div>

                {/* Experience section */}
                <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-850 dark:text-white text-sm tracking-wide uppercase">Experience</h3>
                    <button className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline" onClick={openProfileEditor}>+ Add</button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-xs flex-shrink-0 shadow-inner">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-850 dark:text-white text-sm">Senior Product Designer</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 font-medium">Acme Corporation · Full-time</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Jan 2023 - Present · 2 yrs 5 id</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-xs flex-shrink-0 shadow-inner">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-850 dark:text-white text-sm">Product Designer II</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 font-medium">Figma · Full-time</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Jun 2020 - Dec 2022</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Education section */}
                <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-850 dark:text-white text-sm tracking-wide uppercase font-serif">Education</h3>
                    <button className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline" onClick={openProfileEditor}>+ Add</button>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center flex-shrink-0 shadow-inner">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-850 dark:text-white text-sm">B.S. Human-Computer Interaction</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5">UC Berkeley</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">2014 - 2018</p>
                    </div>
                  </div>
                </div>

                {/* Skills section */}
                <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-extrabold text-slate-850 dark:text-white text-sm tracking-wide uppercase font-serif">Skills</h3>
                    <button className="text-blue-600 dark:text-blue-400 text-xs font-bold hover:underline" onClick={openProfileEditor}>+ Add</button>
                  </div>
                  <div>
                    {auth.profile?.skills && auth.profile.skills.length > 0 ? (
                      auth.profile.skills.map(skill => (
                        <span key={skill.id} className="skill-chip">
                          {skill.name}
                        </span>
                      ))
                    ) : (
                      <>
                        <span className="skill-chip">🎨 Figma</span>
                        <span className="skill-chip">📐 Design Systems</span>
                        <span className="skill-chip">🔬 User Research</span>
                        <span className="skill-chip">🤝 Product Strategy</span>
                        <span className="skill-chip">📊 Data-driven Design</span>
                        <span className="skill-chip">🧪 Prototyping</span>
                        <span className="skill-chip">🎭 Motion Design</span>
                        <span className="skill-chip">♿ Accessibility</span>
                        <span className="skill-chip">📱 Mobile Design</span>
                        <span className="skill-chip">💬 Team Leadership</span>
                      </>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: Search */}
            {currentAppTab === 'search' && (
              <div className="md:col-span-4 bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Search by Username</h2>
                  <p className="text-xs text-slate-450 mt-1">Find users by their unique username, first name, or last name.</p>
                </div>

                {/* Search input bar */}
                <form onSubmit={(e) => { handleSearch(e); }} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Enter username (e.g. sophia.reyes)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, fontSize: '0.85rem' }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm">🔍 Search</button>
                </form>

                <div className="space-y-4">
                  {searchPeople.map(person => {
                    const isSent = requestSentIds.has(person.userId);
                    const isMe = person.userId === auth.user?.id;
                    return (
                      <div key={person.userId} className="flex gap-4 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm items-start justify-between bg-slate-50/20 dark:bg-slate-900/20 hover:scale-[1.005] transition-transform">
                        <div className="flex gap-4">
                          <div className="w-14 h-14 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xl shadow-md border-2 border-white dark:border-slate-900">
                            {person.firstName[0]}{person.lastName[0]}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-white text-base">{person.firstName} {person.lastName}</h4>
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">@{person.username || 'username'}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-450 mt-0.5 leading-snug">{person.headline}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">📍 {person.location || 'Not specified'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!isMe && (
                            <>
                              <button
                                onClick={() => handleDirectDM(person.userId)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-3.5 py-2 rounded-lg shadow"
                              >
                                💬 Message
                              </button>
                              <button
                                onClick={() => {
                                  if (!isSent) {
                                    handleSendConnectionInvite(person.userId);
                                    setRequestSentIds(prev => new Set(prev).add(person.userId));
                                  }
                                }}
                                disabled={isSent}
                                className={isSent
                                  ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] px-3 py-2 rounded-lg cursor-default'
                                  : 'border border-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] px-3 py-2 rounded-lg font-bold'
                                }
                              >
                                {isSent ? '✓ Request Sent' : '+ Send Request'}
                              </button>
                            </>
                          )}
                          {isMe && (
                            <span className="text-xs text-slate-400 italic">This is you</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {searchPeople.length === 0 && (
                    <p className="text-slate-400 text-xs text-center py-12">Search for users by their username, first name, or last name using the search box above.</p>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: Admin Panel */}
            {currentAppTab === 'admin' && (
              <div className="md:col-span-4 bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Admin Operations</h2>
                  <p className="text-xs text-slate-450 mt-1">Platform analytics and users list.</p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/30 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-black text-blue-650 dark:text-blue-400">2.4M</span>
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-widest mt-1 block">Total users</span>
                  </div>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/30 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-black text-emerald-660 dark:text-emerald-450">1.8M</span>
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-widest mt-1 block">Active users</span>
                  </div>
                  <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/30 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-black text-amber-600 dark:text-amber-450">94.2k</span>
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-widest mt-1 block">Weekly posts</span>
                  </div>
                  <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-100/30 rounded-2xl p-4 text-center shadow-sm">
                    <span className="block text-2xl font-black text-red-600 dark:text-red-400">247</span>
                    <span className="text-[9px] text-slate-450 uppercase font-bold tracking-widest mt-1 block">Reports queue</span>
                  </div>
                </div>

                {/* Visual Analytics Rows */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }} className="admin-analytics-grid">
                  <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-extrabold text-slate-850 dark:text-white text-sm tracking-wide uppercase mb-4">User growth by role</h3>
                    <div style={{ padding: '.25rem 0' }}>
                      <div className="chart-bar-row">
                        <div className="chart-bar-label">Regular</div>
                        <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: '88%', background: 'var(--primary)' }}></div></div>
                        <div className="chart-bar-val">2.1M</div>
                      </div>
                      <div className="chart-bar-row">
                        <div className="chart-bar-label">Premium</div>
                        <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: '22%', background: '#7C3AED' }}></div></div>
                        <div className="chart-bar-val">286k</div>
                      </div>
                      <div className="chart-bar-row">
                        <div className="chart-bar-label">Recruiters</div>
                        <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: '8%', background: '#059669' }}></div></div>
                        <div className="chart-bar-val">38k</div>
                      </div>
                      <div className="chart-bar-row">
                        <div className="chart-bar-label">Admins</div>
                        <div className="chart-bar-track"><div className="chart-bar-fill" style={{ width: '1%', background: '#DC2626' }}></div></div>
                        <div className="chart-bar-val">142</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/50 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="font-extrabold text-slate-850 dark:text-white text-sm tracking-wide uppercase mb-4">Content moderation queue</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .75rem', background: 'var(--danger-light)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--danger)' }}>🚩 Reported posts</span>
                        <span style={{ fontWeight: 700, color: 'var(--danger)' }}>84</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .75rem', background: 'var(--accent-light)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '.85rem', fontWeight: 600, color: '#8B6000' }}>⚠️ Spam accounts</span>
                        <span style={{ fontWeight: 700, color: '#8B6000' }}>163</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .75rem', background: 'var(--primary-light)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--primary)' }}>📋 Pending approvals</span>
                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>29</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.5rem .75rem', background: 'var(--success-light)', borderRadius: 'var(--radius-md)' }}>
                        <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--success)' }}>✅ Resolved today</span>
                        <span style={{ fontWeight: 700, color: 'var(--success)' }}>412</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Users List */}
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-450">
                        <th className="p-3">User info</th>
                        <th className="p-3">Role</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-100 dark:border-slate-800">
                        <td className="p-3">
                          <strong className="font-extrabold text-slate-800 dark:text-white block text-xs">Sophia Reyes</strong>
                          <span className="text-slate-400 dark:text-slate-500">sophia@stripe.com</span>
                        </td>
                        <td className="p-3"><span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded font-bold">Premium</span></td>
                        <td className="p-3"><span className="bg-emerald-150 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">Active</span></td>
                        <td className="p-3">
                          <button onClick={() => showToast('Editing user credentials...', 'info')} className="text-blue-600 font-bold hover:underline mr-3">Edit</button>
                          <button onClick={() => showToast('User account suspended', 'success')} className="text-red-650 font-bold hover:underline">Suspend</button>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-3">
                          <strong className="font-extrabold text-slate-800 dark:text-white block text-xs">James Kim</strong>
                          <span className="text-slate-400 dark:text-slate-500">james@novatech.io</span>
                        </td>
                        <td className="p-3"><span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-bold">User</span></td>
                        <td className="p-3"><span className="bg-emerald-150 text-emerald-700 dark:text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">Active</span></td>
                        <td className="p-3">
                          <button onClick={() => showToast('Editing user credentials...', 'info')} className="text-blue-600 font-bold hover:underline mr-3">Edit</button>
                          <button onClick={() => showToast('User account suspended', 'success')} className="text-red-650 font-bold hover:underline">Suspend</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

              </div>
            )}

            {/* TAB CONTENT: Super Admin User Management */}
            {currentAppTab === 'superadmin' && (
              <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem 1rem' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>👑</span> Super Admin Console
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Full platform control — manage users, roles, and account status</p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={fetchAdminUsers}
                    disabled={adminUsersLoading}
                  >
                    🔄 {adminUsersLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Total Users', value: adminUsers.length, bg: 'var(--primary-light)', color: 'var(--primary)', icon: '👥' },
                    { label: 'Active', value: adminUsers.filter(u => u.isActive !== false).length, bg: 'var(--success-light)', color: 'var(--success)', icon: '✅' },
                    { label: 'Deactivated', value: adminUsers.filter(u => u.isActive === false).length, bg: 'var(--danger-light)', color: 'var(--danger)', icon: '🚫' },
                    { label: 'Admins', value: adminUsers.filter(u => u.role === 'ADMIN' || u.role === 'SUPER_ADMIN').length, bg: 'rgba(245,158,11,0.12)', color: '#d97706', icon: '🛡️' },
                  ].map(kpi => (
                    <div key={kpi.label} style={{ background: kpi.bg, border: '1px solid rgba(0,0,0,0.06)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{kpi.icon}</div>
                      <div style={{ fontSize: '1.8rem', fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{kpi.label}</div>
                    </div>
                  ))}
                </div>

                {/* Search + Table */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      className="form-control"
                      style={{ maxWidth: '320px', fontSize: '0.83rem' }}
                      placeholder="Search by email or role..."
                      value={adminUsersSearch}
                      onChange={e => setAdminUsersSearch(e.target.value)}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {adminUsers.filter(u => !adminUsersSearch || u.email?.toLowerCase().includes(adminUsersSearch.toLowerCase()) || u.role?.toLowerCase().includes(adminUsersSearch.toLowerCase())).length} users
                    </span>
                  </div>

                  {adminUsersLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
                      <p style={{ fontWeight: 600 }}>Loading users...</p>
                    </div>
                  ) : adminUsers.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
                      <p style={{ fontWeight: 600 }}>No users found</p>
                      <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Click Refresh to load registered users.</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                            {['User', 'Role', 'Connections', 'Status', 'Joined', 'Actions'].map(col => (
                              <th key={col} style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers
                            .filter(u => !adminUsersSearch ||
                              u.email?.toLowerCase().includes(adminUsersSearch.toLowerCase()) ||
                              u.role?.toLowerCase().includes(adminUsersSearch.toLowerCase())
                            )
                            .map((user, idx) => {
                              const isCurrentUser = user.id === auth.user?.id;
                              const roleBg: Record<string, string> = {
                                SUPER_ADMIN: 'rgba(245,158,11,0.15)',
                                ADMIN: 'var(--primary-light)',
                                USER: 'var(--surface2)'
                              };
                              const roleColor: Record<string, string> = {
                                SUPER_ADMIN: '#d97706',
                                ADMIN: 'var(--primary)',
                                USER: 'var(--text-secondary)'
                              };
                              return (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)', background: idx % 2 === 0 ? 'transparent' : 'var(--surface2)', transition: 'background 0.15s' }}>
                                  {/* User */}
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: user.role === 'SUPER_ADMIN' ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'var(--primary)', color: '#fff', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {((user.firstName || '')[0] || '') + ((user.lastName || '')[0] || '') || (user.email || 'U').substring(0, 2).toUpperCase()}
                                      </div>
                                      <div>
                                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : 'No Name'}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{user.email}</div>
                                      </div>
                                      {isCurrentUser && <span style={{ fontSize: '0.65rem', background: 'var(--success-light)', color: 'var(--success)', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px' }}>YOU</span>}
                                    </div>
                                  </td>

                                  {/* Role */}
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <select
                                      value={user.role}
                                      onChange={e => handleUpdateRole(user.id, e.target.value)}
                                      style={{ background: roleBg[user.role] || 'var(--surface2)', color: roleColor[user.role] || 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                                    >
                                      <option value="USER">USER</option>
                                      <option value="ADMIN">ADMIN</option>
                                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                                    </select>
                                  </td>

                                  {/* Connections */}
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <button
                                      onClick={() => handleShowConnections(user)}
                                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', transition: 'all 0.2s' }}
                                    >
                                      <span>🔗</span> {user.connectionCount || 0}
                                    </button>
                                  </td>

                                  {/* Status */}
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, background: user.isActive === false ? 'var(--danger-light)' : 'var(--success-light)', color: user.isActive === false ? 'var(--danger)' : 'var(--success)' }}>
                                      {user.isActive === false ? '🚫 Inactive' : '✅ Active'}
                                    </span>
                                  </td>

                                  {/* Joined */}
                                  <td style={{ padding: '0.85rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                  </td>

                                  {/* Actions */}
                                  <td style={{ padding: '0.85rem 1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                      <button
                                        onClick={() => handleCheckUser(user)}
                                        className="btn btn-sm"
                                        style={{ background: 'rgba(59,130,246,0.12)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.72rem', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-md)', padding: '0.25rem 0.65rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                      >
                                        🔑 Check User
                                      </button>
                                      {user.isActive === false ? (
                                        <button
                                          onClick={() => handleToggleStatus(user.id, true)}
                                          className="btn btn-sm"
                                          style={{ background: 'var(--success-light)', color: 'var(--success)', fontWeight: 700, fontSize: '0.72rem', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '0.25rem 0.65rem', cursor: 'pointer' }}
                                        >
                                          ✅ Activate
                                        </button>
                                      ) : isCurrentUser ? (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Cannot deactivate self</span>
                                      ) : confirmDeactivate === user.id ? (
                                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 600 }}>Confirm?</span>
                                          <button onClick={() => handleToggleStatus(user.id, false)} style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.2rem 0.55rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Yes</button>
                                          <button onClick={() => setConfirmDeactivate(null)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer' }}>No</button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeactivate(user.id)}
                                          className="btn btn-sm"
                                          style={{ background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 700, fontSize: '0.72rem', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', padding: '0.25rem 0.65rem', cursor: 'pointer' }}
                                        >
                                          🚫 Deactivate
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Connections Detail Modal */}
                {showConnectionsModal && selectedUserForConnections && (
                  <div className="modal-overlay open" style={{ zIndex: 1000 }}>
                    <div className="modal max-w-lg">
                      <div className="modal-header">
                        <div className="modal-title">
                          <span>🔗</span> Connections of {selectedUserForConnections.firstName || selectedUserForConnections.lastName ? `${selectedUserForConnections.firstName} ${selectedUserForConnections.lastName}`.trim() : selectedUserForConnections.email}
                        </div>
                        <button onClick={() => setShowConnectionsModal(false)} className="modal-close"><X className="w-4 h-4" /></button>
                      </div>
                      
                      <div className="modal-body">
                        {userConnectionsLoading ? (
                          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Loading connections...</div>
                          </div>
                        ) : userConnections.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No connections found.</div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {userConnections.map(conn => (
                              <div key={conn.userId} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary-light), var(--primary))', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>
                                  {(conn.firstName || 'U').substring(0, 1).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                    {conn.firstName || conn.lastName ? `${conn.firstName} ${conn.lastName}`.trim() : 'Unknown User'}
                                  </div>
                                  {(conn.headline || conn.location) && (
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                      {conn.headline}{conn.headline && conn.location && ' • '}{conn.location && <span>📍 {conn.location}</span>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Audit Logs */}
            {currentAppTab === 'logs' && (
              <div className="md:col-span-4 bg-white/95 dark:bg-slate-900/95 border border-slate-250/60 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Audit Transaction Logs</h2>
                    <p className="text-xs text-slate-450 mt-1">Real-time CRUD operation metrics and system logs.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search by action or email..."
                      value={logsSearchQuery}
                      onChange={e => setLogsSearchQuery(e.target.value)}
                      className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-blue-650 w-52"
                    />
                    <button
                      onClick={fetchAuditLogs}
                      className="bg-blue-650 hover:bg-blue-750 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow transition"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs text-slate-800 dark:text-slate-100 font-medium">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-450">
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">User Email</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Details</th>
                          <th className="p-3">IP Address</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logsList
                          .filter(log => {
                            const searchLower = logsSearchQuery.toLowerCase();
                            return (
                              (log.email && log.email.toLowerCase().includes(searchLower)) ||
                              (log.action && log.action.toLowerCase().includes(searchLower)) ||
                              (log.details && log.details.toLowerCase().includes(searchLower))
                            );
                          })
                          .map(log => {
                            let badgeColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                            if (log.action.includes("REGISTER")) badgeColor = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-450";
                            if (log.action.includes("LOGIN")) badgeColor = "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-450";
                            if (log.action.includes("CREATE_POST") || log.action.includes("CREATE_GROUP")) badgeColor = "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400";
                            if (log.action.includes("CONNECTION")) badgeColor = "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-450";
                            if (log.action.includes("MESSAGE")) badgeColor = "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400";

                            return (
                              <tr key={log.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-850/50">
                                <td className="p-3 text-slate-450 dark:text-slate-500 whitespace-nowrap">
                                  {new Date(log.createdAt).toLocaleString()}
                                </td>
                                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                                  {log.email || "System"}
                                </td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded font-bold text-[10px] tracking-wide ${badgeColor}`}>
                                    {log.action}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-350 max-w-sm overflow-hidden text-ellipsis">
                                  {log.details}
                                </td>
                                <td className="p-3 text-slate-450 dark:text-slate-500">
                                  {log.ipAddress || "N/A"}
                                </td>
                              </tr>
                            );
                          })}
                        {logsList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400">
                              No transaction logs recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </main>

          {/* 3. MODALS DIALOGS */}

          {/* Post publishing modal */}
          {isPostModalOpen && (
            <div className="modal-overlay open">
              <div className="modal max-w-lg">
                <div className="modal-header">
                  <div className="modal-title">
                    <span>📝</span> Create post
                  </div>
                  <button onClick={() => setIsPostModalOpen(false)} className="modal-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="modal-body flex flex-col gap-4">
                  <textarea
                    value={postText}
                    onChange={e => setPostText(e.target.value)}
                    placeholder="What's on your mind? Share an insight, token, or project update..."
                    className="form-control h-32"
                  />
                  <input
                    type="text"
                    value={postMedia}
                    onChange={e => setPostMedia(e.target.value)}
                    placeholder="Attach an image URL (optional)..."
                    className="form-control"
                  />
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setIsPostModalOpen(false)} className="btn btn-outline btn-sm">Discard</button>
                    <button onClick={handlePublishPost} className="btn btn-primary btn-sm">Publish</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group creation modal */}
          {isGroupModalOpen && (
            <div className="modal-overlay open">
              <div className="modal max-w-md">
                <div className="modal-header">
                  <div className="modal-title">
                    <span>👥</span> Create a group
                  </div>
                  <button onClick={() => setIsGroupModalOpen(false)} className="modal-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="modal-body space-y-4">
                  <div className="form-group">
                    <label className="form-label">Group name</label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={e => setGroupName(e.target.value)}
                      placeholder="e.g. UX Researchers Community"
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea
                      value={groupDescription}
                      onChange={e => setGroupDescription(e.target.value)}
                      placeholder="Describe what this community is about..."
                      className="form-control h-20 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setIsGroupModalOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
                    <button
                      onClick={() => {
                        if (!groupName) return;
                        setMyGroups(prev => [...prev, {
                          id: Date.now().toString(),
                          name: groupName,
                          desc: groupDescription,
                          members: '1',
                          type: 'Private',
                          avatar: '🎨'
                        }]);
                        postClientAuditLog('CREATE_GROUP', `Created a new collaboration group: "${groupName}".`);
                        setGroupName('');
                        setGroupDescription('');
                        setIsGroupModalOpen(false);
                        showToast('Collaboration Group created!', 'success');
                      }}
                      className="btn btn-primary btn-sm"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Profile Editor Modal */}
          {isEditProfileOpen && (
            <div className="modal-overlay open">
              <div className="modal max-w-lg">
                <div className="modal-header">
                  <div className="modal-title">
                    <span>⚙️</span> Edit profile details
                  </div>
                  <button onClick={() => setIsEditProfileOpen(false)} className="modal-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="modal-body space-y-4" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group">
                      <label className="form-label">First name</label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={e => setEditFirstName(e.target.value)}
                        className="form-control"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last name</label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={e => setEditLastName(e.target.value)}
                        className="form-control"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Headline</label>
                    <input
                      type="text"
                      value={editHeadline}
                      onChange={e => setEditHeadline(e.target.value)}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={e => setEditLocation(e.target.value)}
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">About / Summary</label>
                    <textarea
                      value={editBio}
                      onChange={e => setEditBio(e.target.value)}
                      className="form-control h-24 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setIsEditProfileOpen(false)} className="btn btn-outline btn-sm">Discard</button>
                    <button onClick={handleSaveProfileUpdates} className="btn btn-primary btn-sm">Save changes</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Check User Credentials Modal */}
          {showCheckUserModal && selectedCheckUser && (
            <div className="modal-overlay open">
              <div className="modal max-w-lg">
                <div className="modal-header">
                  <div className="modal-title">
                    <span>👑</span> Check User Details & Credentials
                  </div>
                  <button onClick={() => setShowCheckUserModal(false)} className="modal-close"><X className="w-4 h-4" /></button>
                </div>
                <div className="modal-body space-y-6">
                  {/* Status & Role Badges */}
                  <div className="flex gap-2 items-center flex-wrap pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className={`badge ${selectedCheckUser.role === 'SUPER_ADMIN' ? 'badge-danger' : selectedCheckUser.role === 'ADMIN' ? 'badge-warning' : 'badge-primary'}`}>
                      🛡️ {selectedCheckUser.role}
                    </span>
                    <span className={`badge ${selectedCheckUser.isActive === false ? 'badge-danger' : 'badge-success'}`}>
                      {selectedCheckUser.isActive === false ? '🚫 Deactivated' : '✅ Active'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="credential-grid">
                    <div className="credential-card">
                      <span className="credential-label">Full Name</span>
                      <span className="credential-value">{selectedCheckUser.firstName || selectedCheckUser.lastName ? `${selectedCheckUser.firstName} ${selectedCheckUser.lastName}`.trim() : 'N/A'}</span>
                    </div>

                    <div className="credential-card">
                      <span className="credential-label">Email Address</span>
                      <span className="credential-value font-mono text-xs truncate" title={selectedCheckUser.email}>{selectedCheckUser.email}</span>
                    </div>

                    <div className="credential-card">
                      <span className="credential-label">Headline</span>
                      <span className="credential-value text-xs line-clamp-1" title={selectedCheckUser.headline || 'N/A'}>{selectedCheckUser.headline || 'N/A'}</span>
                    </div>

                    <div className="credential-card">
                      <span className="credential-label">Location</span>
                      <span className="credential-value text-xs">📍 {selectedCheckUser.location || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Sensitive Credentials Blocks */}
                  <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-450 mb-1">Database Credentials</h4>
                    
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">User ID</span>
                      <div className="mono-block">
                        <span className="truncate select-all font-mono">{selectedCheckUser.id}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(selectedCheckUser.id);
                            showToast('Copied User ID!', 'success');
                          }}
                          className="btn-copy"
                          title="Copy ID"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Bcrypt Password Hash</span>
                      <div className="mono-block">
                        <span className="truncate select-all font-mono">{selectedCheckUser.passwordHash || 'N/A'}</span>
                        <button 
                          onClick={() => {
                            if (selectedCheckUser.passwordHash) {
                              navigator.clipboard.writeText(selectedCheckUser.passwordHash);
                              showToast('Copied Password Hash!', 'success');
                            } else {
                              showToast('No hash available to copy', 'warning');
                            }
                          }}
                          className="btn-copy"
                          disabled={!selectedCheckUser.passwordHash}
                          title="Copy Hash"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Reset form */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">Reset User Password Directly</h4>
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={adminNewPassword}
                          onChange={e => setAdminNewPassword(e.target.value)}
                          placeholder="Type new secure password..."
                          className="form-control"
                        />
                      </div>
                      <button
                        onClick={handleAdminResetPassword}
                        disabled={isAdminUpdatingPassword || !adminNewPassword}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold text-xs px-4 py-2 rounded-xl shadow whitespace-nowrap transition disabled:cursor-not-allowed"
                      >
                        {isAdminUpdatingPassword ? 'Updating...' : 'Save Password'}
                      </button>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button onClick={() => setShowCheckUserModal(false)} className="btn btn-outline btn-sm">Close</button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Forgot Password Modal (Accessible from Login Page) */}
      {isForgotModalOpen && (
        <div className="modal-overlay open">
          <div className="modal max-w-md">
            <div className="modal-header">
              <div className="modal-title">
                <span>🔑</span> Reset Password & Login
              </div>
              <button onClick={() => setIsForgotModalOpen(false)} className="modal-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="modal-body space-y-4">
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={e => setForgotNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-control"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  value={forgotConfirmPassword}
                  onChange={e => setForgotConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-control"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => setIsForgotModalOpen(false)} className="btn btn-outline btn-sm">Cancel</button>
                <button
                  onClick={handleResetPasswordAndLogin}
                  disabled={isResettingPassword}
                  className="btn btn-primary btn-sm disabled:opacity-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset & Sign In'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
