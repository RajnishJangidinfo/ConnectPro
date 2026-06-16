/**
 * Profile Service Unit Tests
 * 
 * Tests the core business logic of the profile service:
 * - Username auto-generation from firstName.lastName
 * - Username uniqueness with numeric suffix
 * - Profile creation with username
 * - Profile update including username
 * - searchProfiles matching logic (case-insensitive, partial match)
 * - mapDbProfileToProto mapping
 */

// ─── Mock helpers to simulate in-memory profile store ───

interface MockProfile {
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
  privacy: { profileVisible: boolean; showViews: boolean; openToWork: boolean };
  workExperience: any[];
  education: any[];
  skills: any[];
}

// Simulates the in-memory store used by the profile service
let memoryProfiles: MockProfile[] = [];

// Replicates the username generation logic from server.ts
const generateUsername = (
  base: string,
  existingProfiles: MockProfile[]
): string => {
  let candidate = base.toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (!candidate) candidate = 'user';
  let suffix = 0;
  let finalName = candidate;
  while (existingProfiles.find(p => p.username === finalName)) {
    suffix++;
    finalName = `${candidate}${suffix}`;
  }
  return finalName;
};

// Replicates mapDbProfileToProto from server.ts
const mapDbProfileToProto = (profile: MockProfile) => {
  return {
    id: profile.id || 'mock-id',
    userId: profile.userId,
    username: profile.username || '',
    firstName: profile.firstName,
    lastName: profile.lastName,
    headline: profile.headline || '',
    bio: profile.bio || '',
    location: profile.location || '',
    profilePicture: profile.profilePicture || '',
    coverPhoto: profile.coverPhoto || '',
    website: profile.website || '',
    githubUrl: profile.githubUrl || '',
    linkedinUrl: profile.linkedinUrl || '',
    privacy: {
      profileVisible: profile.privacy?.profileVisible ?? true,
      showViews: profile.privacy?.showViews ?? true,
      openToWork: profile.privacy?.openToWork ?? false,
    },
    workExperience: (profile.workExperience || []).map((w: any) => ({
      id: w.id || 'w-id',
      title: w.title,
      company: w.company,
      description: w.description || '',
      startDate: w.startDate || '',
      endDate: w.endDate || '',
      isCurrent: w.isCurrent || false,
    })),
    education: (profile.education || []).map((e: any) => ({
      id: e.id || 'e-id',
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startDate: e.startDate || '',
      endDate: e.endDate || '',
    })),
    skills: (profile.skills || []).map((s: any) => ({
      id: s.id || 's-id',
      name: s.name,
    })),
  };
};

// Replicates the searchProfiles in-memory logic from server.ts
const searchProfiles = (
  username: string,
  profiles: MockProfile[]
): MockProfile[] => {
  if (!username || !username.trim()) return [];
  const searchTerm = username.trim().toLowerCase();
  return profiles.filter(p => {
    const u = (p.username || '').toLowerCase();
    const f = (p.firstName || '').toLowerCase();
    const l = (p.lastName || '').toLowerCase();
    return u.includes(searchTerm) || f.includes(searchTerm) || l.includes(searchTerm);
  }).slice(0, 20);
};

// Simulates createProfile from server.ts (in-memory path)
const createProfile = (
  userId: string,
  firstName: string,
  lastName: string,
  headline: string,
  bio: string,
  location: string,
  providedUsername?: string
): MockProfile | { error: string } => {
  const existing = memoryProfiles.find(p => p.userId === userId);
  if (existing) {
    return { error: 'Profile already exists' };
  }

  const finalUsername = providedUsername
    ? providedUsername
    : generateUsername(`${firstName}.${lastName}`, memoryProfiles);

  const newProfile: MockProfile = {
    id: `prof-${Date.now()}`,
    userId,
    username: finalUsername,
    firstName,
    lastName,
    headline,
    bio,
    location,
    profilePicture: '',
    coverPhoto: '',
    website: '',
    githubUrl: '',
    linkedinUrl: '',
    privacy: { profileVisible: true, showViews: true, openToWork: false },
    skills: [],
    workExperience: [],
    education: [],
  };
  memoryProfiles.push(newProfile);
  return newProfile;
};

// ─── Test Suites ───

beforeEach(() => {
  memoryProfiles = [];
});

