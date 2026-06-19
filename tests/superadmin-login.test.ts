/**
 * Super Admin Login & Authorization Unit Tests
 *
 * Tests the complete Super Admin authentication and authorization flow:
 * - Login validation (email/password required)
 * - JWT token payload with SUPER_ADMIN role
 * - Super Admin middleware authorization
 * - Admin-or-above middleware authorization
 * - Role-based access control for admin endpoints
 * - Admin user management operations (role update, status toggle)
 * - Deactivated account login prevention
 * - Audit log creation for admin actions
 */

import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

// ─── Constants matching gateway config ───

const JWT_SECRET = process.env.JWT_SECRET || '7LbxFqc707';

// ─── Mock Data Store ───

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

let mockUsers: MockUser[] = [];

// ─── Helper Functions (matching gateway logic) ───

/** Simulates login validation from gateway app.ts */
const validateLogin = (body: any): string | null => {
  if (!body.email || !body.password) {
    return 'Email and password are required';
  }
  return null;
};

/** Simulates finding a user by email */
const findUserByEmail = (email: string): MockUser | undefined => {
  return mockUsers.find(u => u.email === email);
};

/** Simulates login flow: validates credentials, checks active status, returns token */
const performLogin = async (email: string, password: string): Promise<{
  success: boolean;
  status: number;
  data: any;
}> => {
  const validationError = validateLogin({ email, password });
  if (validationError) {
    return { success: false, status: 400, data: { error: validationError } };
  }

  const user = findUserByEmail(email);
  if (!user) {
    return { success: false, status: 401, data: { error: 'Invalid email or password' } };
  }

  // Check deactivated account
  if (user.isActive === false) {
    return { success: false, status: 403, data: { error: 'Your account has been deactivated. Please contact support.' } };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return { success: false, status: 401, data: { error: 'Invalid email or password' } };
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    success: true,
    status: 200,
    data: {
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, role: user.role }
    }
  };
};

/** Simulates JWT verification (authenticateJWT middleware) */
const verifyToken = (token: string): { valid: boolean; user?: { userId: string; email: string; role: string }; error?: string } => {
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return {
      valid: true,
      user: {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role || 'USER'
      }
    };
  } catch (err) {
    return { valid: false, error: 'Token is invalid or expired' };
  }
};

/** Simulates requireSuperAdmin middleware */
const checkSuperAdmin = (user: { role: string } | null): { allowed: boolean; status: number; error?: string } => {
  if (!user) return { allowed: false, status: 401, error: 'Unauthorized' };
  if (user.role !== 'SUPER_ADMIN') return { allowed: false, status: 403, error: 'Forbidden: Super Admin access required' };
  return { allowed: true, status: 200 };
};

/** Simulates requireAdminOrAbove middleware */
const checkAdminOrAbove = (user: { role: string } | null): { allowed: boolean; status: number; error?: string } => {
  if (!user) return { allowed: false, status: 401, error: 'Unauthorized' };
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') return { allowed: false, status: 403, error: 'Forbidden: Admin access required' };
  return { allowed: true, status: 200 };
};

/** Simulates role update validation */
const validateRoleUpdate = (role: string | undefined): string | null => {
  const validRoles = ['USER', 'ADMIN', 'SUPER_ADMIN'];
  if (!role || !validRoles.includes(role)) {
    return `role must be one of: ${validRoles.join(', ')}`;
  }
  return null;
};

/** Simulates status toggle validation */
const validateStatusToggle = (isActive: any): string | null => {
  if (typeof isActive !== 'boolean') {
    return 'isActive must be a boolean';
  }
  return null;
};

/** Simulates audit log entry creation */
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

// ─── Test Setup ───

