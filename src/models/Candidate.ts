import mongoose, { Document, Model, Schema } from "mongoose";

export type CandidateStatus =
    | "Active"
    | "Pending"
    | "Suspended"
    | "Self-deactivated"
    | "Pending deletion"
    | "Anonymised";

export type CandidateSource = "Email" | "Google" | "LinkedIn" | "Apple";

export interface ICandidateResume {
    filename: string;
    url: string;
    uploadedAt: Date;
    size: string;
    atsScore: number;
    templateId?: string;
    templateName?: string;
    isDefault: boolean;
}

export interface ICandidateStaffNote {
    author?: string;
    authorName?: string;
    authorAdminId?: string;
    note: string;
    createdAt?: Date | string;
}

export interface ICandidateExperience {
    role: string;
    company: string;
    duration: string;
    description: string;
}

export interface ICandidateEducation {
    degree: string;
    institution: string;
    year: string;
}

export interface ICandidate extends Document {
    customId: string;
    name: string;
    headline: string;
    email: string;
    phone?: string;
    location: string;
    status: CandidateStatus;
    statusReason?: string;
    completion: number;
    source: CandidateSource;
    pro: boolean;
    isEmailVerified: boolean;
    openToRemote: boolean;
    visibleToEmployers: boolean;
    recruiterViewsCount: number;
    skills: string[];
    socialLinks: {
        linkedin?: string;
        portfolio?: string;
        github?: string;
        twitter?: string;
    };
    experience: ICandidateExperience[];
    education: ICandidateEducation[];
    onboarding: {
        careerGoal?: string;
        targetRoles?: string[];
        preferredLocations?: string[];
        workMode?: string;
        wizardVersion?: string;
        completedSteps?: number;
        totalSteps?: number;
    };
    notificationPreferences: {
        jobAlerts: boolean;
        applicationUpdates: boolean;
        interviewReminders: boolean;
        messages: boolean;
        productUpdates: boolean;
        promotionalEmails: boolean;
        emailChannel: boolean;
        pushChannel: boolean;
        smsChannel: boolean;
    };
    consentRecords: Array<{
        purpose: string;
        version: string;
        consentedAt: Date;
        ipAddress: string;
        status: "Granted" | "Revoked";
    }>;
    privacySettings: {
        publicProfile: boolean;
        visibleToEmployers: boolean;
        allowSearchIndexing: boolean;
        publicProfileSlug: string;
        dataDownloadStatus: "Available" | "Generating" | "None";
    };
    resumes: ICandidateResume[];
    staffNotes: ICandidateStaffNote[];
    savedJobIds: string[];
    lastActive?: Date | string;
    createdAt: Date;
    updatedAt: Date;
    toMaskedJSON(): Record<string, any>;
}

export const CANDIDATE_STATUSES: CandidateStatus[] = [
    "Active",
    "Pending",
    "Suspended",
    "Self-deactivated",
    "Pending deletion",
    "Anonymised",
];

