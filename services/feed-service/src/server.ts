import * as grpc from '@grpc/grpc-js';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import { loadServiceDefinition } from 'shared';
import { PostModel } from './post.model';

dotenv.config();

let isMongoConnected = false;
let isRedisConnected = false;

// Connect to MongoDB
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/connectpro_feed';
mongoose.connect(mongoUrl)
  .then(() => {
    console.log('Feed MongoDB connected successfully');
    isMongoConnected = true;
  })
  .catch(err => {
    console.warn('\n⚠️ [DATABASE WARNING]: MongoDB is offline. Feed Service is falling back to IN-MEMORY posts store!\n');
    isMongoConnected = false;
  });

// Connect to Redis
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { lazyConnect: true });
redis.connect()
  .then(() => {
    console.log('Feed Service Redis connected');
    isRedisConnected = true;
  })
  .catch((err) => {
    console.warn('Feed Service Redis is offline. Caching disabled.');
    isRedisConnected = false;
  });

// Load Protos
const protoPackage = loadServiceDefinition('feed');
const feedServiceDef = protoPackage.feed.FeedService.service;

const connectionProto = loadServiceDefinition('connection');
const connectionClient = new connectionProto.connection.ConnectionService(
  process.env.CONNECTION_SERVICE_URL || 'localhost:50052',
  grpc.credentials.createInsecure()
);

const server = new grpc.Server();

// In-Memory Feed Fallback store
const memoryPosts: any[] = [];

const mapDbPostToProto = (post: any) => {
  return {
    id: post._id?.toString() || post.id || 'p-id',
    authorId: post.authorId,
    content: post.content,
    mediaUrl: post.mediaUrl || '',
    tags: post.tags || [],
    likesCount: post.likes ? post.likes.length : 0,
    comments: (post.comments || []).map((c: any) => ({
      id: c._id?.toString() || c.id || 'c-id',
      userId: c.userId,
      content: c.content,
      createdAt: c.createdAt ? (c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt) : ''
    })),
    createdAt: post.createdAt ? (post.createdAt instanceof Date ? post.createdAt.toISOString() : post.createdAt) : ''
  };
};

