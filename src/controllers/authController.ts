import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Admin, { AdminRole, ADMIN_ROLES } from "../models/Admin";
import { AdminPayload } from "../middleware/authMiddleware";

/**
 * @desc    Authenticate admin and issue JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const loginAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: "Please provide both administrative email and password",
            });
            return;
        }

        const normalizedEmail = String(email).toLowerCase().trim();

        // Password must be explicitly selected since it is defined with select: false in schema
        const admin = await Admin.findOne({ email: normalizedEmail }).select("+password");

        if (!admin) {
            res.status(401).json({
                success: false,
                message: "Invalid administrative credentials",
            });
            return;
        }

        const isMatch = await admin.comparePassword(String(password));
        if (!isMatch) {
            res.status(401).json({
                success: false,
                message: "Invalid administrative credentials",
            });
            return;
        }

        if (admin.status !== "active") {
            res.status(403).json({
                success: false,
                message: "Administrative account is inactive. Please contact platform governance.",
            });
            return;
        }

        // Update last login timestamp without re-validating the full document
        admin.lastLogin = new Date();
        await admin.save({ validateBeforeSave: false });

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET environment variable is not configured.");
            res.status(500).json({
                success: false,
                message: "Server authentication configuration error",
            });
            return;
        }

        const payload: AdminPayload = {
            id: admin._id.toString(),
            email: admin.email,
            role: admin.role,
            name: admin.name,
        };

        const token = jwt.sign(
            payload,
            jwtSecret,
            process.env.JWT_EXPIRES_IN
                ? { expiresIn: process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
                : { expiresIn: "7d" }
        );

        res.status(200).json({
            success: true,
            token,
            admin: {
                id: admin._id.toString(),
                name: admin.name,
                email: admin.email,
                role: admin.role,
                status: admin.status,
                twoFactorEnabled: admin.twoFactorEnabled,
                lastLogin: admin.lastLogin,
            },
        });
    } catch (error) {
        console.error("Login controller error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error during authentication",
        });
    }
};

/**
 * @desc    Get current authenticated administrator identity
 * @route   GET /api/auth/me
 * @access  Protected (protect middleware)
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.admin) {
            res.status(401).json({
                success: false,
                message: "Unauthenticated request. Access denied.",
            });
            return;
        }

        res.status(200).json({
            success: true,
            admin: {
                id: req.admin.id,
                name: req.admin.name,
                email: req.admin.email,
                role: req.admin.role,
            },
        });
    } catch (error) {
        console.error("getMe controller error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve administrator profile",
        });
    }
};

/**
 * @desc    Seed initial administrator user (Development Only)
 * @route   POST /api/auth/seed
 * @access  Dev-Only
 */
export const seedAdmin = async (_req: Request, res: Response): Promise<void> => {
    try {
        // Enforce strict production guard
        if (process.env.NODE_ENV === "production") {
            res.status(403).json({
                success: false,
                message: "Admin seed endpoint is disabled in production",
            });
            return;
        }

        const name = process.env.SEED_ADMIN_NAME?.trim();
        const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
        const password = process.env.SEED_ADMIN_PASSWORD;
        const role = (process.env.SEED_ADMIN_ROLE?.trim() || "super-admin") as AdminRole;

        if (!name || !email || !password) {
            res.status(400).json({
                success: false,
                message: "Seed configuration missing. SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and SEED_ADMIN_PASSWORD must be configured in environment.",
            });
            return;
        }

        if (!ADMIN_ROLES.includes(role)) {
            res.status(400).json({
                success: false,
                message: `Invalid seed role '${role}'. Must be one of: ${ADMIN_ROLES.join(", ")}`,
            });
            return;
        }

        // Avoid creating duplicate admin records
        const existing = await Admin.findOne({ email });
        if (existing) {
            res.status(409).json({
                success: false,
                message: `Admin with email '${email}' already exists. Seed skipped to avoid duplicate.`,
                admin: {
                    id: existing._id.toString(),
                    name: existing.name,
                    email: existing.email,
                    role: existing.role,
                    status: existing.status,
                },
            });
            return;
        }

        const newAdmin = await Admin.create({
            name,
            email,
            password,
            role,
            status: "active",
            twoFactorEnabled: false,
        });

        res.status(201).json({
            success: true,
            message: "Development admin user seeded successfully",
            admin: {
                id: newAdmin._id.toString(),
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
                status: newAdmin.status,
                twoFactorEnabled: newAdmin.twoFactorEnabled,
                createdAt: newAdmin.createdAt,
            },
        });
    } catch (error) {
        console.error("seedAdmin controller error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to execute development admin seed",
        });
    }
};
