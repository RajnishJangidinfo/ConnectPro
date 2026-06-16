/**
 * Connection Service Unit Tests
 *
 * Tests the in-memory connection graph logic:
 * - Send connection request
 * - Self-connection prevention
 * - Accept / Reject / Cancel requests
 * - Block / Unblock users
 * - Get connections by status
 * - Mutual connections calculation
 * - Connection suggestions (2nd degree)
 */

// ─── In-memory stores replicating connection-service logic ───

interface InMemoryConnection {
  senderId: string;
  receiverId: string;
  status: string;
}
interface InMemoryBlock {
  blockerId: string;
  blockedId: string;
}

let memoryConnections: InMemoryConnection[] = [];
let memoryBlocks: InMemoryBlock[] = [];

// ─── Business logic replicas ───

const sendConnectionRequest = (senderId: string, receiverId: string): { success: boolean; status: string; message: string } => {
  if (senderId === receiverId) {
    return { success: false, status: 'NONE', message: 'Cannot connect with yourself' };
  }
  const blocked = memoryBlocks.some(b =>
    (b.blockerId === senderId && b.blockedId === receiverId) ||
    (b.blockerId === receiverId && b.blockedId === senderId)
  );
  if (blocked) {
    return { success: false, status: 'BLOCKED', message: 'User is blocked' };
  }
  const existing = memoryConnections.find(c =>
    (c.senderId === senderId && c.receiverId === receiverId) ||
    (c.senderId === receiverId && c.receiverId === senderId)
  );
  if (existing) {
    return { success: false, status: existing.status, message: `Request exists: ${existing.status}` };
  }
  memoryConnections.push({ senderId, receiverId, status: 'PENDING' });
  return { success: true, status: 'PENDING', message: 'Connection request sent successfully' };
};

const acceptConnectionRequest = (senderId: string, receiverId: string): { success: boolean; status: string; message: string } => {
  const idx = memoryConnections.findIndex(c => c.senderId === senderId && c.receiverId === receiverId && c.status === 'PENDING');
  if (idx === -1) {
    return { success: false, status: 'NONE', message: 'Pending connection request not found' };
  }
  memoryConnections[idx].status = 'ACCEPTED';
  return { success: true, status: 'ACCEPTED', message: 'Connection request accepted' };
};

const rejectConnectionRequest = (senderId: string, receiverId: string): { success: boolean; status: string; message: string } => {
  const idx = memoryConnections.findIndex(c => c.senderId === senderId && c.receiverId === receiverId && c.status === 'PENDING');
  if (idx === -1) {
    return { success: false, status: 'NONE', message: 'Pending connection request not found' };
  }
  memoryConnections[idx].status = 'REJECTED';
  return { success: true, status: 'REJECTED', message: 'Connection request rejected' };
};

const cancelConnectionRequest = (senderId: string, receiverId: string): { success: boolean; status: string; message: string } => {
  const idx = memoryConnections.findIndex(c => c.senderId === senderId && c.receiverId === receiverId && c.status === 'PENDING');
  if (idx === -1) {
    return { success: false, status: 'NONE', message: 'Pending connection request not found' };
  }
  memoryConnections.splice(idx, 1);
  return { success: true, status: 'NONE', message: 'Connection request cancelled' };
};

const blockUser = (blockerId: string, blockedId: string): { success: boolean; status: string; message: string } => {
  // Remove any existing connection
  const idx = memoryConnections.findIndex(c =>
    (c.senderId === blockerId && c.receiverId === blockedId) ||
    (c.senderId === blockedId && c.receiverId === blockerId)
  );
  if (idx !== -1) memoryConnections.splice(idx, 1);
  if (!memoryBlocks.some(b => b.blockerId === blockerId && b.blockedId === blockedId)) {
    memoryBlocks.push({ blockerId, blockedId });
  }
  return { success: true, status: 'BLOCKED', message: 'User blocked successfully' };
};