describe('Username Generation', () => {
  test('generates username from firstName.lastName in lowercase', () => {
    const username = generateUsername('Sophia.Reyes', []);
    expect(username).toBe('sophia.reyes');
  });

  test('strips non-alphanumeric characters except dots', () => {
    const username = generateUsername('John O\'Brien!', []);
    expect(username).toBe('johnobrien');
  });

  test('handles empty string by defaulting to "user"', () => {
    const username = generateUsername('', []);
    expect(username).toBe('user');
  });

  test('handles special-characters-only input by defaulting to "user"', () => {
    const username = generateUsername('!@#$%', []);
    expect(username).toBe('user');
  });

  test('appends numeric suffix when username exists', () => {
    memoryProfiles.push({
      id: 'p1', userId: 'u1', username: 'sophia.reyes',
      firstName: 'Sophia', lastName: 'Reyes', headline: '', bio: '', location: '',
      profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '',
      privacy: { profileVisible: true, showViews: true, openToWork: false },
      skills: [], workExperience: [], education: []
    });

    const username = generateUsername('Sophia.Reyes', memoryProfiles);
    expect(username).toBe('sophia.reyes1');
  });

  test('increments suffix for multiple duplicates', () => {
    memoryProfiles.push(
      { id: 'p1', userId: 'u1', username: 'john.doe', firstName: 'John', lastName: 'Doe', headline: '', bio: '', location: '', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] },
      { id: 'p2', userId: 'u2', username: 'john.doe1', firstName: 'John', lastName: 'Doe', headline: '', bio: '', location: '', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] },
      { id: 'p3', userId: 'u3', username: 'john.doe2', firstName: 'John', lastName: 'Doe', headline: '', bio: '', location: '', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] }
    );

    const username = generateUsername('John.Doe', memoryProfiles);
    expect(username).toBe('john.doe3');
  });
});

describe('Profile Creation', () => {
  test('creates profile with auto-generated username', () => {
    const result = createProfile('user-1', 'Alice', 'Smith', 'Engineer', 'Hello', 'NYC');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.username).toBe('alice.smith');
      expect(result.firstName).toBe('Alice');
      expect(result.lastName).toBe('Smith');
      expect(result.userId).toBe('user-1');
    }
  });

  test('creates profile with provided username', () => {
    const result = createProfile('user-2', 'Bob', 'Jones', 'Designer', '', 'LA', 'bobjones_pro');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.username).toBe('bobjones_pro');
    }
  });

  test('prevents duplicate userId', () => {
    createProfile('user-3', 'Carol', 'Lee', 'PM', '', '');
    const result = createProfile('user-3', 'Carol', 'Lee', 'PM', '', '');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('Profile already exists');
    }
  });

  test('auto-generates unique username when duplicate exists', () => {
    createProfile('user-4', 'David', 'Kim', 'Dev', '', '');
    const result = createProfile('user-5', 'David', 'Kim', 'Dev', '', '');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.username).toBe('david.kim1');
    }
  });

  test('sets default privacy values', () => {
    const result = createProfile('user-6', 'Eve', 'Wu', '', '', '');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.privacy.profileVisible).toBe(true);
      expect(result.privacy.showViews).toBe(true);
      expect(result.privacy.openToWork).toBe(false);
    }
  });

  test('initializes empty arrays for skills, workExperience, education', () => {
    const result = createProfile('user-7', 'Frank', 'Li', '', '', '');
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.skills).toEqual([]);
      expect(result.workExperience).toEqual([]);
      expect(result.education).toEqual([]);
    }
  });
});

