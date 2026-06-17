import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateJWT, AuthenticatedRequest } from './middleware/auth';
import {
  profileClient,
  connectionClient,
  feedClient,
  chatClient
} from './grpc-clients';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'connectpro_super_secret_key';

const createAuditLog = async (
  userId: string | null,
  email: string | null,
  action: string,
  details: string,
  req?: any
) => {
  try {
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || null) : null;
    const ipString = Array.isArray(ipAddress) ? ipAddress[0] : ipAddress;
    
    // Write log to database
    if (isPrismaConnected) {
      await prisma.auditLog.create({
        data: {
          userId,
          email,
          action,
          details,
          ipAddress: ipString,
        }
      });
    }
    console.log(`[AUDIT LOG] ${action} - User: ${email || 'System'} - Details: ${details}`);
  } catch (err: any) {
    console.error(`[AUDIT LOG ERROR] Failed to write audit log:`, err.message);
  }
};

let isPrismaConnected = false;

// In-Memory User Store Fallback
interface InMemoryUser {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
}
const memoryUsers: InMemoryUser[] = [];

// Test DB Connection
const connectDb = async () => {
  try {
    await prisma.$connect();
    isPrismaConnected = true;
    console.log('Gateway connected to PostgreSQL database successfully');
  } catch (err: any) {
    console.warn('\n⚠️ [DATABASE WARNING]: PostgreSQL is offline. Gateway is falling back to IN-MEMORY user accounts storage!\n');
    isPrismaConnected = false;
  }
};
connectDb();

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// HEALTH CHECK / ROOT ENDPOINT
// ----------------------------------------------------
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'ConnectPro API Gateway',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString()
  });
});

// ----------------------------------------------------
// AUTH & ACCOUNT REST ENDPOINTS
// ----------------------------------------------------

