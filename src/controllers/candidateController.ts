import { Response } from "express";
import mongoose from "mongoose";
import Candidate, { maskEmail, maskPhone } from "../models/Candidate";
import CandidateAuditLog from "../models/CandidateAuditLog";
import { AuthRequest } from "../middleware/authMiddleware";

function buildIdentifierQuery(rawId: string) {
    const id = String(rawId || "").trim();
    if (mongoose.Types.ObjectId.isValid(id)) {
        return { $or: [{ customId: id }, { _id: id }] };
    }
    return { customId: id };
}

/**
 * @desc    Get paginated, filterable candidate list
 * @route   GET /api/admin/candidates
 * @access  Protected (Super Admin, Operations Admin, Moderator, Support Agent)
 */
export const getCandidates = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
        const skip = (page - 1) * limit;

        const {
            search,
            status,
            location,
            source,
            completionMin,
            pro,
            openToRemote,
            visibleToEmployers,
            isEmailVerified,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        const filter: Record<string, any> = {};

        // Status Filter
        if (status && status !== "All statuses" && status !== "All") {
            filter.status = status;
        }

        // Location Filter
        if (location && location !== "All locations" && location !== "All") {
            filter.location = { $regex: new RegExp(location as string, "i") };
        }

        // Source Filter
        if (source && source !== "All sources" && source !== "All") {
            filter.source = source;
        }

        // Completion Filter
        if (completionMin) {
            filter.completion = { $gte: Number(completionMin) };
        }

        // Pro Filter
        if (pro !== undefined && pro !== "All") {
            filter.pro = String(pro) === "true";
        }

        // Open to Remote Filter
        if (openToRemote !== undefined && openToRemote !== "All") {
            filter.openToRemote = String(openToRemote) === "true";
        }

        // Visible to Employers Filter
        if (visibleToEmployers !== undefined && visibleToEmployers !== "All") {
            filter.visibleToEmployers = String(visibleToEmployers) === "true";
        }

        // Email Verified Filter
        if (isEmailVerified !== undefined && isEmailVerified !== "All") {
            filter.isEmailVerified = String(isEmailVerified) === "true";
        }

        // Search Query (name, email, headline, customId)
        if (search && typeof search === "string" && search.trim()) {
            const trimmed = search.trim();
            filter.$or = [
                { name: { $regex: trimmed, $options: "i" } },
                { email: { $regex: trimmed, $options: "i" } },
                { headline: { $regex: trimmed, $options: "i" } },
                { customId: { $regex: trimmed, $options: "i" } },
            ];
        }

        // Sort configuration
        const sortOptions: Record<string, 1 | -1> = {};
        const sortField = typeof sortBy === "string" ? sortBy : "createdAt";
        const direction = sortOrder === "asc" ? 1 : -1;
        sortOptions[sortField] = direction;

        const [candidates, totalRecords] = await Promise.all([
            Candidate.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .lean(),
            Candidate.countDocuments(filter),
        ]);

        // Transform records with masked PII by default for security
        const maskedCandidates = candidates.map((cand) => ({
            id: cand.customId,
            _id: cand._id,
            customId: cand.customId,
            name: cand.name,
            headline: cand.headline,
            emailMasked: maskEmail(cand.email),
            phoneMasked: maskPhone(cand.phone),
            location: cand.location,
            status: cand.status,
            completion: cand.completion,
            source: cand.source,
            pro: cand.pro,
            isEmailVerified: cand.isEmailVerified,
            openToRemote: cand.openToRemote,
            visibleToEmployers: cand.visibleToEmployers,
            recruiterViewsCount: cand.recruiterViewsCount,
            skills: cand.skills,
            lastActive: cand.lastActive,
            createdAt: cand.createdAt,
            updatedAt: cand.updatedAt,
        }));

        res.status(200).json({
            success: true,
            data: maskedCandidates,
            pagination: {
                page,
                limit,
                totalRecords,
                totalPages: Math.ceil(totalRecords / limit),
            },
        });
    } catch (error) {
        console.error("getCandidates error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve candidates list.",
        });
    }
};

/**
 * @desc    Get candidate details by ID or customId
 * @route   GET /api/admin/candidates/:id
 * @access  Protected (Super Admin, Operations Admin, Moderator, Support Agent)
 */