const candidateSchema = new Schema<ICandidate>(
    {
        customId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, "Candidate name is required"],
            trim: true,
            index: true,
        },
        headline: {
            type: String,
            required: [true, "Headline is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email address is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        location: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        status: {
            type: String,
            enum: CANDIDATE_STATUSES,
            default: "Active",
            index: true,
        },
        statusReason: {
            type: String,
            trim: true,
        },
        completion: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
            index: true,
        },
        source: {
            type: String,
            default: "Google",
            index: true,
        },
        pro: {
            type: Boolean,
            default: false,
            index: true,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
            index: true,
        },
        openToRemote: {
            type: Boolean,
            default: false,
            index: true,
        },
        visibleToEmployers: {
            type: Boolean,
            default: true,
            index: true,
        },
        recruiterViewsCount: {
            type: Number,
            default: 0,
        },
        skills: {
            type: [String],
            default: [],
            index: true,
        },
        socialLinks: {
            linkedin: { type: String, trim: true },
            portfolio: { type: String, trim: true },
            github: { type: String, trim: true },
            twitter: { type: String, trim: true },
        },
        experience: [
            {
                role: { type: String, required: true },
                company: { type: String, required: true },
                duration: { type: String, required: true },
                description: { type: String, default: "" },
            },
        ],
        education: [
            {
                degree: { type: String, required: true },
                institution: { type: String, required: true },
                year: { type: String, required: true },
            },
        ],
        onboarding: {
            careerGoal: { type: String, default: "" },
            targetRoles: { type: [String], default: [] },
            preferredLocations: { type: [String], default: [] },
            workMode: { type: String, default: "Hybrid" },
            wizardVersion: { type: String, default: "v2.0" },
            completedSteps: { type: Number, default: 0 },
            totalSteps: { type: Number, default: 4 },
        },
        notificationPreferences: {
            jobAlerts: { type: Boolean, default: true },
            applicationUpdates: { type: Boolean, default: true },
            interviewReminders: { type: Boolean, default: true },
            messages: { type: Boolean, default: true },
            productUpdates: { type: Boolean, default: false },
            promotionalEmails: { type: Boolean, default: false },
            emailChannel: { type: Boolean, default: true },
            pushChannel: { type: Boolean, default: true },
            smsChannel: { type: Boolean, default: false },
        },
        consentRecords: [
            {
                purpose: { type: String, required: true },
                version: { type: String, required: true },
                consentedAt: { type: Date, default: Date.now },
                ipAddress: { type: String, default: "" },
                status: { type: String, enum: ["Granted", "Revoked"], default: "Granted" },
            },
        ],
        privacySettings: {
            publicProfile: { type: Boolean, default: true },
            visibleToEmployers: { type: Boolean, default: true },
            allowSearchIndexing: { type: Boolean, default: true },
            publicProfileSlug: { type: String, default: "" },
            dataDownloadStatus: {
                type: String,
                enum: ["Available", "Generating", "None"],
                default: "None",
            },
        },
        resumes: [
            {
                filename: { type: String, required: true },
                url: { type: String, default: "" },
                uploadedAt: { type: Schema.Types.Mixed, default: Date.now },
                size: { type: String, default: "1.2 MB" },
                atsScore: { type: Number, default: 0 },
                templateId: { type: String },
                templateName: { type: String },
                isDefault: { type: Boolean, default: false },
                summary: { type: String },
                atsValidated: { type: Boolean, default: false },
            },
        ],
        staffNotes: [
            {
                author: { type: String },
                authorName: { type: String },
                authorAdminId: { type: String },
                note: { type: String, required: true },
                createdAt: { type: Schema.Types.Mixed, default: Date.now },
            },
        ],
        savedJobIds: {
            type: [String],
            default: [],
        },
        lastActive: {
            type: Schema.Types.Mixed,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound text index for global search across name, headline, skills, location
candidateSchema.index({
    name: "text",
    headline: "text",
    skills: "text",
    location: "text",
});

export function maskEmail(email: string): string {
    if (!email) return "";
    const parts = email.split("@");
    if (parts.length < 2) return "***";
    const user = parts[0];
    const domain = parts[1];
    const prefix = user.length > 2 ? user.slice(0, 2) : user.slice(0, 1);
    return `${prefix}***@${domain}`;
}

export function maskPhone(phone?: string): string {
    if (!phone) return "";
    const clean = phone.trim();
    if (clean.length < 5) return "***";
    const prefix = clean.slice(0, 8);
    return `${prefix} *****`;
}

candidateSchema.methods.toMaskedJSON = function (): Record<string, any> {
    const obj = this.toObject();
    obj.emailMasked = maskEmail(obj.email);
    obj.phoneMasked = maskPhone(obj.phone);
    delete obj.email;
    delete obj.phone;
    return obj;
};

export const Candidate: Model<ICandidate> = mongoose.model<ICandidate>("Candidate", candidateSchema);
export default Candidate;