app.post('/api/v1/auth/register', async (req, res) => {
  const { email, password, firstName, lastName, headline, bio, location } = req.body;
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ error: 'Missing required registration fields' });
  }

  try {
    let user: { id: string; email: string; role: string };

    if (isPrismaConnected) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const dbUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          isEmailVerified: true
        }
      });
      user = { id: dbUser.id, email: dbUser.email, role: dbUser.role };
    } else {
      // In-Memory Registration Fallback
      const existing = memoryUsers.find(u => u.email === email);
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const memoryUser = {
        id: `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        email,
        passwordHash,
        role: 'USER'
      };
      memoryUsers.push(memoryUser);
      user = { id: memoryUser.id, email: memoryUser.email, role: memoryUser.role };
    }

    // Initialize profile document in Profile Service (MongoDB fallback exists there too!)
    profileClient.createProfile({
      userId: user.id,
      firstName,
      lastName,
      headline: headline || `${firstName} ${lastName} at ConnectPro`,
      bio: bio || '',
      location: location || ''
    }, (err: any, profile: any) => {
      createAuditLog(user.id, user.email, 'USER_REGISTER', `User ${firstName} ${lastName} registered successfully.`, req);
      const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      res.status(201).json({
        message: 'Registration successful',
        token,
        user,
        profile: profile || {
          userId: user.id,
          username: '',
          firstName,
          lastName,
          headline: headline || `${firstName} ${lastName} at ConnectPro`,
          bio: bio || '',
          location: location || '',
          skills: [],
          workExperience: [],
          education: [],
          privacy: { profileVisible: true, showViews: true, openToWork: false }
        }
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    let matchedUser: { id: string; email: string; passwordHash: string; role: string } | null = null;

    if (isPrismaConnected) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) {
        matchedUser = { id: user.id, email: user.email, passwordHash: user.passwordHash, role: user.role };
      }
    } else {
      const user = memoryUsers.find(u => u.email === email);
      if (user) {
        matchedUser = user;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, matchedUser.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: matchedUser.id, email: matchedUser.email, role: matchedUser.role }, JWT_SECRET, { expiresIn: '7d' });

    const clientUserObj = { id: matchedUser.id, email: matchedUser.email, role: matchedUser.role };

    // Fetch user profile via gRPC
    profileClient.getProfile({ userId: matchedUser.id }, (err: any, profile: any) => {
      createAuditLog(clientUserObj.id, clientUserObj.email, 'USER_LOGIN', `User logged in successfully.`, req);
      res.json({
        message: 'Login successful',
        token,
        user: clientUserObj,
        profile: profile || {
          userId: clientUserObj.id,
          username: '',
          firstName: 'Member',
          lastName: 'User',
          headline: 'Professional at ConnectPro',
          bio: '',
          location: '',
          skills: [],
          workExperience: [],
          education: [],
          privacy: { profileVisible: true, showViews: true, openToWork: false }
        }
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/auth/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    profileClient.getProfile({ userId: req.user.userId }, (err: any, profile: any) => {
      res.json({
        user: req.user,
        profile: profile || {
          userId: req.user?.userId,
          firstName: 'Member',
          lastName: 'User',
          headline: 'Professional at ConnectPro',
          bio: '',
          location: '',
          skills: [],
          workExperience: [],
          education: [],
          privacy: { profileVisible: true, showViews: true, openToWork: false }
        }
      });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// PROFILES API GATEWAY ROUTING
// ----------------------------------------------------

// Search profiles by username
app.get('/api/v1/profiles/search', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const username = (req.query.username as string) || '';
  if (!username.trim()) {
    return res.json({ profiles: [] });
  }

  profileClient.searchProfiles({ username: username.trim() }, (err: any, response: any) => {
    if (err) {
      // Fallback: return empty results
      return res.json({ profiles: [] });
    }
    res.json({ profiles: response.profiles || [] });
  });
});

app.get('/api/v1/profiles/:userId', authenticateJWT, (req, res) => {
  profileClient.getProfile({ userId: req.params.userId }, (err: any, response: any) => {
    if (err) {
      // Fallback response for offline Profile service
      return res.json({
        userId: req.params.userId,
        username: '',
        firstName: 'Profile',
        lastName: 'Member',
        headline: 'Software Engineer at ConnectPro',
        bio: 'Welcome to this placeholder profile.',
        location: 'San Francisco, CA',
        skills: [{ id: 's1', name: 'TypeScript' }, { id: 's2', name: 'Next.js' }],
        workExperience: [],
        education: [],
        privacy: { profileVisible: true, showViews: true, openToWork: false }
      });
    }
    res.json(response);
  });
});

app.put('/api/v1/profiles/me', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const updateData = { ...req.body, userId: req.user.userId };

  profileClient.updateProfile(updateData, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'UPDATE_PROFILE', `Updated profile fields (headline: "${updateData.headline || ''}", location: "${updateData.location || ''}").`, req);
    if (err) {
      // Offline fallback: Echo updated details to client directly
      return res.json(updateData);
    }
    res.json(response);
  });
});

// ----------------------------------------------------
// CONNECTIONS API GATEWAY ROUTING
// ----------------------------------------------------

app.post('/api/v1/connections/request', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { receiverId } = req.body;

  connectionClient.sendConnectionRequest({
    senderId: req.user.userId,
    receiverId
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'SEND_CONNECTION_INVITE', `Connection invite sent to user ID ${receiverId}.`, req);
    if (err) {
      // Fallback
      return res.json({ success: true, status: 'PENDING', message: 'Connection request sent successfully (Mock)' });
    }
    res.json(response);
  });
});

app.put('/api/v1/connections/request/accept', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { senderId } = req.body;

  connectionClient.acceptConnectionRequest({
    senderId,
    receiverId: req.user.userId
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'ACCEPT_CONNECTION', `Accepted connection request from user ID ${senderId}.`, req);
    if (err) {
      // Fallback
      return res.json({ success: true, status: 'ACCEPTED', message: 'Connection request accepted (Mock)' });
    }
    res.json(response);
  });
});

app.put('/api/v1/connections/request/reject', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { senderId } = req.body;

  connectionClient.rejectConnectionRequest({
    senderId,
    receiverId: req.user.userId
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'REJECT_CONNECTION', `Rejected connection request from user ID ${senderId}.`, req);
    if (err) return res.json({ success: true, status: 'REJECTED' });
    res.json(response);
  });
});

app.get('/api/v1/connections', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const status = req.query.status as string || 'ACCEPTED';

  connectionClient.getConnections({
    userId: req.user.userId,
    status
  }, (err: any, response: any) => {
    if (err) {
      // Return local fallback connection items so interface remains beautiful when connections microservice is down
      const fallbackList = status === 'PENDING' ? [] : [
        { userId: 'sophia-reyes-uuid', status: 'ACCEPTED', firstName: 'Sophia', lastName: 'Reyes', headline: 'Head of Design at Stripe', degree: 1 },
        { userId: 'james-kim-uuid', status: 'ACCEPTED', firstName: 'James', lastName: 'Kim', headline: 'CTO at NovaTech', degree: 1 },
        { userId: 'leila-patel-uuid', status: 'ACCEPTED', firstName: 'Leila', lastName: 'Patel', headline: 'VP Product at Airbnb', degree: 1 }
      ];
      return res.json({ connections: fallbackList });
    }

    const connections = response.connections || [];
    if (connections.length === 0) {
      return res.json({ connections: [] });
    }

    let completed = 0;
    const populatedConnections: any[] = [];

    connections.forEach((conn: any) => {
      profileClient.getProfile({ userId: conn.userId }, (profErr: any, prof: any) => {
        populatedConnections.push({
          ...conn,
          firstName: prof?.firstName || 'ConnectPro',
          lastName: prof?.lastName || 'Member',
          headline: prof?.headline || 'Professional Member'
        });
        completed++;
        if (completed === connections.length) {
          res.json({ connections: populatedConnections });
        }
      });
    });
  });
});

app.get('/api/v1/connections/suggestions', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  connectionClient.getConnectionSuggestions({
    userId: req.user.userId
  }, (err: any, response: any) => {
    if (err) {
      // Mock suggestions fallback
      const fallbackSugg = [
        { userId: 'marcus-nguyen-uuid', firstName: 'Marcus', lastName: 'Nguyen', headline: 'Design Lead at Figma', degree: 2 },
        { userId: 'rachel-lim-uuid', firstName: 'Rachel', lastName: 'Lim', headline: 'Product Manager at Google', degree: 2 },
        { userId: 'tyler-osei-uuid', firstName: 'Tyler', lastName: 'Osei', headline: 'Founder at BuildFast', degree: 2 }
      ];
      return res.json({ suggestions: fallbackSugg });
    }
    
    const suggestions = response.connections || [];
    if (suggestions.length === 0) {
      return res.json({ suggestions: [] });
    }

    let completed = 0;
    const populatedSuggestions: any[] = [];

    suggestions.forEach((conn: any) => {
      profileClient.getProfile({ userId: conn.userId }, (profErr: any, prof: any) => {
        populatedSuggestions.push({
          ...conn,
          firstName: prof?.firstName || 'Suggested',
          lastName: prof?.lastName || 'Member',
          headline: prof?.headline || 'Professional at ConnectPro'
        });
        completed++;
        if (completed === suggestions.length) {
          res.json({ suggestions: populatedSuggestions });
        }
      });
    });
  });
});

// ----------------------------------------------------
// NEWS FEED API GATEWAY ROUTING
// ----------------------------------------------------

app.get('/api/v1/posts', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  feedClient.getFeed({
    userId: req.user.userId,
    page,
    limit
  }, (err: any, response: any) => {
    if (err) {
      // Mock posts fallback when feed service is offline
      const mockPosts = [
        {
          id: 'post-1',
          authorId: 'sophia-reyes-uuid',
          authorName: 'Sophia Reyes',
          authorHeadline: 'Head of Design at Stripe',
          authorAvatar: '',
          content: 'Just finalized our Design Token system migration! Shared styled dictionary configurations with our 12 product teams. Naming variables is always the hardest battle! 🎨',
          likesCount: 142,
          comments: [],
          createdAt: new Date(Date.now() - 3600000).toISOString()
        },
        {
          id: 'post-2',
          authorId: 'james-kim-uuid',
          authorName: 'James Kim',
          authorHeadline: 'CTO at NovaTech',
          authorAvatar: '',
          content: 'Migrated all our core monolith microservices to a unified gRPC IPC. Lowered our service latency bounds by 35%! Highly recommend moving high-throughput APIs off plain JSON-HTTP. 🚀',
          likesCount: 98,
          comments: [],
          createdAt: new Date(Date.now() - 7200000).toISOString()
        }
      ];
      return res.json({ posts: mockPosts });
    }
    
    const posts = response.posts || [];
    if (posts.length === 0) {
      return res.json({ posts: [] });
    }

    let completed = 0;
    const populatedPosts: any[] = [];

    posts.forEach((post: any) => {
      profileClient.getProfile({ userId: post.authorId }, (profErr: any, prof: any) => {
        populatedPosts.push({
          ...post,
          authorName: prof ? `${prof.firstName} ${prof.lastName}` : 'ConnectPro Member',
          authorHeadline: prof?.headline || 'Professional Network Member',
          authorAvatar: prof?.profilePicture || ''
        });
        completed++;
        if (completed === posts.length) {
          populatedPosts.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          res.json({ posts: populatedPosts });
        }
      });
    });
  });
});

app.post('/api/v1/posts', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { content, mediaUrl, tags } = req.body;

  feedClient.createPost({
    authorId: req.user.userId,
    content,
    mediaUrl: mediaUrl || '',
    tags: tags || []
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'CREATE_POST', `Published a new post: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}".`, req);
    if (err) {
      // Mock create post fallback
      return res.status(201).json({
        id: `post-${Date.now()}`,
        authorId: req.user?.userId,
        content,
        mediaUrl: mediaUrl || '',
        tags: tags || [],
        likesCount: 0,
        comments: [],
        createdAt: new Date().toISOString()
      });
    }
    res.status(201).json(response);
  });
});

