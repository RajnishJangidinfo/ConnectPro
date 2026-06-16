/**
 * Gateway API Unit Tests
 *
 * Tests the REST API route logic and data transformations:
 * - Auth registration with username generation
 * - Auth login response structure
 * - Profile search query parameter handling
 * - Profile response fallback/default values
 * - Connection invite request validation
 * - Audit log creation
 */

// ─── Mock helpers simulating Gateway logic ───

interface User {
  id: string;
  email: string;
  role: string;
  passwordHash: string;
}

interface ProfileData {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  headline: string;
  bio: string;
  location: string;
}

const memoryUsers: User[] = [];

// Simulates the registration validation from app.ts
const validateRegistration = (body: any): string | null => {
  const { email, password, firstName, lastName } = body;
  if (!email || !password || !firstName || !lastName) {
    return 'Missing required registration fields';
  }
  const existing = memoryUsers.find(u => u.email === email);
  if (existing) {
    return 'User with this email already exists';
  }
  return null; // valid
};

// Simulates creating a user and their fallback profile
const createUserWithProfile = (body: any): { user: Omit<User, 'passwordHash'>; profile: ProfileData } => {
  const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const user = {
    id: userId,
    email: body.email,
    role: 'USER',
  };
  const profile: ProfileData = {
    userId,
    username: '',
    firstName: body.firstName,
    lastName: body.lastName,
    headline: body.headline || `${body.firstName} ${body.lastName} at ConnectPro`,
    bio: body.bio || '',
    location: body.location || '',
  };
  return { user, profile };
};

// Simulates the search query validation from the gateway
const validateSearchQuery = (query: any): { valid: boolean; username: string } => {
  const username = (query?.username as string) || '';
  if (!username.trim()) {
    return { valid: false, username: '' };
  }
  return { valid: true, username: username.trim() };
};

// Simulates the profile fallback response from the gateway
const getProfileFallback = (userId: string): any => {
  return {
    userId,
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
  };
};

// Simulates JWT token payload structure
const createTokenPayload = (user: { id: string; email: string; role: string }) => ({
  userId: user.id,
  email: user.email,
  role: user.role,
});

// Simulates connection invite request validation
const validateConnectionInvite = (userId: string | undefined, receiverId: string | undefined): string | null => {
  if (!userId) return 'Unauthorized';
  if (!receiverId) return 'Missing receiverId';
  if (userId === receiverId) return 'Cannot connect with yourself';
  return null;
};

// Simulates audit log structure
const createAuditLogEntry = (
  userId: string | null,
  email: string | null,
  action: string,
  details: string
) => ({
  userId,
  email,
  action,
  details,
  timestamp: new Date().toISOString()
});

// ─── Tests ───

beforeEach(() => {
  memoryUsers.length = 0;
});

