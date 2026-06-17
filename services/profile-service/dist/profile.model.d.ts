import mongoose, { Document } from 'mongoose';
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
export declare const ProfileModel: mongoose.Model<IProfile, {}, {}, {}, mongoose.Document<unknown, {}, IProfile, {}, {}> & IProfile & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
