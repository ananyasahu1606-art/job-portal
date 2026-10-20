import mongoose, { Document, Model, Schema } from "mongoose";
import bcrypt from "bcryptjs";

export type AdminRole =
    | "super-admin"
    | "operations-admin"
    | "moderator"
    | "content-manager"
    | "support-agent"
    | "finance"
    | "analyst";

export type AdminStatus = "active" | "inactive";

export interface IAdmin extends Document {
    name: string;
    email: string;
    password?: string;
    role: AdminRole;
    status: AdminStatus;
    twoFactorEnabled: boolean;
    lastLogin?: Date;
    createdAt: Date;
    updatedAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

export const ADMIN_ROLES: AdminRole[] = [
    "super-admin",
    "operations-admin",
    "moderator",
    "content-manager",
    "support-agent",
    "finance",
    "analyst",
];

const adminSchema = new Schema<IAdmin>(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            select: false,
        },
        role: {
            type: String,
            required: [true, "Role is required"],
            enum: {
                values: ADMIN_ROLES,
                message: "{VALUE} is not a valid admin role",
            },
        },
        status: {
            type: String,
            required: [true, "Status is required"],
            enum: {
                values: ["active", "inactive"],
                message: "{VALUE} is not a valid status",
            },
            default: "active",
        },
        twoFactorEnabled: {
            type: Boolean,
            default: false,
        },
        lastLogin: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

adminSchema.pre<IAdmin>("save", async function () {
    if (!this.isModified("password") || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

adminSchema.methods.comparePassword = async function (
    candidatePassword: string
): Promise<boolean> {
    if (!this.password) {
        return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
};

export const Admin: Model<IAdmin> = mongoose.model<IAdmin>("Admin", adminSchema);
export default Admin;
