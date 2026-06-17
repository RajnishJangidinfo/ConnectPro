"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const grpc = __importStar(require("@grpc/grpc-js"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv = __importStar(require("dotenv"));
const shared_1 = require("shared");
const profile_model_1 = require("./profile.model");
dotenv.config();
let isMongoConnected = false;
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/connectpro_profile';
mongoose_1.default.connect(mongoUrl)
    .then(() => {
    console.log('Profile MongoDB connected successfully');
    isMongoConnected = true;
})
    .catch(err => {
    console.warn('\n⚠️ [DATABASE WARNING]: MongoDB is offline. Profile Service is falling back to IN-MEMORY profile store!\n');
    isMongoConnected = false;
});
const protoPackage = (0, shared_1.loadServiceDefinition)('profile');
const profileService = protoPackage.profile.ProfileService.service;
const server = new grpc.Server();
// In-Memory Profile Fallback Registry
const memoryProfiles = [];
const mapDbProfileToProto = (profile) => {
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
        workExperience: (profile.workExperience || []).map((w) => ({
            id: w._id?.toString() || w.id || 'w-id',
            title: w.title,
            company: w.company,
            description: w.description || '',
            startDate: w.startDate ? (w.startDate instanceof Date ? w.startDate.toISOString() : w.startDate) : '',
            endDate: w.endDate ? (w.endDate instanceof Date ? w.endDate.toISOString() : w.endDate) : '',
            isCurrent: w.isCurrent || false,
        })),
        education: (profile.education || []).map((e) => ({
            id: e._id?.toString() || e.id || 'e-id',
            institution: e.institution,
            degree: e.degree,
            field: e.field,
            startDate: e.startDate ? (e.startDate instanceof Date ? e.startDate.toISOString() : e.startDate) : '',
            endDate: e.endDate ? (e.endDate instanceof Date ? e.endDate.toISOString() : e.endDate) : '',
        })),
        skills: (profile.skills || []).map((s) => ({
            id: s._id?.toString() || s.id || 's-id',
            name: s.name,
        })),
    };
};
server.addService(profileService, {
    getProfile: async (call, callback) => {
        try {
            const { userId } = call.request;
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const profile = await profile_model_1.ProfileModel.findOne({ userId });
                if (!profile) {
                    return callback({ code: grpc.status.NOT_FOUND, message: 'Profile not found' });
                }
                callback(null, mapDbProfileToProto(profile));
            }
            else {
                const profile = memoryProfiles.find(p => p.userId === userId);
                if (!profile) {
                    // Return default mock profile if requested from feed initially
                    const defaultUsername = userId.includes('sophia') ? 'sophia.reyes' : userId.includes('james') ? 'james.kim' : userId.includes('leila') ? 'leila.patel' : 'member.user';
                    const defaultMock = {
                        id: `prof-${userId}`,
                        userId,
                        username: defaultUsername,
                        firstName: userId.includes('sophia') ? 'Sophia' : userId.includes('james') ? 'James' : userId.includes('leila') ? 'Leila' : 'Member',
                        lastName: userId.includes('sophia') ? 'Reyes' : userId.includes('james') ? 'Kim' : userId.includes('leila') ? 'Patel' : 'User',
                        headline: userId.includes('sophia') ? 'Head of Design at Stripe' : userId.includes('james') ? 'CTO at NovaTech' : userId.includes('leila') ? 'VP Product at Airbnb' : 'ConnectPro Member',
                        bio: 'Hi, welcome to my profile!',
                        location: 'San Francisco, CA',
                        privacy: { profileVisible: true, showViews: true, openToWork: false }
                    };
                    return callback(null, mapDbProfileToProto(defaultMock));
                }
                callback(null, mapDbProfileToProto(profile));
            }
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    createProfile: async (call, callback) => {
        try {
            const { userId, firstName, lastName, headline, bio, location, username } = call.request;
            // Generate username: use provided or auto-generate from firstName.lastName
            const generateUsername = async (base) => {
                let candidate = base.toLowerCase().replace(/[^a-z0-9.]/g, '');
                if (!candidate)
                    candidate = 'user';
                if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                    let suffix = 0;
                    let finalName = candidate;
                    while (await profile_model_1.ProfileModel.findOne({ username: finalName })) {
                        suffix++;
                        finalName = `${candidate}${suffix}`;
                    }
                    return finalName;
                }
                else {
                    let suffix = 0;
                    let finalName = candidate;
                    while (memoryProfiles.find(p => p.username === finalName)) {
                        suffix++;
                        finalName = `${candidate}${suffix}`;
                    }
                    return finalName;
                }
            };
            const finalUsername = username ? username : await generateUsername(`${firstName}.${lastName}`);
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const existing = await profile_model_1.ProfileModel.findOne({ userId });
                if (existing) {
                    return callback({ code: grpc.status.ALREADY_EXISTS, message: 'Profile already exists' });
                }
                const newProfile = new profile_model_1.ProfileModel({
                    userId, username: finalUsername, firstName, lastName, headline, bio, location,
                    privacy: { profileVisible: true, showViews: true, openToWork: false }
                });
                await newProfile.save();
                callback(null, mapDbProfileToProto(newProfile));
            }
            else {
                const existing = memoryProfiles.find(p => p.userId === userId);
                if (existing) {
                    return callback({ code: grpc.status.ALREADY_EXISTS, message: 'Profile already exists' });
                }
                const newProfile = {
                    id: `prof-${Date.now()}`,
                    userId, username: finalUsername, firstName, lastName, headline, bio, location,
                    privacy: { profileVisible: true, showViews: true, openToWork: false },
                    skills: [], workExperience: [], education: []
                };
                memoryProfiles.push(newProfile);
                callback(null, mapDbProfileToProto(newProfile));
            }
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    updateProfile: async (call, callback) => {
        try {
            const { userId, firstName, lastName, headline, bio, location, profilePicture, coverPhoto, website, githubUrl, linkedinUrl, privacy, workExperience, education, skills, username } = call.request;
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const profile = await profile_model_1.ProfileModel.findOne({ userId });
                if (!profile) {
                    return callback({ code: grpc.status.NOT_FOUND, message: 'Profile not found' });
                }
                if (firstName)
                    profile.firstName = firstName;
                if (lastName)
                    profile.lastName = lastName;
                if (headline !== undefined)
                    profile.headline = headline;
                if (bio !== undefined)
                    profile.bio = bio;
                if (location !== undefined)
                    profile.location = location;
                if (profilePicture !== undefined)
                    profile.profilePicture = profilePicture;
                if (coverPhoto !== undefined)
                    profile.coverPhoto = coverPhoto;
                if (website !== undefined)
                    profile.website = website;
                if (githubUrl !== undefined)
                    profile.githubUrl = githubUrl;
                if (linkedinUrl !== undefined)
                    profile.linkedinUrl = linkedinUrl;
                if (username)
                    profile.username = username;
                if (privacy) {
                    profile.privacy = {
                        profileVisible: privacy.profileVisible,
                        showViews: privacy.showViews,
                        openToWork: privacy.openToWork
                    };
                }
                if (workExperience) {
                    profile.workExperience = workExperience.map((w) => ({
                        title: w.title, company: w.company, description: w.description,
                        startDate: new Date(w.startDate), endDate: w.endDate ? new Date(w.endDate) : undefined, isCurrent: w.isCurrent
                    }));
                }
                if (education) {
                    profile.education = education.map((e) => ({
                        institution: e.institution, degree: e.degree, field: e.field,
                        startDate: new Date(e.startDate), endDate: new Date(e.endDate)
                    }));
                }
                if (skills) {
                    profile.skills = skills.map((s) => ({ name: s.name }));
                }
                await profile.save();
                callback(null, mapDbProfileToProto(profile));
            }
            else {
                let profile = memoryProfiles.find(p => p.userId === userId);
                if (!profile) {
                    // Create default and insert
                    profile = {
                        id: `prof-${userId}`,
                        userId, firstName: firstName || 'Member', lastName: lastName || 'User',
                        headline: headline || 'ConnectPro Professional', bio: bio || '', location: location || '',
                        skills: [], workExperience: [], education: [],
                        privacy: { profileVisible: true, showViews: true, openToWork: false }
                    };
                    memoryProfiles.push(profile);
                }
                if (firstName)
                    profile.firstName = firstName;
                if (lastName)
                    profile.lastName = lastName;
                if (headline !== undefined)
                    profile.headline = headline;
                if (bio !== undefined)
                    profile.bio = bio;
                if (location !== undefined)
                    profile.location = location;
                if (profilePicture !== undefined)
                    profile.profilePicture = profilePicture;
                if (coverPhoto !== undefined)
                    profile.coverPhoto = coverPhoto;
                if (website !== undefined)
                    profile.website = website;
                if (githubUrl !== undefined)
                    profile.githubUrl = githubUrl;
                if (linkedinUrl !== undefined)
                    profile.linkedinUrl = linkedinUrl;
                if (username)
                    profile.username = username;
                if (privacy)
                    profile.privacy = privacy;
                if (workExperience)
                    profile.workExperience = workExperience;
                if (education)
                    profile.education = education;
                if (skills)
                    profile.skills = skills;
                callback(null, mapDbProfileToProto(profile));
            }
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    deleteProfile: async (call, callback) => {
        try {
            const { userId } = call.request;
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const result = await profile_model_1.ProfileModel.deleteOne({ userId });
                if (result.deletedCount === 0) {
                    return callback(null, { success: false, message: 'Profile not found' });
                }
            }
            else {
                const idx = memoryProfiles.findIndex(p => p.userId === userId);
                if (idx === -1) {
                    return callback(null, { success: false, message: 'Profile not found' });
                }
                memoryProfiles.splice(idx, 1);
            }
            callback(null, { success: true, message: 'Profile deleted successfully' });
        }
        catch (err) {
            callback({ code: grpc.status.INTERNAL, message: err.message });
        }
    },
    searchProfiles: async (call, callback) => {
        try {
            const { username } = call.request;
            if (!username || !username.trim()) {
                return callback(null, { profiles: [] });
            }
            const searchTerm = username.trim().toLowerCase();
            let profiles = [];
            if (isMongoConnected && mongoose_1.default.connection.readyState === 1) {
                const regex = new RegExp(searchTerm, 'i');
                profiles = await profile_model_1.ProfileModel.find({
                    $or: [
                        { username: regex },
                        { firstName: regex },
                        { lastName: regex }
                    ]
                }).limit(20);
            }
            else {
                profiles = memoryProfiles.filter(p => {
                    const u = (p.username || '').toLowerCase();
                    const f = (p.firstName || '').toLowerCase();
                    const l = (p.lastName || '').toLowerCase();
                    return u.includes(searchTerm) || f.includes(searchTerm) || l.includes(searchTerm);
                }).slice(0, 20);
            }
            callback(null, { profiles: profiles.map(mapDbProfileToProto) });
        }
        catch (err) {
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
//# sourceMappingURL=server.js.map