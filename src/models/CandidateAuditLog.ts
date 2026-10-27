import mongoose, { Document, Model, Schema } from "mongoose";

export type CandidateAuditAction =
    | "UNMASK_PII"
    | "STATUS_CHANGE"
    | "FORCE_VERIFY_EMAIL"
    | "ADD_NOTE"
    | "BULK_ACTION"
    | "EXPORT_CSV";

export interface ICandidateAuditLog extends Document {
    candidateId?: mongoose.Types.ObjectId;
    candidateCustomId?: string;
    adminId: string;
    adminName: string;
    adminRole: string;
    action: CandidateAuditAction;
    justification?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}

const candidateAuditLogSchema = new Schema<ICandidateAuditLog>(
    {
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: "Candidate",
            index: true,
        },
        candidateCustomId: {
            type: String,
            index: true,
        },
        adminId: {
            type: String,
            required: [true, "Admin ID is required for audit logs"],
            index: true,
        },
        adminName: {
            type: String,
            required: [true, "Admin name is required"],
        },
        adminRole: {
            type: String,
            required: [true, "Admin role is required"],
            index: true,
        },
        action: {
            type: String,
            enum: [
                "UNMASK_PII",
                "STATUS_CHANGE",
                "FORCE_VERIFY_EMAIL",
                "ADD_NOTE",
                "BULK_ACTION",
                "EXPORT_CSV",
            ],
            required: [true, "Action is required"],
            index: true,
        },
        justification: {
            type: String,
            trim: true,
        },
        details: {
            type: Schema.Types.Mixed,
        },
        ipAddress: {
            type: String,
            default: "",
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound indexes for audit log queries
candidateAuditLogSchema.index({ candidateCustomId: 1, timestamp: -1 });
candidateAuditLogSchema.index({ adminId: 1, timestamp: -1 });

export const CandidateAuditLog: Model<ICandidateAuditLog> = mongoose.model<ICandidateAuditLog>(
    "CandidateAuditLog",
    candidateAuditLogSchema
);

export default CandidateAuditLog;
