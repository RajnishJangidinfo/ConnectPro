import * as grpc from '@grpc/grpc-js';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { loadServiceDefinition } from 'shared';
import { ProfileModel } from './profile.model';
import { ProfileStore } from './store';

dotenv.config();

let isMongoConnected = false;

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/connectpro_profile';
mongoose.connect(mongoUrl)
  .then(async () => {
    console.log('Profile MongoDB connected successfully');
    isMongoConnected = true;
    try {
      // Seed default profiles if MongoDB is connected but empty
      const defaultUsers = [
        { userId: 'sophia-reyes-uuid', username: 'sophia.reyes', firstName: 'Sophia', lastName: 'Reyes', headline: 'Head of Design at Stripe', location: 'San Francisco, CA' },
        { userId: 'james-kim-uuid', username: 'james.kim', firstName: 'James', lastName: 'Kim', headline: 'CTO at NovaTech', location: 'New York, NY' },
        { userId: 'leila-patel-uuid', username: 'leila.patel', firstName: 'Leila', lastName: 'Patel', headline: 'VP Product at Airbnb', location: 'Los Angeles, CA' },
        { userId: 'alex-morgan-uuid', username: 'alex.morgan', firstName: 'Alex', lastName: 'Morgan', headline: 'Software Engineer', location: 'Seattle, WA' }
      ];
      for (const u of defaultUsers) {
        const existing = await ProfileModel.findOne({ userId: u.userId });
        if (!existing) {
          await ProfileModel.create({
            userId: u.userId,
            username: u.username,
            firstName: u.firstName,
            lastName: u.lastName,
            headline: u.headline,
            bio: 'Hi, welcome to my profile!',
            location: u.location,
            privacy: { profileVisible: true, showViews: true, openToWork: false }
          });
        }
      }
    } catch (e) {}
  })
  .catch(err => {
    console.warn('\n⚠️ [DATABASE WARNING]: MongoDB is offline. Profile Service is falling back to IN-MEMORY profile store!\n');
    isMongoConnected = false;
  });

const protoPackage = loadServiceDefinition('profile');
const profileService = protoPackage.profile.ProfileService.service;

const server = new grpc.Server();

// Initialize Profile Store
const profileStore = new ProfileStore();

const MOCK_FIRST_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Oliver', 'Sophia', 'Elijah', 
  'Isabella', 'James', 'Amelia', 'Benjamin', 'Mia', 'Lucas', 'Charlotte', 'Mason',
  'Harper', 'Ethan', 'Evelyn', 'Alexander', 'Abigail', 'Henry', 'Emily', 'Jacob'
];
const MOCK_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White'
];
const MOCK_HEADLINES = [
  'Software Engineer at Google',
  'Product Manager at Meta',
  'UX Designer at Apple',
  'Data Scientist at Netflix',
  'Engineering Manager at Uber',
  'Solutions Architect at AWS',
  'Full Stack Developer at Stripe',
  'Frontend Engineer at Vercel',
  'Backend Developer at Microsoft',
  'Mobile Engineer at Spotify',
  'VP of Engineering at OpenAI',
  'DevOps Architect at Salesforce'
];
const MOCK_LOCATIONS = [
  'San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX',
  'Boston, MA', 'Denver, CO', 'Chicago, IL', 'Los Angeles, CA',
  'London, UK', 'Berlin, Germany', 'Toronto, Canada', 'Sydney, Australia'
];

const getDeterministicProfile = (userId: string) => {
  if (userId.includes('sophia')) {
    return {
      firstName: 'Sophia',
      lastName: 'Reyes',
      headline: 'Head of Design at Stripe',
      username: 'sophia.reyes',
      location: 'San Francisco, CA'
    };
  }
  if (userId.includes('james')) {
    return {
      firstName: 'James',
      lastName: 'Kim',
      headline: 'CTO at NovaTech',
      username: 'james.kim',
      location: 'New York, NY'
    };
  }
  if (userId.includes('leila')) {
    return {
      firstName: 'Leila',
      lastName: 'Patel',
      headline: 'VP Product at Airbnb',
      username: 'leila.patel',
      location: 'Los Angeles, CA'
    };
  }
  if (userId.includes('alex')) {
    return {
      firstName: 'Alex',
      lastName: 'Morgan',
      headline: 'Software Engineer',
      username: 'alex.morgan',
      location: 'Seattle, WA'
    };
  }

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash);
  const firstName = MOCK_FIRST_NAMES[index % MOCK_FIRST_NAMES.length];
  const lastName = MOCK_LAST_NAMES[index % MOCK_LAST_NAMES.length];
  const headline = MOCK_HEADLINES[(index + 3) % MOCK_HEADLINES.length];
  const location = MOCK_LOCATIONS[(index + 7) % MOCK_LOCATIONS.length];
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  return { firstName, lastName, headline, username, location };
};

