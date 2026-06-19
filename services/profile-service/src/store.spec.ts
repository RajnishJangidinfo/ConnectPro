import * as fs from 'fs';
import * as path from 'path';
import { ProfileStore, defaultMockProfiles } from './store';

const TEST_FILE_PATH = path.join(process.cwd(), 'test_profiles_backup.json');

describe('ProfileStore', () => {
  beforeEach(() => {
    // Clean up test file before each test
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
  });

  afterAll(() => {
    // Clean up test file after all tests finish
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
  });

  it('should initialize with default mock profiles if no file exists', () => {
    const store = new ProfileStore(TEST_FILE_PATH);
    const profiles = store.getAllProfiles();
    expect(profiles.length).toBe(defaultMockProfiles.length);
    expect(profiles[0].id).toBe(defaultMockProfiles[0].id);

    // It should have created the file
    expect(fs.existsSync(TEST_FILE_PATH)).toBe(true);
  });

  it('should load profiles from existing file', () => {
    const mockData = [
      { id: 'test-1', userId: 'user-1', username: 'test.user' }
    ];
    fs.writeFileSync(TEST_FILE_PATH, JSON.stringify(mockData));

    const store = new ProfileStore(TEST_FILE_PATH);
    const profiles = store.getAllProfiles();
    
    expect(profiles.length).toBe(1);
    expect(profiles[0].id).toBe('test-1');
  });

  it('should save new profile to the file', () => {
    const store = new ProfileStore(TEST_FILE_PATH);
    
    const initialCount = store.getAllProfiles().length;
    
    const newProfile = { id: 'test-new', userId: 'user-new', username: 'new.user' };
    store.addProfile(newProfile);

    // Check memory state
    expect(store.getAllProfiles().length).toBe(initialCount + 1);
    expect(store.getProfileByUserId('user-new')).toBeDefined();

    // Check file state
    const fileData = JSON.parse(fs.readFileSync(TEST_FILE_PATH, 'utf-8'));
    expect(fileData.length).toBe(initialCount + 1);
    expect(fileData[fileData.length - 1].id).toBe('test-new');
  });
});