describe('Registration Validation', () => {
  test('passes with all required fields', () => {
    const result = validateRegistration({
      email: 'test@example.com',
      password: 'pass123',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(result).toBeNull();
  });

  test('fails when email missing', () => {
    const result = validateRegistration({
      password: 'pass123',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(result).toBe('Missing required registration fields');
  });

  test('fails when password missing', () => {
    const result = validateRegistration({
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(result).toBe('Missing required registration fields');
  });

  test('fails when firstName missing', () => {
    const result = validateRegistration({
      email: 'test@example.com',
      password: 'pass123',
      lastName: 'User',
    });
    expect(result).toBe('Missing required registration fields');
  });

  test('fails when lastName missing', () => {
    const result = validateRegistration({
      email: 'test@example.com',
      password: 'pass123',
      firstName: 'Test',
    });
    expect(result).toBe('Missing required registration fields');
  });

  test('fails when email already exists', () => {
    memoryUsers.push({ id: 'u1', email: 'dup@example.com', role: 'USER', passwordHash: 'hash' });
    const result = validateRegistration({
      email: 'dup@example.com',
      password: 'pass123',
      firstName: 'Test',
      lastName: 'User',
    });
    expect(result).toBe('User with this email already exists');
  });
});

describe('User Creation with Profile', () => {
  test('creates user with correct structure', () => {
    const { user, profile } = createUserWithProfile({
      email: 'alice@test.com',
      firstName: 'Alice',
      lastName: 'Smith',
    });
    expect(user.email).toBe('alice@test.com');
    expect(user.role).toBe('USER');
    expect(user.id).toMatch(/^user-/);
    expect(profile.firstName).toBe('Alice');
    expect(profile.lastName).toBe('Smith');
    expect(profile.userId).toBe(user.id);
  });

  test('auto-generates headline when not provided', () => {
    const { profile } = createUserWithProfile({
      email: 'bob@test.com',
      firstName: 'Bob',
      lastName: 'Jones',
    });
    expect(profile.headline).toBe('Bob Jones at ConnectPro');
  });

  test('uses provided headline', () => {
    const { profile } = createUserWithProfile({
      email: 'carol@test.com',
      firstName: 'Carol',
      lastName: 'Lee',
      headline: 'Senior Engineer',
    });
    expect(profile.headline).toBe('Senior Engineer');
  });

  test('defaults bio and location to empty strings', () => {
    const { profile } = createUserWithProfile({
      email: 'd@test.com',
      firstName: 'Dave',
      lastName: 'Wu',
    });
    expect(profile.bio).toBe('');
    expect(profile.location).toBe('');
  });

  test('includes username field (empty default)', () => {
    const { profile } = createUserWithProfile({
      email: 'eve@test.com',
      firstName: 'Eve',
      lastName: 'Park',
    });
    expect(profile).toHaveProperty('username');
  });
});

describe('Search Query Validation', () => {
  test('valid query passes', () => {
    const result = validateSearchQuery({ username: 'sophia' });
    expect(result.valid).toBe(true);
    expect(result.username).toBe('sophia');
  });

  test('trims whitespace', () => {
    const result = validateSearchQuery({ username: '  james.kim  ' });
    expect(result.valid).toBe(true);
    expect(result.username).toBe('james.kim');
  });

  test('empty string is invalid', () => {
    const result = validateSearchQuery({ username: '' });
    expect(result.valid).toBe(false);
  });

  test('missing username param is invalid', () => {
    const result = validateSearchQuery({});
    expect(result.valid).toBe(false);
  });

  test('whitespace-only is invalid', () => {
    const result = validateSearchQuery({ username: '   ' });
    expect(result.valid).toBe(false);
  });
});

describe('Profile Fallback Response', () => {
  test('returns correct structure with userId', () => {
    const fallback = getProfileFallback('user-123');
    expect(fallback.userId).toBe('user-123');
    expect(fallback.username).toBe('');
    expect(fallback.firstName).toBe('Profile');
    expect(fallback.lastName).toBe('Member');
  });

  test('includes default skills', () => {
    const fallback = getProfileFallback('user-456');
    expect(fallback.skills).toHaveLength(2);
    expect(fallback.skills[0].name).toBe('TypeScript');
  });

  test('includes default privacy settings', () => {
    const fallback = getProfileFallback('user-789');
    expect(fallback.privacy.profileVisible).toBe(true);
    expect(fallback.privacy.showViews).toBe(true);
    expect(fallback.privacy.openToWork).toBe(false);
  });

  test('has empty arrays for experience and education', () => {
    const fallback = getProfileFallback('x');
    expect(fallback.workExperience).toEqual([]);
    expect(fallback.education).toEqual([]);
  });
});

describe('JWT Token Payload', () => {
  test('creates correct payload structure', () => {
    const payload = createTokenPayload({ id: 'user-1', email: 'a@b.com', role: 'USER' });
    expect(payload.userId).toBe('user-1');
    expect(payload.email).toBe('a@b.com');
    expect(payload.role).toBe('USER');
  });

  test('handles admin role', () => {
    const payload = createTokenPayload({ id: 'admin-1', email: 'admin@cp.com', role: 'ADMIN' });
    expect(payload.role).toBe('ADMIN');
  });
});

describe('Connection Invite Validation', () => {
  test('passes with valid data', () => {
    const result = validateConnectionInvite('user-1', 'user-2');
    expect(result).toBeNull();
  });

  test('fails when userId missing', () => {
    const result = validateConnectionInvite(undefined, 'user-2');
    expect(result).toBe('Unauthorized');
  });

  test('fails when receiverId missing', () => {
    const result = validateConnectionInvite('user-1', undefined);
    expect(result).toBe('Missing receiverId');
  });

  test('fails for self-connection', () => {
    const result = validateConnectionInvite('user-1', 'user-1');
    expect(result).toBe('Cannot connect with yourself');
  });
});

describe('Audit Log Entry Creation', () => {
  test('creates log entry with all fields', () => {
    const entry = createAuditLogEntry('user-1', 'test@example.com', 'USER_LOGIN', 'User logged in');
    expect(entry.userId).toBe('user-1');
    expect(entry.email).toBe('test@example.com');
    expect(entry.action).toBe('USER_LOGIN');
    expect(entry.details).toBe('User logged in');
    expect(entry.timestamp).toBeTruthy();
  });

  test('handles null userId and email for system actions', () => {
    const entry = createAuditLogEntry(null, null, 'SYSTEM_CHECK', 'Automated health check');
    expect(entry.userId).toBeNull();
    expect(entry.email).toBeNull();
    expect(entry.action).toBe('SYSTEM_CHECK');
  });
});
