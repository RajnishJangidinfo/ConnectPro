import * as grpc from '@grpc/grpc-js';
import * as dotenv from 'dotenv';
import { loadServiceDefinition } from 'shared';
import { pool, initDb, isDbConnected } from './db';
import { ConnectionStore, InMemoryConnection } from './store';

dotenv.config();

// Boot up databases tables
initDb();

const protoPackage = loadServiceDefinition('connection');
const connectionService = protoPackage.connection.ConnectionService.service;

const server = new grpc.Server();

// In-Memory Fallbacks Data
interface InMemoryBlock {
  blockerId: string;
  blockedId: string;
}

const connectionStore = new ConnectionStore();
const memoryBlocks: InMemoryBlock[] = [];

server.addService(connectionService, {
  sendConnectionRequest: async (call: any, callback: any) => {
    try {
      const { senderId, receiverId } = call.request;
      if (senderId === receiverId) {
        return callback(null, { success: false, status: 'NONE', message: 'Cannot connect with yourself' });
      }

      if (isDbConnected) {
        // SQL code path
        const blockCheck = await pool.query(
          'SELECT 1 FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
          [senderId, receiverId]
        );
        if (blockCheck.rowCount && blockCheck.rowCount > 0) {
          return callback(null, { success: false, status: 'BLOCKED', message: 'User is blocked' });
        }

        const connCheck = await pool.query(
          'SELECT status FROM connections WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
          [senderId, receiverId]
        );
        if (connCheck.rowCount && connCheck.rowCount > 0) {
          const status = connCheck.rows[0].status;
          return callback(null, { success: false, status, message: `Request exists: ${status}` });
        }

        await pool.query(
          'INSERT INTO connections (sender_id, receiver_id, status) VALUES ($1, $2, \'PENDING\')',
          [senderId, receiverId]
        );
      } else {
        // In-Memory code path
        const blocked = memoryBlocks.some(b => 
          (b.blockerId === senderId && b.blockedId === receiverId) || 
          (b.blockerId === receiverId && b.blockedId === senderId)
        );
        if (blocked) {
          return callback(null, { success: false, status: 'BLOCKED', message: 'User is blocked' });
        }

        const existing = connectionStore.findConnection((c: any) => 
          (c.senderId === senderId && c.receiverId === receiverId) || 
          (c.senderId === receiverId && c.receiverId === senderId)
        );
        if (existing) {
          return callback(null, { success: false, status: existing.status, message: `Request exists: ${existing.status}` });
        }

        connectionStore.addConnection({ senderId, receiverId, status: 'PENDING' });
      }

      callback(null, { success: true, status: 'PENDING', message: 'Connection request sent successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  acceptConnectionRequest: async (call: any, callback: any) => {
    try {
      const { senderId, receiverId } = call.request;

      if (isDbConnected) {
        const result = await pool.query(
          'UPDATE connections SET status = \'ACCEPTED\', updated_at = CURRENT_TIMESTAMP WHERE sender_id = $1 AND receiver_id = $2 AND status = \'PENDING\'',
          [senderId, receiverId]
        );
        if (result.rowCount === 0) {
          return callback(null, { success: false, status: 'NONE', message: 'Pending connection request not found' });
        }
      } else {
        const conn = connectionStore.findConnection(c => c.senderId === senderId && c.receiverId === receiverId && c.status === 'PENDING');
        if (!conn) {
          return callback(null, { success: false, status: 'NONE', message: 'Pending connection request not found' });
        }
        conn.status = 'ACCEPTED';
        connectionStore.save();
      }

      callback(null, { success: true, status: 'ACCEPTED', message: 'Connection request accepted' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  rejectConnectionRequest: async (call: any, callback: any) => {
    try {
      const { senderId, receiverId } = call.request;

      if (isDbConnected) {
        const result = await pool.query(
          'UPDATE connections SET status = \'REJECTED\', updated_at = CURRENT_TIMESTAMP WHERE sender_id = $1 AND receiver_id = $2 AND status = \'PENDING\'',
          [senderId, receiverId]
        );
        if (result.rowCount === 0) {
          return callback(null, { success: false, status: 'NONE', message: 'Pending connection request not found' });
        }
      } else {
        const conn = connectionStore.findConnection(c => c.senderId === senderId && c.receiverId === receiverId && c.status === 'PENDING');
        if (!conn) {
          return callback(null, { success: false, status: 'NONE', message: 'Pending connection request not found' });
        }
        conn.status = 'REJECTED';
        connectionStore.save();
      }

      callback(null, { success: true, status: 'REJECTED', message: 'Connection request rejected' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  cancelConnectionRequest: async (call: any, callback: any) => {
    try {
      const { senderId, receiverId } = call.request;

      if (isDbConnected) {
        const result = await pool.query(
          'DELETE FROM connections WHERE sender_id = $1 AND receiver_id = $2 AND status = \'PENDING\'',
          [senderId, receiverId]
        );
        if (result.rowCount === 0) {
          return callback(null, { success: false, status: 'NONE', message: 'Pending connection request not found' });
        }
      } else {
        const idx = connectionStore.findIndex((c: any) => c.senderId === senderId && c.receiverId === receiverId && c.status === 'PENDING');
        if (idx === -1) {
          return callback(null, { success: false, status: 'NONE', message: 'Pending connection request not found' });
        }
        connectionStore.removeConnectionByIndex(idx);
      }

      callback(null, { success: true, status: 'NONE', message: 'Connection request cancelled' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  removeConnection: async (call: any, callback: any) => {
    try {
      const { userA, userB } = call.request;

      if (isDbConnected) {
        const result = await pool.query(
          'DELETE FROM connections WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)) AND status = \'ACCEPTED\'',
          [userA, userB]
        );
        if (result.rowCount === 0) {
          return callback(null, { success: false, status: 'NONE', message: 'Active connection not found' });
        }
      } else {
        const idx = connectionStore.findIndex(c => ((c.senderId === userA && c.receiverId === userB) || (c.senderId === userB && c.receiverId === userA)) && c.status === 'ACCEPTED');
        if (idx === -1) {
          return callback(null, { success: false, status: 'NONE', message: 'Active connection not found' });
        }
        connectionStore.removeConnectionByIndex(idx);
      }

      callback(null, { success: true, status: 'NONE', message: 'Connection removed successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  getConnections: async (call: any, callback: any) => {
    try {
      const { userId, status } = call.request;
      const filterStatus = status || 'ACCEPTED';
      let connections = [];

      if (isDbConnected) {
        const result = await pool.query(
          `SELECT 
             CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id,
             status
           FROM connections
           WHERE (sender_id = $1 OR receiver_id = $1) AND status = $2`,
          [userId, filterStatus]
        );
        connections = result.rows.map(row => ({
          userId: row.friend_id,
          status: row.status,
          firstName: '',
          lastName: '',
          headline: '',
          degree: filterStatus === 'ACCEPTED' ? 1 : 0
        }));
      } else {
        if (filterStatus === 'PENDING') {
          connections = connectionStore.getAllConnections()
            .filter(c => c.receiverId === userId && c.status === 'PENDING')
            .map(c => ({
              userId: c.senderId,
              status: c.status,
              firstName: '',
              lastName: '',
              headline: '',
              degree: 0
            }));
        } else {
          connections = connectionStore.getAllConnections()
            .filter(c => (c.senderId === userId || c.receiverId === userId) && c.status === filterStatus)
            .map(c => ({
              userId: c.senderId === userId ? c.receiverId : c.senderId,
              status: c.status,
              firstName: '',
              lastName: '',
              headline: '',
              degree: filterStatus === 'ACCEPTED' ? 1 : 0
            }));
        }
      }

      callback(null, { connections });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  getMutualConnections: async (call: any, callback: any) => {
    try {
      const { userA, userB } = call.request;
      let connections = [];

      if (isDbConnected) {
        const result = await pool.query(
          `WITH friendsA AS (
             SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS id
             FROM connections WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'ACCEPTED'
           ), friendsB AS (
             SELECT CASE WHEN sender_id = $2 THEN receiver_id ELSE sender_id END AS id
             FROM connections WHERE (sender_id = $2 OR receiver_id = $2) AND status = 'ACCEPTED'
           )
           SELECT id FROM friendsA INTERSECT SELECT id FROM friendsB`,
          [userA, userB]
        );
        connections = result.rows.map(row => ({
          userId: row.id,
          status: 'ACCEPTED',
          firstName: '',
          lastName: '',
          headline: '',
          degree: 1
        }));
      } else {
        const friendsA = connectionStore.getAllConnections()
          .filter(c => (c.senderId === userA || c.receiverId === userA) && c.status === 'ACCEPTED')
          .map(c => c.senderId === userA ? c.receiverId : c.senderId);

        const friendsB = connectionStore.getAllConnections()
          .filter(c => (c.senderId === userB || c.receiverId === userB) && c.status === 'ACCEPTED')
          .map(c => c.senderId === userB ? c.receiverId : c.senderId);

        const intersection = friendsA.filter(id => friendsB.includes(id));
        connections = intersection.map(id => ({
          userId: id,
          status: 'ACCEPTED',
          firstName: '',
          lastName: '',
          headline: '',
          degree: 1
        }));
      }

      callback(null, { connections });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  getConnectionSuggestions: async (call: any, callback: any) => {
    try {
      const { userId } = call.request;
      let connections = [];

      if (isDbConnected) {
        const result = await pool.query(
          `WITH first_degree AS (
             SELECT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END AS friend_id
             FROM connections WHERE (sender_id = $1 OR receiver_id = $1) AND status = 'ACCEPTED'
           ), second_degree AS (
             SELECT CASE WHEN c.sender_id = fd.friend_id THEN c.receiver_id ELSE c.sender_id END AS sugg_id
             FROM connections c
             JOIN first_degree fd ON (c.sender_id = fd.friend_id OR c.receiver_id = fd.friend_id)
             WHERE c.status = 'ACCEPTED'
           )
           SELECT sugg_id, COUNT(*) as weight
           FROM second_degree
           WHERE sugg_id != $1 
             AND sugg_id NOT IN (SELECT friend_id FROM first_degree)
             AND sugg_id NOT IN (
               SELECT blocker_id FROM blocks WHERE blocked_id = $1
               UNION
               SELECT blocked_id FROM blocks WHERE blocker_id = $1
             )
           GROUP BY sugg_id
           ORDER BY weight DESC
           LIMIT 10`,
          [userId]
        );
        connections = result.rows.map(row => ({
          userId: row.sugg_id,
          status: 'NONE',
          firstName: '',
          lastName: '',
          headline: '',
          degree: 2
        }));
      } else {
        const direct = connectionStore.getAllConnections()
          .filter(c => (c.senderId === userId || c.receiverId === userId) && c.status === 'ACCEPTED')
          .map(c => c.senderId === userId ? c.receiverId : c.senderId);
        
        let secondDegree = new Set<string>();
        direct.forEach(fId => {
          const theirConnections = connectionStore.getAllConnections()
            .filter(c => (c.senderId === fId || c.receiverId === fId) && c.status === 'ACCEPTED')
            .map(c => c.senderId === fId ? c.receiverId : c.senderId);
          theirConnections.forEach(id => {
            if (id !== userId && !direct.includes(id)) secondDegree.add(id);
          });
        });

        const defaultSugg = ['sophia-reyes-uuid', 'james-kim-uuid', 'leila-patel-uuid', 'marcus-nguyen-uuid', 'rachel-lim-uuid', 'tyler-osei-uuid'];
        defaultSugg.forEach(id => {
          if (id !== userId && !direct.includes(id)) secondDegree.add(id);
        });

        connections = Array.from(secondDegree).map(id => ({
          userId: id,
          status: 'NONE',
          firstName: '',
          lastName: '',
          headline: '',
          degree: 2
        }));
      }

      callback(null, { connections });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  blockUser: async (call: any, callback: any) => {
    try {
      const { blockerId, blockedId } = call.request;

      if (isDbConnected) {
        await pool.query(
          'DELETE FROM connections WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)',
          [blockerId, blockedId]
        );
        await pool.query(
          'INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT (blocker_id, blocked_id) DO NOTHING',
          [blockerId, blockedId]
        );
      } else {
        const idx = connectionStore.findIndex(c => 
          (c.senderId === blockerId && c.receiverId === blockedId) || 
          (c.senderId === blockedId && c.receiverId === blockerId)
        );
        if (idx !== -1) connectionStore.removeConnectionByIndex(idx);

        if (!memoryBlocks.some(b => b.blockerId === blockerId && b.blockedId === blockedId)) {
          memoryBlocks.push({ blockerId, blockedId });
        }
      }

      callback(null, { success: true, status: 'BLOCKED', message: 'User blocked successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  unblockUser: async (call: any, callback: any) => {
    try {
      const { blockerId, blockedId } = call.request;

      if (isDbConnected) {
        await pool.query(
          'DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2',
          [blockerId, blockedId]
        );
      } else {
        const idx = memoryBlocks.findIndex(b => b.blockerId === blockerId && b.blockedId === blockedId);
        if (idx !== -1) memoryBlocks.splice(idx, 1);
      }

      callback(null, { success: true, status: 'NONE', message: 'User unblocked successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },

  checkConnectionStatus: async (call: any, callback: any) => {
    try {
      const { userA, userB } = call.request;
      let statusStr = 'NONE';

      if (isDbConnected) {
        const blockCheck = await pool.query(
          'SELECT blocker_id FROM blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
          [userA, userB]
        );
        if (blockCheck.rowCount && blockCheck.rowCount > 0) {
          return callback(null, { status: 'BLOCKED' });
        }

        const connCheck = await pool.query(
          'SELECT status FROM connections WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1) LIMIT 1',
          [userA, userB]
        );
        if (connCheck.rowCount && connCheck.rowCount > 0) {
          return callback(null, { status: connCheck.rows[0].status });
        }
      } else {
        const blocked = memoryBlocks.some(b => 
          (b.blockerId === userA && b.blockedId === userB) || 
          (b.blockerId === userB && b.blockedId === userA)
        );
        if (blocked) return callback(null, { status: 'BLOCKED' });

        const conn = connectionStore.findConnection(c => 
          (c.senderId === userA && c.receiverId === userB) || 
          (c.senderId === userB && c.receiverId === userA)
        );
        if (conn) {
          statusStr = conn.status;
        }
        return callback(null, { status: statusStr });
      }

      callback(null, { status: 'NONE' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  }
});

const PORT = process.env.CONNECTION_PORT || '50052';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC Connection Service:', err);
    return;
  }
  console.log(`Connection Service running on port ${port}`);
});
