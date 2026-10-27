import mongoose, { Document, Model, Schema } from "mongoose";

export type CandidateStatus =
    | "Active"
    | "Suspended"
    | "Self-deactivated"
    | "Pending deletion"
    | "Anonymised";

export type CandidateSource = "Email" | "Google" | "LinkedIn" | "Apple";

export interface ICandidateResume {
    filename: string;
    url: string;
    uploadedAt: Date | string;
    size: string;
    atsScore: number;
    templateId?: string;
    templateName?: string;
    isDefault: boolean;
    summary?: string;
    atsValidated?: boolean;
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

export interface ICandidateConsentRecord {
    customId?: string;
    purpose: string;
    version: string;
    consentedAt: Date | string;
    ipAddress: string;
    status: "Granted" | "Revoked";
}

export interface ICandidateOAuthAccount {
    provider: string;
    email: string;
    linkedAt?: Date | string;
    status: string;
}

export interface ICandidateLoginHistory {
    id?: string;
    timestamp?: Date | string;
    ipAddress?: string;
    device?: string;
    location?: string;
}

export interface ICandidate extends Document {
    customId: string;
    name: string;
    headline: string;
    summary?: string;
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
    consentRecords: ICandidateConsentRecord[];
    privacySettings: {
        publicProfile: boolean;
        visibleToEmployers: boolean;
        allowSearchIndexing: boolean;
        publicProfileSlug: string;
        dataDownloadStatus: "Available" | "Generating" | "None";
    };
    resumes: ICandidateResume[];
    staffNotes: ICandidateStaffNote[];
    linkedOAuthAccounts?: ICandidateOAuthAccount[];
    loginHistory?: ICandidateLoginHistory[];
    savedJobIds: string[];
    lastActive?: Date | string;
    createdAt: Date;
    updatedAt: Date;
    toMaskedJSON(): Record<string, any>;
}

export const CANDIDATE_STATUSES: CandidateStatus[] = [
    "Active",
    "Suspended",
    "Self-deactivated",
    "Pending deletion",
    "Anonymised",
];

export const CANDIDATE_SOURCES: CandidateSource[] = [
    "Email",
    "Google",
    "LinkedIn",
    "Apple",
];

const candidateSchema = new Schema<ICandidate>(
    {
        customId: {
            type: String,
            required: [true, "Candidate custom ID is required"],
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
        summary: {
            type: String,
            trim: true,
            default: "",
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
            default: "",
        },
        location: {
            type: String,
            required: [true, "Location is required"],
            trim: true,
            index: true,
        },
        status: {
            type: String,
            enum: {
                values: CANDIDATE_STATUSES,
                message: "{VALUE} is not a valid candidate status",
            },
            default: "Active",
            index: true,
        },
        statusReason: {
            type: String,
            trim: true,
            default: "",
        },
        completion: {
            type: Number,
            default: 0,
            min: [0, "Completion percentage cannot be less than 0"],
            max: [100, "Completion percentage cannot exceed 100"],
            index: true,
        },
        source: {
            type: String,
            enum: {
                values: CANDIDATE_SOURCES,
                message: "{VALUE} is not a valid candidate source",
            },
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
            min: 0,
        },
        skills: {
            type: [String],
            default: [],
            index: true,
        },
        socialLinks: {
            linkedin: { type: String, trim: true, default: "" },
            portfolio: { type: String, trim: true, default: "" },
            github: { type: String, trim: true, default: "" },
            twitter: { type: String, trim: true, default: "" },
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
                customId: { type: String },
                purpose: { type: String, required: true },
                version: { type: String, required: true },
                consentedAt: { type: Schema.Types.Mixed, default: Date.now },
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
                summary: { type: String, default: "" },
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
        linkedOAuthAccounts: [
            {
                provider: { type: String, required: true },
                email: { type: String, required: true },
                linkedAt: { type: Schema.Types.Mixed, default: Date.now },
                status: { type: String, default: "Connected" },
            },
        ],
        loginHistory: [
            {
                id: { type: String },
                timestamp: { type: Schema.Types.Mixed, default: Date.now },
                ipAddress: { type: String, default: "" },
                device: { type: String, default: "" },
                location: { type: String, default: "" },
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

// Indexes for directory searches, filtering and sorting
candidateSchema.index({ name: 1, email: 1, customId: 1 });
candidateSchema.index({ createdAt: -1 });

/**
 * DPDP-safe email masking: aarav.mehta@example.com -> aa***@example.com
 */
export function maskEmail(email: string): string {
    if (!email || typeof email !== "string") return "***";
    const trimmed = email.trim();
    const atIndex = trimmed.indexOf("@");
    if (atIndex <= 0) return "***";
    const user = trimmed.slice(0, atIndex);
    const domain = trimmed.slice(atIndex + 1);
    const visiblePrefixLength = user.length > 2 ? 2 : 1;
    const prefix = user.slice(0, visiblePrefixLength);
    return `${prefix}***@${domain}`;
}

/**
 * DPDP-safe phone masking: +91 9876543210 -> +91 98765 *****
 */
export function maskPhone(phone?: string): string {
    if (!phone || typeof phone !== "string") return "";
    const clean = phone.trim();
    if (clean.length < 5) return "***";
    // Preserve prefix such as country code + first 5-6 digits
    const visiblePart = clean.slice(0, Math.min(8, clean.length - 4));
    return `${visiblePart} *****`;
}

/**
 * Redact sensitive PII from candidate document for safe API serialization
 */
candidateSchema.methods.toMaskedJSON = function (): Record<string, any> {
    const obj = this.toObject();
    obj.emailMasked = maskEmail(obj.email);
    obj.phoneMasked = maskPhone(obj.phone);
    delete obj.email;
    delete obj.phone;
    if (Array.isArray(obj.resumes)) {
        obj.resumes = obj.resumes.map((r: any) => ({
            ...r,
            url: "[Protected - Requires DPDP Justification]",
        }));
    }
    return obj;
};

export const Candidate: Model<ICandidate> = mongoose.model<ICandidate>("Candidate", candidateSchema);
export default Candidate;