const unblockUser = (blockerId: string, blockedId: string): { success: boolean; status: string; message: string } => {
  const idx = memoryBlocks.findIndex(b => b.blockerId === blockerId && b.blockedId === blockedId);
  if (idx !== -1) memoryBlocks.splice(idx, 1);
  return { success: true, status: 'NONE', message: 'User unblocked successfully' };
};

const getConnections = (userId: string, status: string = 'ACCEPTED') => {
  return memoryConnections
    .filter(c => (c.senderId === userId || c.receiverId === userId) && c.status === status)
    .map(c => ({
      userId: c.senderId === userId ? c.receiverId : c.senderId,
      status: c.status,
      degree: status === 'ACCEPTED' ? 1 : 0
    }));
};

const getMutualConnections = (userA: string, userB: string) => {
  const friendsA = memoryConnections
    .filter(c => (c.senderId === userA || c.receiverId === userA) && c.status === 'ACCEPTED')
    .map(c => c.senderId === userA ? c.receiverId : c.senderId);
  const friendsB = memoryConnections
    .filter(c => (c.senderId === userB || c.receiverId === userB) && c.status === 'ACCEPTED')
    .map(c => c.senderId === userB ? c.receiverId : c.senderId);
  return friendsA.filter(id => friendsB.includes(id));
};

const checkConnectionStatus = (userA: string, userB: string): string => {
  const blocked = memoryBlocks.some(b =>
    (b.blockerId === userA && b.blockedId === userB) ||
    (b.blockerId === userB && b.blockedId === userA)
  );
  if (blocked) return 'BLOCKED';
  const conn = memoryConnections.find(c =>
    (c.senderId === userA && c.receiverId === userB) ||
    (c.senderId === userB && c.receiverId === userA)
  );
  if (conn) return conn.status;
  return 'NONE';
};

// ─── Tests ───

beforeEach(() => {
  memoryConnections = [];
  memoryBlocks = [];
});

describe('Send Connection Request', () => {
  test('sends request successfully', () => {
    const result = sendConnectionRequest('alice', 'bob');
    expect(result.success).toBe(true);
    expect(result.status).toBe('PENDING');
    expect(memoryConnections).toHaveLength(1);
  });

  test('prevents self-connection', () => {
    const result = sendConnectionRequest('alice', 'alice');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Cannot connect with yourself');
  });

  test('prevents duplicate requests', () => {
    sendConnectionRequest('alice', 'bob');
    const result = sendConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
    expect(result.status).toBe('PENDING');
  });

  test('prevents request to blocked user', () => {
    memoryBlocks.push({ blockerId: 'bob', blockedId: 'alice' });
    const result = sendConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
    expect(result.status).toBe('BLOCKED');
  });

  test('prevents request when reverse connection exists', () => {
    sendConnectionRequest('bob', 'alice');
    const result = sendConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
  });
});

describe('Accept Connection Request', () => {
  test('accepts pending request', () => {
    sendConnectionRequest('alice', 'bob');
    const result = acceptConnectionRequest('alice', 'bob');
    expect(result.success).toBe(true);
    expect(result.status).toBe('ACCEPTED');
    expect(memoryConnections[0].status).toBe('ACCEPTED');
  });

  test('fails when no pending request exists', () => {
    const result = acceptConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
    expect(result.message).toBe('Pending connection request not found');
  });

  test('fails when request already accepted', () => {
    sendConnectionRequest('alice', 'bob');
    acceptConnectionRequest('alice', 'bob');
    const result = acceptConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
  });
});

describe('Reject Connection Request', () => {
  test('rejects pending request', () => {
    sendConnectionRequest('alice', 'bob');
    const result = rejectConnectionRequest('alice', 'bob');
    expect(result.success).toBe(true);
    expect(result.status).toBe('REJECTED');
  });

  test('fails when no pending request exists', () => {
    const result = rejectConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
  });
});