export const getCandidateById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const candidate = await Candidate.findOne(buildIdentifierQuery(id)).lean();

        if (!candidate) {
            res.status(404).json({
                success: false,
                message: `Candidate with identifier '${id}' was not found.`,
            });
            return;
        }

        // Return candidate profile with masked PII by default
        const result: Record<string, any> = {
            ...candidate,
            id: candidate.customId,
            emailMasked: maskEmail(candidate.email),
            phoneMasked: maskPhone(candidate.phone),
        };

        // Only reveal full email/phone if user is Super Admin or Operations Admin
        const callerRole = req.admin?.role;
        const isPrivileged = callerRole === "super-admin" || callerRole === "operations-admin";

        if (isPrivileged) {
            result.emailFull = candidate.email;
            result.phoneFull = candidate.phone;
        } else {
            delete result.email;
            delete result.phone;
        }

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error("getCandidateById error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve candidate profile.",
        });
    }
};

/**
 * @desc    Unmask candidate PII under DPDP Act 2023 with mandatory logged justification
 * @route   POST /api/admin/candidates/:id/unmask-pii
 * @access  Protected (Super Admin, Operations Admin, Moderator, Support Agent)
 */
export const unmaskCandidatePii = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { justification } = req.body;

        if (!justification || typeof justification !== "string" || justification.trim().length < 8) {
            res.status(400).json({
                success: false,
                message: "A valid administrative justification (minimum 8 characters) is required under DPDP Act 2023.",
            });
            return;
        }

        const candidate = await Candidate.findOne(buildIdentifierQuery(id));

        if (!candidate) {
            res.status(404).json({
                success: false,
                message: `Candidate with identifier '${id}' was not found.`,
            });
            return;
        }

        // Record immutable audit log
        const auditLog = await CandidateAuditLog.create({
            candidateId: candidate._id,
            candidateCustomId: candidate.customId,
            adminId: req.admin?.id || "unknown",
            adminName: req.admin?.name || "Administrative Staff",
            adminRole: req.admin?.role || "support-agent",
            action: "UNMASK_PII",
            justification: justification.trim(),
            ipAddress: req.ip || req.socket.remoteAddress,
            timestamp: new Date(),
        });

        res.status(200).json({
            success: true,
            candidateId: candidate.customId,
            unmasked: {
                email: candidate.email,
                phone: candidate.phone || "Not provided",
                resumes: candidate.resumes,
            },
            auditLogId: auditLog._id,
            message: "Candidate PII successfully revealed and recorded in platform audit ledger.",
        });
    } catch (error) {
        console.error("unmaskCandidatePii error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to unmask candidate PII.",
        });
    }
};

/**
 * @desc    Update candidate account status (Suspend / Reactivate / etc.)
 * @route   PATCH /api/admin/candidates/:id/status
 * @access  Protected (Super Admin, Operations Admin)
 */
export const updateCandidateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { status, reason } = req.body;

        const validStatuses = ["Active", "Suspended", "Self-deactivated", "Pending deletion", "Anonymised"];
        if (!status || !validStatuses.includes(status)) {
            res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
            });
            return;
        }

        const candidate = await Candidate.findOne(buildIdentifierQuery(id));

        if (!candidate) {
            res.status(404).json({
                success: false,
                message: `Candidate with identifier '${id}' was not found.`,
            });
            return;
        }

        const oldStatus = candidate.status;
        candidate.status = status;
        if (reason) {
            candidate.statusReason = reason.trim();
        }
        await candidate.save();

        // Audit the status change
        await CandidateAuditLog.create({
            candidateId: candidate._id,
            candidateCustomId: candidate.customId,
            adminId: req.admin?.id || "unknown",
            adminName: req.admin?.name || "Administrative Staff",
            adminRole: req.admin?.role || "operations-admin",
            action: "STATUS_CHANGE",
            justification: reason || `Status changed from ${oldStatus} to ${status}`,
            details: { oldStatus, newStatus: status },
            ipAddress: req.ip || req.socket.remoteAddress,
            timestamp: new Date(),
        });

        res.status(200).json({
            success: true,
            message: `Candidate status updated from '${oldStatus}' to '${status}'.`,
            data: {
                id: candidate.customId,
                status: candidate.status,
                statusReason: candidate.statusReason,
            },
        });
    } catch (error) {
        console.error("updateCandidateStatus error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update candidate status.",
        });
    }
};

/**
 * @desc    Force email verification or trigger verification email
 * @route   POST /api/admin/candidates/:id/verify-email
 * @access  Protected (Super Admin, Operations Admin)
 */