app.post('/api/v1/posts/:postId/like', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  feedClient.likePost({
    postId: req.params.postId,
    userId: req.user.userId
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'LIKE_POST', `Toggled like on post ID ${req.params.postId}.`, req);
    if (err) return res.json({ success: true, message: 'Like toggled (Mock)' });
    res.json(response);
  });
});

app.post('/api/v1/posts/:postId/comment', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { content } = req.body;

  feedClient.commentPost({
    postId: req.params.postId,
    userId: req.user.userId,
    content
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'COMMENT_POST', `Commented on post ID ${req.params.postId}: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}".`, req);
    if (err) return res.json({ success: true, message: 'Comment added (Mock)' });
    res.json(response);
  });
});

// ----------------------------------------------------
// REAL-TIME MESSAGING API GATEWAY ROUTING
// ----------------------------------------------------

app.get('/api/v1/chats/conversations', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  chatClient.getConversations({
    userId: req.user.userId
  }, (err: any, response: any) => {
    if (err) {
      // Fallback mock active threads list
      const mockConvs = [
        {
          id: 'conv-1',
          isGroup: false,
          lastMessageText: 'That component sounds brilliant honestly',
          lastMessageTime: new Date(Date.now() - 120000).toISOString(),
          participants: [{ userId: req.user?.userId }, { userId: 'sophia-reyes-uuid' }],
          otherUser: {
            userId: 'sophia-reyes-uuid',
            firstName: 'Sophia',
            lastName: 'Reyes',
            headline: 'Head of Design at Stripe',
            avatar: ''
          }
        },
        {
          id: 'conv-2',
          isGroup: false,
          lastMessageText: "Let's sync on Friday",
          lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
          participants: [{ userId: req.user?.userId }, { userId: 'james-kim-uuid' }],
          otherUser: {
            userId: 'james-kim-uuid',
            firstName: 'James',
            lastName: 'Kim',
            headline: 'CTO at NovaTech',
            avatar: ''
          }
        }
      ];
      return res.json({ conversations: mockConvs });
    }

    const conversations = response.conversations || [];
    if (conversations.length === 0) {
      return res.json({ conversations: [] });
    }

    let completed = 0;
    const populatedConversations: any[] = [];

    conversations.forEach((conv: any) => {
      const otherPart = conv.participants.find((p: any) => p.userId !== req.user?.userId);
      const targetUserId = otherPart ? otherPart.userId : req.user?.userId;

      profileClient.getProfile({ userId: targetUserId }, (profErr: any, prof: any) => {
        populatedConversations.push({
          ...conv,
          otherUser: prof ? {
            userId: targetUserId,
            firstName: prof.firstName,
            lastName: prof.lastName,
            headline: prof.headline || '',
            avatar: prof.profilePicture || ''
          } : {
            userId: targetUserId,
            firstName: 'ConnectPro',
            lastName: 'User',
            headline: '',
            avatar: ''
          }
        });
        completed++;
        if (completed === conversations.length) {
          res.json({ conversations: populatedConversations });
        }
      });
    });
  });
});