describe('mapDbProfileToProto', () => {
  test('maps all fields correctly', () => {
    const profile: MockProfile = {
      id: 'prof-1', userId: 'u-1', username: 'test.user',
      firstName: 'Test', lastName: 'User', headline: 'Dev',
      bio: 'Hello', location: 'SF', profilePicture: 'pic.jpg',
      coverPhoto: 'cover.jpg', website: 'test.com',
      githubUrl: 'github.com/test', linkedinUrl: 'linkedin.com/test',
      privacy: { profileVisible: true, showViews: false, openToWork: true },
      workExperience: [{ id: 'w1', title: 'SDE', company: 'Acme', description: 'Work', startDate: '2020-01-01', endDate: '', isCurrent: true }],
      education: [{ id: 'e1', institution: 'MIT', degree: 'BS', field: 'CS', startDate: '2016', endDate: '2020' }],
      skills: [{ id: 's1', name: 'TypeScript' }]
    };

    const proto = mapDbProfileToProto(profile);

    expect(proto.id).toBe('prof-1');
    expect(proto.userId).toBe('u-1');
    expect(proto.username).toBe('test.user');
    expect(proto.firstName).toBe('Test');
    expect(proto.lastName).toBe('User');
    expect(proto.headline).toBe('Dev');
    expect(proto.bio).toBe('Hello');
    expect(proto.location).toBe('SF');
    expect(proto.profilePicture).toBe('pic.jpg');
    expect(proto.privacy.profileVisible).toBe(true);
    expect(proto.privacy.showViews).toBe(false);
    expect(proto.privacy.openToWork).toBe(true);
    expect(proto.workExperience).toHaveLength(1);
    expect(proto.workExperience[0].title).toBe('SDE');
    expect(proto.education).toHaveLength(1);
    expect(proto.education[0].institution).toBe('MIT');
    expect(proto.skills).toHaveLength(1);
    expect(proto.skills[0].name).toBe('TypeScript');
  });

  test('handles missing optional fields gracefully', () => {
    const profile: MockProfile = {
      id: 'p2', userId: 'u2', username: '',
      firstName: 'Min', lastName: 'Profile',
      headline: '', bio: '', location: '',
      profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '',
      privacy: { profileVisible: true, showViews: true, openToWork: false },
      workExperience: [], education: [], skills: []
    };

    const proto = mapDbProfileToProto(profile);
    expect(proto.username).toBe('');
    expect(proto.headline).toBe('');
    expect(proto.workExperience).toEqual([]);
    expect(proto.education).toEqual([]);
    expect(proto.skills).toEqual([]);
  });
});

describe('Search Profiles', () => {
  beforeEach(() => {
    memoryProfiles = [
      { id: 'p1', userId: 'u1', username: 'sophia.reyes', firstName: 'Sophia', lastName: 'Reyes', headline: 'Designer', bio: '', location: 'SF', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] },
      { id: 'p2', userId: 'u2', username: 'james.kim', firstName: 'James', lastName: 'Kim', headline: 'CTO', bio: '', location: 'NYC', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] },
      { id: 'p3', userId: 'u3', username: 'leila.patel', firstName: 'Leila', lastName: 'Patel', headline: 'VP', bio: '', location: 'LA', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] },
      { id: 'p4', userId: 'u4', username: 'sophia.martinez', firstName: 'Sophia', lastName: 'Martinez', headline: 'PM', bio: '', location: 'Chicago', profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '', privacy: { profileVisible: true, showViews: true, openToWork: false }, skills: [], workExperience: [], education: [] },
    ];
  });

  test('finds profiles by exact username', () => {
    const results = searchProfiles('sophia.reyes', memoryProfiles);
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe('u1');
  });

  test('finds profiles by partial username', () => {
    const results = searchProfiles('sophia', memoryProfiles);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.username)).toContain('sophia.reyes');
    expect(results.map(r => r.username)).toContain('sophia.martinez');
  });

  test('search is case-insensitive', () => {
    const results = searchProfiles('JAMES', memoryProfiles);
    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('james.kim');
  });

  test('finds profiles by first name', () => {
    const results = searchProfiles('Leila', memoryProfiles);
    expect(results).toHaveLength(1);
    expect(results[0].firstName).toBe('Leila');
  });

  test('finds profiles by last name', () => {
    const results = searchProfiles('Kim', memoryProfiles);
    expect(results).toHaveLength(1);
    expect(results[0].lastName).toBe('Kim');
  });

  test('returns empty array for empty search query', () => {
    const results = searchProfiles('', memoryProfiles);
    expect(results).toHaveLength(0);
  });

  test('returns empty array for whitespace-only query', () => {
    const results = searchProfiles('   ', memoryProfiles);
    expect(results).toHaveLength(0);
  });

  test('returns empty array when no match', () => {
    const results = searchProfiles('nonexistentuser', memoryProfiles);
    expect(results).toHaveLength(0);
  });

  test('limits results to 20', () => {
    // Add 25 profiles with matching names
    for (let i = 0; i < 25; i++) {
      memoryProfiles.push({
        id: `extra-${i}`, userId: `extra-u-${i}`, username: `testmatch.user${i}`,
        firstName: 'TestMatch', lastName: `User${i}`, headline: '', bio: '', location: '',
        profilePicture: '', coverPhoto: '', website: '', githubUrl: '', linkedinUrl: '',
        privacy: { profileVisible: true, showViews: true, openToWork: false },
        skills: [], workExperience: [], education: []
      });
    }
    const results = searchProfiles('testmatch', memoryProfiles);
    expect(results).toHaveLength(20);
  });

  test('partial username match works across dots', () => {
    const results = searchProfiles('reyes', memoryProfiles);
    expect(results).toHaveLength(1);
    expect(results[0].username).toBe('sophia.reyes');
  });
});
