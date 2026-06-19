import * as fs from 'fs';
import * as path from 'path';

export const defaultMockProfiles: any[] = [];

export class ProfileStore {
  private filePath: string;
  private memoryProfiles: any[] = [];

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(process.cwd(), 'profiles_backup.json');
    this.load();
  }

  public load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.memoryProfiles = JSON.parse(data);
      } else {
        this.memoryProfiles = [...defaultMockProfiles];
        this.save();
      }
    } catch (e) {
      console.error("Failed to load profiles backup:", e);
      this.memoryProfiles = [...defaultMockProfiles];
    }
  }

  public save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryProfiles, null, 2));
    } catch (e) {
      console.error("Failed to save profiles backup:", e);
    }
  }

  public getAllProfiles(): any[] {
    return this.memoryProfiles;
  }

  public getProfileByUserId(userId: string): any | undefined {
    return this.memoryProfiles.find(p => p.userId === userId);
  }

  public getProfileByUsername(username: string): any | undefined {
    return this.memoryProfiles.find(p => p.username === username);
  }

  public addProfile(profile: any): void {
    this.memoryProfiles.push(profile);
    this.save();
  }
}