const mapDbProfileToProto = (profile: any) => {
  return {
    id: profile._id?.toString() || profile.id || 'mock-id',
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
      id: w._id?.toString() || w.id || 'w-id',
      title: w.title,
      company: w.company,
      description: w.description || '',
      startDate: w.startDate ? (w.startDate instanceof Date ? w.startDate.toISOString() : w.startDate) : '',
      endDate: w.endDate ? (w.endDate instanceof Date ? w.endDate.toISOString() : w.endDate) : '',
      isCurrent: w.isCurrent || false,
    })),
    education: (profile.education || []).map((e: any) => ({
      id: e._id?.toString() || e.id || 'e-id',
      institution: e.institution,
      degree: e.degree,
      field: e.field,
      startDate: e.startDate ? (e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate) : '',
      endDate: e.endDate ? (e.endDate instanceof Date ? e.endDate.toISOString() : e.endDate) : '',
    })),
    skills: (profile.skills || []).map((s: any) => ({
      id: s._id?.toString() || s.id || 's-id',
      name: s.name,
    })),
  };
};

server.addService(profileService, {
  getProfile: async (call: any, callback: any) => {
    try {
      const { userId } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        let profile = await ProfileModel.findOne({ userId });
        if (!profile) {
          // Return deterministic mock profile if not found in DB so demo flows stay populated
          const mockData = getDeterministicProfile(userId);
          profile = await ProfileModel.create({
            userId,
            username: mockData.username,
            firstName: mockData.firstName,
            lastName: mockData.lastName,
            headline: mockData.headline,
            bio: 'Hi, welcome to my profile!',
            location: mockData.location,
            privacy: { profileVisible: true, showViews: true, openToWork: false }
          });
        }
        callback(null, mapDbProfileToProto(profile));
      } else {
        // Fallback to memory
        let profile = profileStore.getProfileByUserId(userId);
        if (!profile) {
          // Return deterministic mock profile if not found in memory, and save it to memory so it's searchable
          const mockData = getDeterministicProfile(userId);
          profile = {
            id: `prof-${userId}`,
            userId,
            username: mockData.username,
            firstName: mockData.firstName,
            lastName: mockData.lastName,
            headline: mockData.headline,
            bio: 'Hi, welcome to my profile!',
            location: mockData.location,
            privacy: { profileVisible: true, showViews: true, openToWork: false }
          };
          profileStore.addProfile(profile);
        }
        callback(null, mapDbProfileToProto(profile));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },
  createProfile: async (call: any, callback: any) => {
    try {
      const { userId, firstName, lastName, headline, bio, location, username } = call.request;

      // Generate username: use provided or auto-generate from firstName.lastName
      const generateUsername = async (base: string): Promise<string> => {
        let candidate = base.toLowerCase().replace(/[^a-z0-9.]/g, '');
        if (!candidate) candidate = 'user';
        if (isMongoConnected && mongoose.connection.readyState === 1) {
          let suffix = 0;
          let finalName = candidate;
          while (await ProfileModel.findOne({ username: finalName })) {
            suffix++;
            finalName = `${candidate}${suffix}`;
          }
          return finalName;
        } else {
          let suffix = 0;
          let finalName = candidate;
          while (profileStore.getProfileByUsername(finalName)) {
            suffix++;
            finalName = `${candidate}${suffix}`;
          }
          return finalName;
        }
      };

      const finalUsername = username ? username : await generateUsername(`${firstName}.${lastName}`);

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const existing = await ProfileModel.findOne({ userId });
        if (existing) {
          return callback({ code: grpc.status.ALREADY_EXISTS, message: 'Profile already exists' });
        }
        const newProfile = new ProfileModel({
          userId, username: finalUsername, firstName, lastName, headline, bio, location,
          privacy: { profileVisible: true, showViews: true, openToWork: false }
        });
        await newProfile.save();
        callback(null, mapDbProfileToProto(newProfile));
      } else {
        // fallback
        const exists = profileStore.getProfileByUserId(userId);
        if (exists) {
          return callback({ code: grpc.status.ALREADY_EXISTS, message: 'Profile already exists' });
        }
        const newProfile = {
          id: `prof-${Date.now()}`,
          userId, username: finalUsername, firstName, lastName, headline, bio, location,
          privacy: { profileVisible: true, showViews: true, openToWork: false },
          skills: [], workExperience: [], education: []
        };
        profileStore.addProfile(newProfile);
        callback(null, mapDbProfileToProto(newProfile));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },
  updateProfile: async (call: any, callback: any) => {
    try {
      const {
        userId, firstName, lastName, headline, bio, location,
        profilePicture, coverPhoto, website, githubUrl, linkedinUrl,
        privacy, workExperience, education, skills, username
      } = call.request;

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const profile = await ProfileModel.findOne({ userId });
        if (!profile) {
          return callback({ code: grpc.status.NOT_FOUND, message: 'Profile not found' });
        }

        if (firstName) profile.firstName = firstName;
        if (lastName) profile.lastName = lastName;
        if (headline !== undefined) profile.headline = headline;
        if (bio !== undefined) profile.bio = bio;
        if (location !== undefined) profile.location = location;
        if (profilePicture !== undefined) profile.profilePicture = profilePicture;
        if (coverPhoto !== undefined) profile.coverPhoto = coverPhoto;
        if (website !== undefined) profile.website = website;
        if (githubUrl !== undefined) profile.githubUrl = githubUrl;
        if (linkedinUrl !== undefined) profile.linkedinUrl = linkedinUrl;
        if (username) profile.username = username;
        if (privacy) {
          profile.privacy = {
            profileVisible: privacy.profileVisible,
            showViews: privacy.showViews,
            openToWork: privacy.openToWork
          };
        }
        if (workExperience) {
          profile.workExperience = workExperience.map((w: any) => ({
            title: w.title, company: w.company, description: w.description,
            startDate: new Date(w.startDate), endDate: w.endDate ? new Date(w.endDate) : undefined, isCurrent: w.isCurrent
          }));
        }
        if (education) {
          profile.education = education.map((e: any) => ({
            institution: e.institution, degree: e.degree, field: e.field,
            startDate: new Date(e.startDate), endDate: new Date(e.endDate)
          }));
        }
        if (skills) {
          profile.skills = skills.map((s: any) => ({ name: s.name }));
        }

        await profile.save();
        callback(null, mapDbProfileToProto(profile));
      } else {
        let profile = profileStore.getProfileByUserId(userId);
        if (!profile) {
          // Create default and insert
          const mockData = getDeterministicProfile(userId);
          profile = {
            id: `prof-${userId}`,
            userId, 
            firstName: firstName || mockData.firstName, 
            lastName: lastName || mockData.lastName,
            headline: headline || mockData.headline, 
            bio: bio || '', 
            location: location || mockData.location,
            skills: [], workExperience: [], education: [],
            privacy: { profileVisible: true, showViews: true, openToWork: false }
          };
          profileStore.addProfile(profile);
        }

        if (firstName) profile.firstName = firstName;
        if (lastName) profile.lastName = lastName;
        if (headline !== undefined) profile.headline = headline;
        if (bio !== undefined) profile.bio = bio;
        if (location !== undefined) profile.location = location;
        if (profilePicture !== undefined) profile.profilePicture = profilePicture;
        if (coverPhoto !== undefined) profile.coverPhoto = coverPhoto;
        if (website !== undefined) profile.website = website;
        if (githubUrl !== undefined) profile.githubUrl = githubUrl;
        if (linkedinUrl !== undefined) profile.linkedinUrl = linkedinUrl;
        if (username) profile.username = username;
        if (privacy) profile.privacy = privacy;
        if (workExperience) profile.workExperience = workExperience;
        if (education) profile.education = education;
        if (skills) profile.skills = skills;

        profileStore.save();
        callback(null, mapDbProfileToProto(profile));
      }
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },
  deleteProfile: async (call: any, callback: any) => {
    try {
      const { userId } = call.request;
      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const result = await ProfileModel.deleteOne({ userId });
        if (result.deletedCount === 0) {
          return callback(null, { success: false, message: 'Profile not found' });
        }
      } else {
        const idx = profileStore.getAllProfiles().findIndex(p => p.userId === userId);
        if (idx === -1) {
          return callback(null, { success: false, message: 'Profile not found' });
        }
        profileStore.getAllProfiles().splice(idx, 1);
        profileStore.save();
      }
      callback(null, { success: true, message: 'Profile deleted successfully' });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  },
  searchProfiles: async (call: any, callback: any) => {
    try {
      const { username } = call.request;
      if (!username || !username.trim()) {
        return callback(null, { profiles: [] });
      }
      const searchTerm = username.trim().toLowerCase();
      let profiles: any[] = [];

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        const regex = new RegExp(searchTerm, 'i');
        profiles = await ProfileModel.find({
          $or: [
            { username: regex },
            { firstName: regex },
            { lastName: regex }
          ]
        }).limit(20);
      } else {
        profiles = profileStore.getAllProfiles().filter(p => {
          const u = (p.username || '').toLowerCase();
          const f = (p.firstName || '').toLowerCase();
          const l = (p.lastName || '').toLowerCase();
          return u.includes(searchTerm) || f.includes(searchTerm) || l.includes(searchTerm);
        }).slice(0, 20);
      }

      callback(null, { profiles: profiles.map(mapDbProfileToProto) });
    } catch (err: any) {
      callback({ code: grpc.status.INTERNAL, message: err.message });
    }
  }
});

const PORT = process.env.PROFILE_PORT || '50051';
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) {
    console.error('Failed to bind gRPC Profile Service:', err);
    return;
  }
  console.log(`Profile Service running on port ${port}`);
});
