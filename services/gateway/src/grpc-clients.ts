import * as grpc from '@grpc/grpc-js';
import * as dotenv from 'dotenv';
import { loadServiceDefinition } from 'shared';

dotenv.config();

// Load protobuf definitions
const profileProto = loadServiceDefinition('profile');
const connectionProto = loadServiceDefinition('connection');
const feedProto = loadServiceDefinition('feed');
const chatProto = loadServiceDefinition('chat');

// Create insecure credentials for local development
const credentials = grpc.credentials.createInsecure();

// Ports mapping:
// Profile: 50051
// Connection: 50052
// Feed: 50053
// Chat: 50054
export const profileClient = new profileProto.profile.ProfileService(
  process.env.PROFILE_SERVICE_URL || 'localhost:50051',
  credentials
);

export const connectionClient = new connectionProto.connection.ConnectionService(
  process.env.CONNECTION_SERVICE_URL || 'localhost:50052',
  credentials
);

export const feedClient = new feedProto.feed.FeedService(
  process.env.FEED_SERVICE_URL || 'localhost:50053',
  credentials
);

export const chatClient = new chatProto.chat.ChatService(
  process.env.CHAT_SERVICE_URL || 'localhost:50054',
  credentials
);