beforeEach(async () => {
  mockUsers = [];

  // Create the Super Admin user (Rajnish@mailinator.com)
  const superAdminHash = await bcrypt.hash('Admin@123', 10);
  mockUsers.push({
    id: '3f5a4ed4-527e-42ef-be7c-d456f196157b',
    email: 'Rajnish@mailinator.com',
    passwordHash: superAdminHash,
    role: 'SUPER_ADMIN',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Create a regular user
  const userHash = await bcrypt.hash('User@123', 10);
  mockUsers.push({
    id: 'regular-user-001',
    email: 'regular@mailinator.com',
    passwordHash: userHash,
    role: 'USER',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Create an ADMIN user
  const adminHash = await bcrypt.hash('Admin@456', 10);
  mockUsers.push({
    id: 'admin-user-001',
    email: 'admin@mailinator.com',
    passwordHash: adminHash,
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date().toISOString()
  });

  // Create a deactivated user
  const deactivatedHash = await bcrypt.hash('Deactivated@123', 10);
  mockUsers.push({
    id: 'deactivated-user-001',
    email: 'deactivated@mailinator.com',
    passwordHash: deactivatedHash,
    role: 'USER',
    isActive: false,
    createdAt: new Date().toISOString()
  });
});

// ─── Tests ───

describe('Super Admin Login Validation', () => {
  test('rejects login when email is missing', () => {
    const error = validateLogin({ password: 'Admin@123' });
    expect(error).toBe('Email and password are required');
  });

  test('rejects login when password is missing', () => {
    const error = validateLogin({ email: 'Rajnish@mailinator.com' });
    expect(error).toBe('Email and password are required');
  });

  test('rejects login when both email and password are missing', () => {
    const error = validateLogin({});
    expect(error).toBe('Email and password are required');
  });

  test('passes validation with email and password', () => {
    const error = validateLogin({ email: 'Rajnish@mailinator.com', password: 'Admin@123' });
    expect(error).toBeNull();
  });
});

describe('Super Admin Login Flow', () => {
  test('successfully logs in with correct credentials', async () => {
    const result = await performLogin('Rajnish@mailinator.com', 'Admin@123');
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data.message).toBe('Login successful');
    expect(result.data.token).toBeTruthy();
    expect(result.data.user.email).toBe('Rajnish@mailinator.com');
    expect(result.data.user.role).toBe('SUPER_ADMIN');
  });

  test('rejects login with wrong password', async () => {
    const result = await performLogin('Rajnish@mailinator.com', 'WrongPassword');
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.data.error).toBe('Invalid email or password');
  });

  test('rejects login with non-existent email', async () => {
    const result = await performLogin('nobody@mailinator.com', 'Admin@123');
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.data.error).toBe('Invalid email or password');
  });

  test('rejects login for deactivated account', async () => {
    const result = await performLogin('deactivated@mailinator.com', 'Deactivated@123');
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.data.error).toBe('Your account has been deactivated. Please contact support.');
  });
});

describe('Super Admin JWT Token', () => {
  test('token contains correct SUPER_ADMIN role', async () => {
    const loginResult = await performLogin('Rajnish@mailinator.com', 'Admin@123');
    expect(loginResult.success).toBe(true);

    const verified = verifyToken(loginResult.data.token);
    expect(verified.valid).toBe(true);
    expect(verified.user!.role).toBe('SUPER_ADMIN');
    expect(verified.user!.email).toBe('Rajnish@mailinator.com');
    expect(verified.user!.userId).toBe('3f5a4ed4-527e-42ef-be7c-d456f196157b');
  });

  test('regular user token contains USER role', async () => {
    const loginResult = await performLogin('regular@mailinator.com', 'User@123');
    expect(loginResult.success).toBe(true);

    const verified = verifyToken(loginResult.data.token);
    expect(verified.valid).toBe(true);
    expect(verified.user!.role).toBe('USER');
  });

  test('admin user token contains ADMIN role', async () => {
    const loginResult = await performLogin('admin@mailinator.com', 'Admin@456');
    expect(loginResult.success).toBe(true);

    const verified = verifyToken(loginResult.data.token);
    expect(verified.valid).toBe(true);
    expect(verified.user!.role).toBe('ADMIN');
  });

  test('invalid token is rejected', () => {
    const verified = verifyToken('invalid.token.here');
    expect(verified.valid).toBe(false);
    expect(verified.error).toBe('Token is invalid or expired');
  });

  test('token signed with wrong secret is rejected', () => {
    const fakeToken = jwt.sign({ userId: 'x', email: 'x@test.com', role: 'SUPER_ADMIN' }, 'wrong_secret');
    const verified = verifyToken(fakeToken);
    expect(verified.valid).toBe(false);
  });
});

