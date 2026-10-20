import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICandidateAuditLog extends Document {
    candidateId: mongoose.Types.ObjectId;
    candidateCustomId: string;
    adminId: string;
    adminName: string;
    adminRole: string;
    action: "UNMASK_PII" | "STATUS_CHANGE" | "FORCE_VERIFY_EMAIL" | "ADD_NOTE" | "BULK_ACTION" | "DELETE_REQUEST";
    justification?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    timestamp: Date;
}

const candidateAuditLogSchema = new Schema<ICandidateAuditLog>(
    {
        candidateId: {
            type: Schema.Types.ObjectId,
            ref: "Candidate",
            required: true,
            index: true,
        },
        candidateCustomId: {
            type: String,
            required: true,
            index: true,
        },
        adminId: {
            type: String,
            required: true,
        },
        adminName: {
            type: String,
            required: true,
        },
        adminRole: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            enum: ["UNMASK_PII", "STATUS_CHANGE", "FORCE_VERIFY_EMAIL", "ADD_NOTE", "BULK_ACTION", "DELETE_REQUEST"],
            required: true,
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
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

export const CandidateAuditLog: Model<ICandidateAuditLog> = mongoose.model<ICandidateAuditLog>(
    "CandidateAuditLog",
    candidateAuditLogSchema
);

export default CandidateAuditLog;
