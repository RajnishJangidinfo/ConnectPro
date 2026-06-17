"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatClient = exports.feedClient = exports.connectionClient = exports.profileClient = void 0;
const grpc = __importStar(require("@grpc/grpc-js"));
const dotenv = __importStar(require("dotenv"));
const shared_1 = require("shared");
dotenv.config();
// Load protobuf definitions
const profileProto = (0, shared_1.loadServiceDefinition)('profile');
const connectionProto = (0, shared_1.loadServiceDefinition)('connection');
const feedProto = (0, shared_1.loadServiceDefinition)('feed');
const chatProto = (0, shared_1.loadServiceDefinition)('chat');
// Create insecure credentials for local development
const credentials = grpc.credentials.createInsecure();
// Ports mapping:
// Profile: 50051
// Connection: 50052
// Feed: 50053
// Chat: 50054
exports.profileClient = new profileProto.profile.ProfileService(process.env.PROFILE_SERVICE_URL || 'localhost:50051', credentials);
exports.connectionClient = new connectionProto.connection.ConnectionService(process.env.CONNECTION_SERVICE_URL || 'localhost:50052', credentials);
exports.feedClient = new feedProto.feed.FeedService(process.env.FEED_SERVICE_URL || 'localhost:50053', credentials);
exports.chatClient = new chatProto.chat.ChatService(process.env.CHAT_SERVICE_URL || 'localhost:50054', credentials);
//# sourceMappingURL=grpc-clients.js.map