app.post('/api/v1/chats/conversations', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { isGroup, groupName, participantIds } = req.body;

  const finalParticipants = Array.from(new Set([req.user.userId, ...participantIds]));

  chatClient.createConversation({
    isGroup: !!isGroup,
    groupName: groupName || '',
    groupAvatar: '',
    participantIds: finalParticipants
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'CREATE_CHAT', `Created a new chat thread (isGroup: ${!!isGroup}, name: "${groupName || ''}").`, req);
    if (err) {
      // Mock create conversation
      return res.status(201).json({
        id: `conv-${Date.now()}`,
        isGroup: !!isGroup,
        groupName: groupName || 'Group Chat',
        groupAvatar: '',
        participants: finalParticipants.map(id => ({ userId: id, role: 'MEMBER' })),
        lastMessageText: '',
        lastMessageTime: new Date().toISOString()
      });
    }
    res.status(201).json(response);
  });
});

app.get('/api/v1/chats/conversations/:convId/messages', authenticateJWT, (req: AuthenticatedRequest, res) => {
  const { limit, beforeMessageId } = req.query;
  chatClient.getMessages({
    conversationId: req.params.convId,
    limit: parseInt(limit as string) || 50,
    beforeMessageId: (beforeMessageId as string) || ''
  }, (err: any, response: any) => {
    if (err) {
      // Mock chat messages history stream
      const mockHistory = [
        {
          id: 'm-1',
          conversationId: req.params.convId,
          senderId: 'sophia-reyes-uuid',
          content: 'Hey! Love your post on design systems. Would love to hear more about how you handled the token migration.',
          mediaUrl: '',
          createdAt: new Date(Date.now() - 600000).toISOString(),
          readBy: []
        },
        {
          id: 'm-2',
          conversationId: req.params.convId,
          senderId: req.user?.userId || 'me',
          content: 'Thanks Sophia! It was a 4-month process. Naming tokens was definitely the trickiest part 😅',
          mediaUrl: '',
          createdAt: new Date(Date.now() - 300000).toISOString(),
          readBy: []
        },
        {
          id: 'm-3',
          conversationId: req.params.convId,
          senderId: 'sophia-reyes-uuid',
          content: 'That component sounds brilliant honestly',
          mediaUrl: '',
          createdAt: new Date(Date.now() - 120000).toISOString(),
          readBy: []
        }
      ];
      return res.json({ messages: mockHistory });
    }
    res.json(response);
  });
});

