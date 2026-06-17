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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const WorkExperienceSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    company: { type: String, required: true },
    description: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false }
});
const EducationSchema = new mongoose_1.Schema({
    institution: { type: String, required: true },
    degree: { type: String, required: true },
    field: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }
});
const SkillSchema = new mongoose_1.Schema({
    name: { type: String, required: true }
});
const PrivacySettingsSchema = new mongoose_1.Schema({
    profileVisible: { type: Boolean, default: true },
    showViews: { type: Boolean, default: true },
    openToWork: { type: Boolean, default: false }
}, { _id: false });
const ProfileSchema = new mongoose_1.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    headline: { type: String },
    bio: { type: String },
    location: { type: String },
    profilePicture: { type: String, default: '' },
    coverPhoto: { type: String, default: '' },
    website: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    linkedinUrl: { type: String, default: '' },
    privacy: { type: PrivacySettingsSchema, default: () => ({}) },
    workExperience: { type: [WorkExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },
    skills: { type: [SkillSchema], default: [] }
}, {
    timestamps: true
});
exports.ProfileModel = mongoose_1.default.model('Profile', ProfileSchema);
//# sourceMappingURL=profile.model.js.map