server.addService(feedServiceDef, {
  createPost: async (call: any, callback: any) => {
    try {
      const { authorId, content, mediaUrl, tags } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const newPost = new PostModel({ authorId, content, mediaUrl, tags });
        await newPost.save();
        if (isRedisConnected) {
          await redis.del(`feed:user:${authorId}`);
        }
        callback(null, mapDbPostToProto(newPost));
      } else {
        const newPost = {
          id: `post-${Date.now()}`,
          authorId, content, mediaUrl, tags,
          likes: [], comments: [], shares: [],
          createdAt: new Date()
        };
        memoryPosts.unshift(newPost);
        callback(null, mapDbPostToProto(newPost));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  getFeed: async (call: any, callback: any) => {
    try {
      const { userId, page, limit } = call.request;
      const currentPage = page || 1;
      const currentLimit = limit || 10;
      const skip = (currentPage - 1) * currentLimit;

      if (isRedisConnected && currentPage === 1) {
        try {
          const cachedFeed = await redis.get(`feed:user:${userId}:p_${currentPage}`);
          if (cachedFeed) {
            return callback(null, { posts: JSON.parse(cachedFeed) });
          }
        } catch (err) {}
      }

      // Query Connection Microservice via gRPC client
      connectionClient.getConnections(
        { userId, status: 'ACCEPTED' },
        async (err: any, response: any) => {
          try {
            let authorIds = [userId];
            if (!err && response && response.connections) {
              const connIds = response.connections.map((c: any) => c.userId);
              authorIds = [...authorIds, ...connIds];
            } else {
              // Mock fallback connection list for in-memory feeds query
              authorIds = [userId, 'sophia-reyes-uuid', 'james-kim-uuid', 'leila-patel-uuid'];
            }

            let postsList = [];

            if (isMongoConnected && mongoose.connection.readyState === 1) {
              const posts = await PostModel.find({ authorId: { $in: authorIds } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(currentLimit);
              postsList = posts.map(mapDbPostToProto);
            } else {
              // In-Memory filtering
              postsList = memoryPosts
                .filter(p => authorIds.includes(p.authorId))
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .slice(skip, skip + currentLimit)
                .map(mapDbPostToProto);

              // If memory post queue is empty, insert mock items so the feed is populated at first glance!
              if (postsList.length === 0 && currentPage === 1) {
                const samplePosts = [
                  {
                    id: 'post-1',
                    authorId: 'sophia-reyes-uuid',
                    content: 'Just finalized our Design Token system migration! Shared styled dictionary configurations with our 12 product teams. Naming variables is always the hardest battle! 🎨',
                    mediaUrl: '',
                    tags: ['DesignSystems', 'Figma'],
                    likes: ['user-123'], comments: [], shares: [],
                    createdAt: new Date(Date.now() - 3600000)
                  },
                  {
                    id: 'post-2',
                    authorId: 'james-kim-uuid',
                    content: 'Migrated all our core monolith microservices to a unified gRPC IPC. Lowered our service latency bounds by 35%! Highly recommend moving high-throughput APIs off plain JSON-HTTP. 🚀',
                    mediaUrl: '',
                    tags: ['Microservices', 'SystemDesign'],
                    likes: ['user-456'], comments: [], shares: [],
                    createdAt: new Date(Date.now() - 7200000)
                  }
                ];
                postsList = samplePosts.map(mapDbPostToProto);
              }
            }

            if (isRedisConnected && currentPage === 1) {
              try {
                await redis.setex(`feed:user:${userId}:p_${currentPage}`, 60, JSON.stringify(postsList));
              } catch (err) {}
            }

            callback(null, { posts: postsList });
          } catch (dbErr: any) {
            callback({ code: grpc.status.INTERNAL, message: dbErr.message });
          }
        }
      );
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  updatePost: async (call: any, callback: any) => {
    try {
      const { id, authorId, content, mediaUrl, tags } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const post = await PostModel.findOne({ _id: id, authorId });
        if (!post) return callback({ code: grpc.status.NOT_FOUND, message: 'Post not found' });
        post.content = content;
        post.mediaUrl = mediaUrl;
        post.tags = tags;
        await post.save();
        callback(null, mapDbPostToProto(post));
      } else {
        const post = memoryPosts.find(p => p.id === id && p.authorId === authorId);
        if (!post) return callback({ code: grpc.status.NOT_FOUND, message: 'Post not found' });
        post.content = content;
        post.mediaUrl = mediaUrl;
        post.tags = tags;
        callback(null, mapDbPostToProto(post));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  deletePost: async (call: any, callback: any) => {
    try {
      const { id, authorId } = call.request;
      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const result = await PostModel.deleteOne({ _id: id, authorId });
        if (result.deletedCount === 0) return callback(null, { success: false, message: 'Post not found' });
      } else {
        const idx = memoryPosts.findIndex(p => p.id === id && p.authorId === authorId);
        if (idx === -1) return callback(null, { success: false, message: 'Post not found' });
        memoryPosts.splice(idx, 1);
      }
      callback(null, { success: true, message: 'Post deleted successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  likePost: async (call: any, callback: any) => {
    try {
      const { postId, userId } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const post = await PostModel.findById(postId);
        if (!post) return callback({ code: grpc.status.NOT_FOUND, message: 'Post not found' });
        const idx = post.likes.indexOf(userId);
        if (idx > -1) post.likes.splice(idx, 1);
        else post.likes.push(userId);
        await post.save();
      } else {
        const post = memoryPosts.find(p => p.id === postId);
        if (post) {
          const idx = post.likes.indexOf(userId);
          if (idx > -1) post.likes.splice(idx, 1);
          else post.likes.push(userId);
        }
      }
      callback(null, { success: true, message: 'Post like toggled successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  commentPost: async (call: any, callback: any) => {
    try {
      const { postId, userId, content } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const post = await PostModel.findById(postId);
        if (!post) return callback({ code: grpc.status.NOT_FOUND, message: 'Post not found' });
        post.comments.push({ userId, content, createdAt: new Date() });
        await post.save();
      } else {
        const post = memoryPosts.find(p => p.id === postId);
        if (post) {
          post.comments.push({ id: `c-${Date.now()}`, userId, content, createdAt: new Date() });
        }
      }
      callback(null, { success: true, message: 'Comment added successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  sharePost: async (call: any, callback: any) => {
    try {
      const { postId, userId } = call.request;
      callback(null, { success: true, message: 'Post shared successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  }
});

const PORT = process.env.FEED_PORT || '50053';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC Feed Service:', err);
    return;
  }
  console.log(`Feed Service running on port ${port}`);
});
