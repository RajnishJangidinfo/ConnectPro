import * as fs from 'fs';
import * as path from 'path';

export interface InMemoryConnection {
  senderId: string;
  receiverId: string;
  status: string;
}

export const defaultMockConnections: InMemoryConnection[] = [
  // Add some mock connections so network suggestion counts work initially
  { senderId: 'alex-morgan-uuid', receiverId: 'sophia-reyes-uuid', status: 'ACCEPTED' },
  { senderId: 'alex-morgan-uuid', receiverId: 'james-kim-uuid', status: 'ACCEPTED' },
  { senderId: 'alex-morgan-uuid', receiverId: 'leila-patel-uuid', status: 'ACCEPTED' },
  { senderId: 'sophia-reyes-uuid', receiverId: 'marcus-nguyen-uuid', status: 'ACCEPTED' },
  { senderId: 'sophia-reyes-uuid', receiverId: 'rachel-lim-uuid', status: 'ACCEPTED' },
  { senderId: 'james-kim-uuid', receiverId: 'tyler-osei-uuid', status: 'ACCEPTED' }
];

export class ConnectionStore {
  private filePath: string;
  private memoryConnections: InMemoryConnection[] = [];

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(process.cwd(), 'connections_backup.json');
    this.load();
  }

  public load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.memoryConnections = JSON.parse(data);
      } else {
        this.memoryConnections = [...defaultMockConnections];
        this.save();
      }
    } catch (e) {
      console.error("Failed to load connections backup:", e);
      this.memoryConnections = [...defaultMockConnections];
    }
  }

  public save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryConnections, null, 2));
    } catch (e) {
      console.error("Failed to save connections backup:", e);
    }
  }

  public getAllConnections(): InMemoryConnection[] {
    return this.memoryConnections;
  }

  public addConnection(connection: InMemoryConnection): void {
    this.memoryConnections.push(connection);
    this.save();
  }

  public findConnection(predicate: (c: InMemoryConnection) => boolean): InMemoryConnection | undefined {
    return this.memoryConnections.find(predicate);
  }

  public findIndex(predicate: (c: InMemoryConnection) => boolean): number {
    return this.memoryConnections.findIndex(predicate);
  }

  public removeConnectionByIndex(index: number): void {
    if (index >= 0 && index < this.memoryConnections.length) {
      this.memoryConnections.splice(index, 1);
      this.save();
    }
  }
}
