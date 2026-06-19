import * as fs from 'fs';
import * as path from 'path';
import { ConnectionStore, defaultMockConnections } from './store';

const TEST_FILE_PATH = path.join(process.cwd(), 'test_connections_backup.json');

describe('ConnectionStore', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
  });

  afterAll(() => {
    if (fs.existsSync(TEST_FILE_PATH)) {
      fs.unlinkSync(TEST_FILE_PATH);
    }
  });

  it('should initialize with default mock connections if no file exists', () => {
    const store = new ConnectionStore(TEST_FILE_PATH);
    const connections = store.getAllConnections();
    expect(connections.length).toBe(defaultMockConnections.length);
    expect(fs.existsSync(TEST_FILE_PATH)).toBe(true);
  });

  it('should load connections from existing file', () => {
    const mockData = [
      { senderId: 'user-a', receiverId: 'user-b', status: 'ACCEPTED' }
    ];
    fs.writeFileSync(TEST_FILE_PATH, JSON.stringify(mockData));

    const store = new ConnectionStore(TEST_FILE_PATH);
    const connections = store.getAllConnections();
    
    expect(connections.length).toBe(1);
    expect(connections[0].senderId).toBe('user-a');
  });

  it('should save new connection to the file', () => {
    const store = new ConnectionStore(TEST_FILE_PATH);
    const initialCount = store.getAllConnections().length;
    
    store.addConnection({ senderId: 'user-c', receiverId: 'user-d', status: 'PENDING' });

    expect(store.getAllConnections().length).toBe(initialCount + 1);

    const fileData = JSON.parse(fs.readFileSync(TEST_FILE_PATH, 'utf-8'));
    expect(fileData.length).toBe(initialCount + 1);
    expect(fileData[fileData.length - 1].senderId).toBe('user-c');
  });

  it('should remove a connection and update the file', () => {
    const mockData = [
      { senderId: 'user-a', receiverId: 'user-b', status: 'ACCEPTED' }
    ];
    fs.writeFileSync(TEST_FILE_PATH, JSON.stringify(mockData));

    const store = new ConnectionStore(TEST_FILE_PATH);
    expect(store.getAllConnections().length).toBe(1);

    store.removeConnectionByIndex(0);
    expect(store.getAllConnections().length).toBe(0);

    const fileData = JSON.parse(fs.readFileSync(TEST_FILE_PATH, 'utf-8'));
    expect(fileData.length).toBe(0);
  });
});