app.post('/api/v1/chats/conversations/:convId/messages', authenticateJWT, (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { content, mediaUrl } = req.body;

  chatClient.sendMessage({
    conversationId: req.params.convId,
    senderId: req.user.userId,
    content,
    mediaUrl: mediaUrl || ''
  }, (err: any, response: any) => {
    createAuditLog(req.user!.userId, req.user!.email, 'SEND_MESSAGE', `Sent chat message: "${content.substring(0, 40)}${content.length > 40 ? '...' : ''}".`, req);
    if (err) {
      // Mock send message
      return res.status(201).json({
        id: `msg-${Date.now()}`,
        conversationId: req.params.convId,
        senderId: req.user?.userId,
        content,
        mediaUrl: mediaUrl || '',
        createdAt: new Date().toISOString(),
        readBy: [req.user?.userId]
      });
    }
    res.status(201).json(response);
  });
});

// ----------------------------------------------------
// AUDIT LOGS ENDPOINTS
// ----------------------------------------------------

app.get('/api/v1/admin/logs', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden: Admin access required' });

  try {
    if (isPrismaConnected) {
      const logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' }
      });
      return res.json({ logs });
    } else {
      const mockLogs = [
        { id: 'log-1', userId: 'admin-1', email: 'rajni@connectpro.com', action: 'USER_LOGIN', details: 'Mock Admin logged in successfully.', ipAddress: '127.0.0.1', createdAt: new Date().toISOString() },
        { id: 'log-2', userId: 'user-2', email: 'sophia@stripe.com', action: 'USER_REGISTER', details: 'Mock user Sophia Reyes registered.', ipAddress: '127.0.0.1', createdAt: new Date(Date.now() - 60000).toISOString() }
      ];
      return res.json({ logs: mockLogs });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/audit/log', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { action, details } = req.body;
  if (!action || !details) {
    return res.status(400).json({ error: 'Action and details are required' });
  }

  try {
    await createAuditLog(req.user.userId, req.user.email, action, details, req);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SOCKET.IO REAL-TIME SIGNALING HUB
// ----------------------------------------------------

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication failed: missing token'));

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication failed: invalid token'));
    socket.data.userId = decoded.userId;
    socket.data.email = decoded.email;
    next();
  });
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  console.log(`Socket client connected: User ID ${userId} (socket ${socket.id})`);

  socket.join(`user:${userId}`);

  socket.on('join_room', (conversationId) => {
    socket.join(`room:${conversationId}`);
  });

  socket.on('leave_room', (conversationId) => {
    socket.leave(`room:${conversationId}`);
  });

  socket.on('chat_message', (data) => {
    const { conversationId, message } = data;
    socket.to(`room:${conversationId}`).emit('receive_message', {
      conversationId,
      message
    });
  });

  socket.on('typing_start', (data) => {
    const { conversationId } = data;
    socket.to(`room:${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      typing: true
    });
  });

  socket.on('typing_stop', (data) => {
    const { conversationId } = data;
    socket.to(`room:${conversationId}`).emit('user_typing', {
      conversationId,
      userId,
      typing: false
    });
  });

  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: User ID ${userId} (socket ${socket.id})`);
  });
});

// Start Gateway Server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