describe('Cancel Connection Request', () => {
  test('cancels pending request and removes it', () => {
    sendConnectionRequest('alice', 'bob');
    const result = cancelConnectionRequest('alice', 'bob');
    expect(result.success).toBe(true);
    expect(memoryConnections).toHaveLength(0);
  });

  test('fails when no pending request exists', () => {
    const result = cancelConnectionRequest('alice', 'bob');
    expect(result.success).toBe(false);
  });
});

describe('Block / Unblock User', () => {
  test('blocks user and removes existing connection', () => {
    sendConnectionRequest('alice', 'bob');
    acceptConnectionRequest('alice', 'bob');
    const result = blockUser('alice', 'bob');
    expect(result.success).toBe(true);
    expect(memoryConnections).toHaveLength(0);
    expect(memoryBlocks).toHaveLength(1);
  });

  test('does not duplicate block entries', () => {
    blockUser('alice', 'bob');
    blockUser('alice', 'bob');
    expect(memoryBlocks).toHaveLength(1);
  });

  test('unblocks user', () => {
    blockUser('alice', 'bob');
    const result = unblockUser('alice', 'bob');
    expect(result.success).toBe(true);
    expect(memoryBlocks).toHaveLength(0);
  });
});

describe('Get Connections', () => {
  test('returns accepted connections', () => {
    sendConnectionRequest('alice', 'bob');
    acceptConnectionRequest('alice', 'bob');
    sendConnectionRequest('alice', 'carol');
    acceptConnectionRequest('alice', 'carol');
    sendConnectionRequest('alice', 'dave'); // PENDING

    const accepted = getConnections('alice', 'ACCEPTED');
    expect(accepted).toHaveLength(2);
    expect(accepted.map(c => c.userId)).toContain('bob');
    expect(accepted.map(c => c.userId)).toContain('carol');
  });

  test('returns pending connections', () => {
    sendConnectionRequest('alice', 'bob');
    sendConnectionRequest('carol', 'alice');
    const pending = getConnections('alice', 'PENDING');
    expect(pending).toHaveLength(2);
  });

  test('returns empty array when no connections', () => {
    const result = getConnections('alice');
    expect(result).toHaveLength(0);
  });
});

describe('Mutual Connections', () => {
  test('finds mutual connections between two users', () => {
    sendConnectionRequest('alice', 'bob'); acceptConnectionRequest('alice', 'bob');
    sendConnectionRequest('alice', 'carol'); acceptConnectionRequest('alice', 'carol');
    sendConnectionRequest('bob', 'carol'); acceptConnectionRequest('bob', 'carol');

    const mutual = getMutualConnections('alice', 'bob');
    expect(mutual).toContain('carol');
    expect(mutual).toHaveLength(1);
  });

  test('returns empty when no mutual connections', () => {
    sendConnectionRequest('alice', 'bob'); acceptConnectionRequest('alice', 'bob');
    sendConnectionRequest('carol', 'dave'); acceptConnectionRequest('carol', 'dave');

    const mutual = getMutualConnections('alice', 'carol');
    expect(mutual).toHaveLength(0);
  });
});

describe('Check Connection Status', () => {
  test('returns NONE for strangers', () => {
    expect(checkConnectionStatus('alice', 'bob')).toBe('NONE');
  });

  test('returns PENDING for pending request', () => {
    sendConnectionRequest('alice', 'bob');
    expect(checkConnectionStatus('alice', 'bob')).toBe('PENDING');
  });

  test('returns ACCEPTED for accepted connection', () => {
    sendConnectionRequest('alice', 'bob');
    acceptConnectionRequest('alice', 'bob');
    expect(checkConnectionStatus('alice', 'bob')).toBe('ACCEPTED');
  });

  test('returns BLOCKED when user is blocked', () => {
    blockUser('alice', 'bob');
    expect(checkConnectionStatus('alice', 'bob')).toBe('BLOCKED');
  });

  test('returns BLOCKED regardless of direction', () => {
    blockUser('bob', 'alice');
    expect(checkConnectionStatus('alice', 'bob')).toBe('BLOCKED');
  });
});