export const verifyCandidateEmail = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const candidate = await Candidate.findOne(buildIdentifierQuery(id));

        if (!candidate) {
            res.status(404).json({
                success: false,
                message: `Candidate with identifier '${id}' was not found.`,
            });
            return;
        }

        candidate.isEmailVerified = true;
        await candidate.save();

        await CandidateAuditLog.create({
            candidateId: candidate._id,
            candidateCustomId: candidate.customId,
            adminId: req.admin?.id || "unknown",
            adminName: req.admin?.name || "Administrative Staff",
            adminRole: req.admin?.role || "operations-admin",
            action: "FORCE_VERIFY_EMAIL",
            justification: "Administrative manual email verification override",
            ipAddress: req.ip || req.socket.remoteAddress,
            timestamp: new Date(),
        });

        res.status(200).json({
            success: true,
            message: "Candidate email verified successfully.",
            data: {
                id: candidate.customId,
                isEmailVerified: true,
            },
        });
    } catch (error) {
        console.error("verifyCandidateEmail error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify candidate email.",
        });
    }
};

/**
 * @desc    Add caseworker administrative note to candidate profile
 * @route   POST /api/admin/candidates/:id/notes
 * @access  Protected (Super Admin, Operations Admin, Moderator, Support Agent)
 */
export const addStaffNote = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { note } = req.body;

        if (!note || typeof note !== "string" || !note.trim()) {
            res.status(400).json({
                success: false,
                message: "Note content cannot be empty.",
            });
            return;
        }

        const candidate = await Candidate.findOne(buildIdentifierQuery(id));

        if (!candidate) {
            res.status(404).json({
                success: false,
                message: `Candidate with identifier '${id}' was not found.`,
            });
            return;
        }

        const newNote = {
            authorName: req.admin?.name || "Administrative Staff",
            authorAdminId: req.admin?.id,
            note: note.trim(),
            createdAt: new Date(),
        };

        candidate.staffNotes.unshift(newNote);
        await candidate.save();

        res.status(201).json({
            success: true,
            message: "Casework note recorded successfully.",
            data: candidate.staffNotes,
        });
    } catch (error) {
        console.error("addStaffNote error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add caseworker note.",
        });
    }
};

/**
 * @desc    Execute bulk action on selected candidates (CAN-5)
 * @route   POST /api/admin/candidates/bulk-action
 * @access  Protected (Super Admin, Operations Admin)
 */
export const bulkCandidateAction = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { candidateIds, action, reason } = req.body;

        if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
            res.status(400).json({
                success: false,
                message: "Please select at least one candidate for bulk execution.",
            });
            return;
        }

        if (action === "suspend") {
            const result = await Candidate.updateMany(
                { customId: { $in: candidateIds } },
                { $set: { status: "Suspended", statusReason: reason || "Bulk suspension by administration" } }
            );

            res.status(200).json({
                success: true,
                message: `Bulk suspension executed on ${result.modifiedCount} candidate(s).`,
                modifiedCount: result.modifiedCount,
            });
            return;
        }

        if (action === "reactivate") {
            const result = await Candidate.updateMany(
                { customId: { $in: candidateIds } },
                { $set: { status: "Active", statusReason: "Bulk reactivation by administration" } }
            );

            res.status(200).json({
                success: true,
                message: `Bulk reactivation executed on ${result.modifiedCount} candidate(s).`,
                modifiedCount: result.modifiedCount,
            });
            return;
        }

        res.status(400).json({
            success: false,
            message: `Unsupported bulk action '${action}'. Supported: suspend, reactivate`,
        });
    } catch (error) {
        console.error("bulkCandidateAction error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to execute bulk action.",
        });
    }
};

/**
 * @desc    Export candidates as CSV stream (CAN-5)
 * @route   GET /api/admin/candidates/export/csv
 * @access  Protected (Super Admin, Operations Admin)
 */
export const exportCandidatesCsv = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const candidates = await Candidate.find({}).sort({ createdAt: -1 }).lean();

        const headers = ["Candidate ID", "Name", "Headline", "Email", "Phone", "Location", "Status", "Completion %", "Source", "Pro", "Verified", "Joined Date"];
        const rows = candidates.map((c) => [
            c.customId,
            `"${(c.name || "").replace(/"/g, '""')}"`,
            `"${(c.headline || "").replace(/"/g, '""')}"`,
            c.email,
            c.phone || "",
            `"${(c.location || "").replace(/"/g, '""')}"`,
            c.status,
            c.completion,
            c.source,
            c.pro ? "Yes" : "No",
            c.isEmailVerified ? "Yes" : "No",
            new Date(c.createdAt).toISOString().split("T")[0],
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=jobrisers_candidates_${Date.now()}.csv`);
        res.status(200).send(csvContent);
    } catch (error) {
        console.error("exportCandidatesCsv error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export candidates CSV.",
        });
    }
};
