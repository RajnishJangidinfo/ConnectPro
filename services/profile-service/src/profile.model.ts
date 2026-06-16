import mongoose, { Schema, Document } from 'mongoose';

export interface IWorkExperience {
  title: string;
  company: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
}

export interface IEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate: Date;
}

export interface ISkill {
  name: string;
}

export interface IPrivacySettings {
  profileVisible: boolean;
  showViews: boolean;
  openToWork: boolean;
}

export interface IProfile extends Document {
  userId: string;
  username: string;
  firstName: string;
  lastName: string;
  headline?: string;
  bio?: string;
  location?: string;
  profilePicture?: string;
  coverPhoto?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  privacy: IPrivacySettings;
  workExperience: IWorkExperience[];
  education: IEducation[];
  skills: ISkill[];
}

const WorkExperienceSchema = new Schema<IWorkExperience>({
  title: { type: String, required: true },
  company: { type: String, required: true },
  description: { type: String },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  isCurrent: { type: Boolean, default: false }
});

const EducationSchema = new Schema<IEducation>({
  institution: { type: String, required: true },
  degree: { type: String, required: true },
  field: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true }
});

const SkillSchema = new Schema<ISkill>({
  name: { type: String, required: true }
});

const PrivacySettingsSchema = new Schema<IPrivacySettings>({
  profileVisible: { type: Boolean, default: true },
  showViews: { type: Boolean, default: true },
  openToWork: { type: Boolean, default: false }
}, { _id: false });

const ProfileSchema = new Schema<IProfile>({
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

export const ProfileModel = mongoose.model<IProfile>('Profile', ProfileSchema);
