import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AdminRole } from "../models/Admin";

export interface AdminPayload {
    id: string;
    email: string;
    role: AdminRole;
    name?: string;
}

declare global {
    namespace Express {
        interface Request {
            admin?: AdminPayload;
        }
    }
}

export interface AuthRequest extends Request {
    admin?: AdminPayload;
}

export const protect = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({
                success: false,
                message: "Authentication token missing or invalid format. Please log in.",
            });
            return;
        }

        const token = authHeader.split(" ")[1]?.trim();

        if (!token) {
            res.status(401).json({
                success: false,
                message: "Authentication token missing. Please log in.",
            });
            return;
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            console.error("JWT_SECRET environment variable is missing.");
            res.status(500).json({
                success: false,
                message: "Server authentication configuration error.",
            });
            return;
        }

        const decoded = jwt.verify(token, jwtSecret) as JwtPayload & AdminPayload;

        if (!decoded || !decoded.id || !decoded.role) {
            res.status(401).json({
                success: false,
                message: "Malformed token payload. Authorization denied.",
            });
            return;
        }

        req.admin = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({
                success: false,
                message: "Session expired. Please sign in again.",
            });
            return;
        }
        res.status(401).json({
            success: false,
            message: "Invalid authentication token. Authorization denied.",
        });
    }
};

export const authorize = (...roles: AdminRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.admin) {
            res.status(401).json({
                success: false,
                message: "Unauthenticated request. Access denied.",
            });
            return;
        }

        if (!roles.includes(req.admin.role)) {
            res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource.",
            });
            return;
        }

        next();
    };
};