describe('Super Admin Middleware Authorization', () => {
  test('allows SUPER_ADMIN role', () => {
    const result = checkSuperAdmin({ role: 'SUPER_ADMIN' });
    expect(result.allowed).toBe(true);
    expect(result.status).toBe(200);
  });

  test('rejects ADMIN role', () => {
    const result = checkSuperAdmin({ role: 'ADMIN' });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe('Forbidden: Super Admin access required');
  });

  test('rejects USER role', () => {
    const result = checkSuperAdmin({ role: 'USER' });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  test('rejects null user (unauthenticated)', () => {
    const result = checkSuperAdmin(null);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe('Unauthorized');
  });
});

describe('Admin-or-Above Middleware Authorization', () => {
  test('allows SUPER_ADMIN role', () => {
    const result = checkAdminOrAbove({ role: 'SUPER_ADMIN' });
    expect(result.allowed).toBe(true);
  });

  test('allows ADMIN role', () => {
    const result = checkAdminOrAbove({ role: 'ADMIN' });
    expect(result.allowed).toBe(true);
  });

  test('rejects USER role', () => {
    const result = checkAdminOrAbove({ role: 'USER' });
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe('Forbidden: Admin access required');
  });

  test('rejects null user (unauthenticated)', () => {
    const result = checkAdminOrAbove(null);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe('Super Admin: Role Update Validation', () => {
  test('accepts valid role USER', () => {
    expect(validateRoleUpdate('USER')).toBeNull();
  });

  test('accepts valid role ADMIN', () => {
    expect(validateRoleUpdate('ADMIN')).toBeNull();
  });

  test('accepts valid role SUPER_ADMIN', () => {
    expect(validateRoleUpdate('SUPER_ADMIN')).toBeNull();
  });

  test('rejects invalid role', () => {
    const error = validateRoleUpdate('MODERATOR');
    expect(error).toBe('role must be one of: USER, ADMIN, SUPER_ADMIN');
  });

  test('rejects empty role', () => {
    const error = validateRoleUpdate('');
    expect(error).toBeTruthy();
  });

  test('rejects undefined role', () => {
    const error = validateRoleUpdate(undefined);
    expect(error).toBeTruthy();
  });
});

describe('Super Admin: Status Toggle Validation', () => {
  test('accepts isActive = true', () => {
    expect(validateStatusToggle(true)).toBeNull();
  });

  test('accepts isActive = false', () => {
    expect(validateStatusToggle(false)).toBeNull();
  });

  test('rejects string value', () => {
    expect(validateStatusToggle('true')).toBe('isActive must be a boolean');
  });

  test('rejects number value', () => {
    expect(validateStatusToggle(1)).toBe('isActive must be a boolean');
  });

  test('rejects undefined', () => {
    expect(validateStatusToggle(undefined)).toBe('isActive must be a boolean');
  });
});

describe('Super Admin: Full Auth Flow Integration', () => {
  test('Super Admin logs in → gets token → token authorizes admin endpoints', async () => {
    // Step 1: Login
    const loginResult = await performLogin('Rajnish@mailinator.com', 'Admin@123');
    expect(loginResult.success).toBe(true);

    // Step 2: Verify token
    const verified = verifyToken(loginResult.data.token);
    expect(verified.valid).toBe(true);

    // Step 3: Check super admin access
    const superAdminAccess = checkSuperAdmin(verified.user!);
    expect(superAdminAccess.allowed).toBe(true);

    // Step 4: Check admin-or-above access
    const adminAccess = checkAdminOrAbove(verified.user!);
    expect(adminAccess.allowed).toBe(true);
  });

  test('Regular user logs in → token does NOT authorize admin endpoints', async () => {
    // Step 1: Login
    const loginResult = await performLogin('regular@mailinator.com', 'User@123');
    expect(loginResult.success).toBe(true);

    // Step 2: Verify token
    const verified = verifyToken(loginResult.data.token);
    expect(verified.valid).toBe(true);
    expect(verified.user!.role).toBe('USER');

    // Step 3: Super admin access denied
    const superAdminAccess = checkSuperAdmin(verified.user!);
    expect(superAdminAccess.allowed).toBe(false);
    expect(superAdminAccess.status).toBe(403);

    // Step 4: Admin-or-above access denied
    const adminAccess = checkAdminOrAbove(verified.user!);
    expect(adminAccess.allowed).toBe(false);
    expect(adminAccess.status).toBe(403);
  });

  test('ADMIN user can access admin endpoints but NOT super admin endpoints', async () => {
    const loginResult = await performLogin('admin@mailinator.com', 'Admin@456');
    expect(loginResult.success).toBe(true);

    const verified = verifyToken(loginResult.data.token);
    expect(verified.valid).toBe(true);

    // Admin-or-above: allowed
    const adminAccess = checkAdminOrAbove(verified.user!);
    expect(adminAccess.allowed).toBe(true);

    // Super admin only: denied
    const superAdminAccess = checkSuperAdmin(verified.user!);
    expect(superAdminAccess.allowed).toBe(false);
    expect(superAdminAccess.status).toBe(403);
  });
});

describe('Super Admin: Audit Logging for Admin Actions', () => {
  test('creates audit log for role change', () => {
    const log = createAuditLogEntry(
      '3f5a4ed4-527e-42ef-be7c-d456f196157b',
      'Rajnish@mailinator.com',
      'ADMIN_UPDATE_ROLE',
      'Changed role of user regular@mailinator.com to ADMIN.'
    );
    expect(log.action).toBe('ADMIN_UPDATE_ROLE');
    expect(log.email).toBe('Rajnish@mailinator.com');
    expect(log.details).toContain('Changed role');
    expect(log.timestamp).toBeTruthy();
  });

  test('creates audit log for account deactivation', () => {
    const log = createAuditLogEntry(
      '3f5a4ed4-527e-42ef-be7c-d456f196157b',
      'Rajnish@mailinator.com',
      'ADMIN_DEACTIVATE_USER',
      'Deactivated account for user regular@mailinator.com.'
    );
    expect(log.action).toBe('ADMIN_DEACTIVATE_USER');
    expect(log.details).toContain('Deactivated');
  });

  test('creates audit log for account activation', () => {
    const log = createAuditLogEntry(
      '3f5a4ed4-527e-42ef-be7c-d456f196157b',
      'Rajnish@mailinator.com',
      'ADMIN_ACTIVATE_USER',
      'Activated account for user deactivated@mailinator.com.'
    );
    expect(log.action).toBe('ADMIN_ACTIVATE_USER');
    expect(log.details).toContain('Activated');
  });

  test('creates audit log for super admin login', () => {
    const log = createAuditLogEntry(
      '3f5a4ed4-527e-42ef-be7c-d456f196157b',
      'Rajnish@mailinator.com',
      'USER_LOGIN',
      'User logged in successfully.'
    );
    expect(log.action).toBe('USER_LOGIN');
    expect(log.userId).toBe('3f5a4ed4-527e-42ef-be7c-d456f196157b');
  });
});

describe('Password Reset Operations (New Features)', () => {
  test('forgot password flow: updates password and returns login token', async () => {
    const email = 'regular@mailinator.com';
    const newPassword = 'NewSecretPassword@123';
    
    const user = mockUsers.find(u => u.email === email);
    expect(user).toBeTruthy();
    
    const hashed = await bcrypt.hash(newPassword, 10);
    user!.passwordHash = hashed;
    
    const loginResult = await performLogin(email, newPassword);
    expect(loginResult.success).toBe(true);
    expect(loginResult.data.token).toBeTruthy();
    expect(loginResult.data.user.email).toBe(email);
  });

  test('admin resets a user password: direct hash updates', async () => {
    const email = 'regular@mailinator.com';
    const newPassword = 'AdminResetPass@123';
    
    const user = mockUsers.find(u => u.email === email);
    expect(user).toBeTruthy();
    
    const preMatch = await bcrypt.compare(newPassword, user!.passwordHash);
    expect(preMatch).toBe(false);
    
    const adminHashed = await bcrypt.hash(newPassword, 10);
    user!.passwordHash = adminHashed;
    
    const postMatch = await bcrypt.compare(newPassword, user!.passwordHash);
    expect(postMatch).toBe(true);
  });
});
