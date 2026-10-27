import { Response } from "express";
import mongoose from "mongoose";
import Candidate, {
    maskEmail,
    maskPhone,
    CANDIDATE_STATUSES,
    CandidateStatus,
    CandidateSource,
} from "../models/Candidate";
import CandidateAuditLog from "../models/CandidateAuditLog";
import { AuthRequest } from "../middleware/authMiddleware";

/**
 * Build safe query for either MongoDB ObjectId or customId (e.g., 'can-1001')
 */
function buildIdentifierQuery(rawId: string): Record<string, any> {
    const id = String(rawId || "").trim();
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
        return {
            $or: [{ customId: id }, { _id: new mongoose.Types.ObjectId(id) }],
        };
    }
    return { customId: id };
}

/**
 * Safe regex escaping for user input
 */
function escapeRegex(text: string): string {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

/**
 * Safe CSV row field escaper
 */
function escapeCsvField(val: any): string {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    return `"${str.replace(/"/g, '""')}"`;
}

/**
 * @desc    Get paginated, filterable candidate list with masked PII
 * @route   GET /api/admin/candidates
 * @access  Protected (super-admin, operations-admin, moderator, support-agent)
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
        if (
            status &&
            typeof status === "string" &&
            status !== "All statuses" &&
            status !== "All"
        ) {
            filter.status = status.trim();
        }

        // Location Filter
        if (
            location &&
            typeof location === "string" &&
            location !== "All locations" &&
            location !== "All"
        ) {
            filter.location = { $regex: escapeRegex(location.trim()), $options: "i" };
        }

        // Source Filter
        if (
            source &&
            typeof source === "string" &&
            source !== "All sources" &&
            source !== "All"
        ) {
            filter.source = source.trim();
        }

        // Completion Filter
        if (completionMin !== undefined && completionMin !== "") {
            const min = Number(completionMin);
            if (!isNaN(min)) {
                filter.completion = { $gte: min };
            }
        }

        // Pro Filter
        if (pro !== undefined && pro !== "" && pro !== "All") {
            filter.pro = String(pro).toLowerCase() === "true";
        }

        // Open to Remote Filter
        if (openToRemote !== undefined && openToRemote !== "" && openToRemote !== "All") {
            filter.openToRemote = String(openToRemote).toLowerCase() === "true";
        }

        // Visible to Employers Filter
        if (visibleToEmployers !== undefined && visibleToEmployers !== "" && visibleToEmployers !== "All") {
            filter.visibleToEmployers = String(visibleToEmployers).toLowerCase() === "true";
        }

        // Email Verified Filter
        if (isEmailVerified !== undefined && isEmailVerified !== "" && isEmailVerified !== "All") {
            filter.isEmailVerified = String(isEmailVerified).toLowerCase() === "true";
        }

        // Search Query (name, email, phone, customId, headline)
        if (search && typeof search === "string" && search.trim()) {
            const escaped = escapeRegex(search.trim());
            filter.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } },
                { phone: { $regex: escaped, $options: "i" } },
                { headline: { $regex: escaped, $options: "i" } },
                { customId: { $regex: escaped, $options: "i" } },
            ];
        }

        // Sorting with safe allowlist
        const ALLOWED_SORT_FIELDS = [
            "createdAt",
            "name",
            "completion",
            "lastActive",
            "recruiterViewsCount",
            "status",
            "location",
        ];
        const sortField = ALLOWED_SORT_FIELDS.includes(String(sortBy))
            ? String(sortBy)
            : "createdAt";
        const direction = String(sortOrder).toLowerCase() === "asc" ? 1 : -1;
        const sortOptions: Record<string, 1 | -1> = { [sortField]: direction };

        const [candidates, totalRecords] = await Promise.all([
            Candidate.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit)
                .lean(),
            Candidate.countDocuments(filter),
        ]);

        // Transform records with masked PII by default. Never expose raw email, phone, or direct resume URLs
        const maskedCandidates = candidates.map((cand) => ({
            id: cand.customId,
            _id: cand._id,
            customId: cand.customId,
            name: cand.name,
            headline: cand.headline,
            summary: cand.summary || "",
            emailMasked: maskEmail(cand.email),
            phoneMasked: maskPhone(cand.phone),
            location: cand.location,
            status: cand.status,
            statusReason: cand.statusReason || "",
            completion: cand.completion,
            source: cand.source,
            pro: cand.pro,
            isEmailVerified: cand.isEmailVerified,
            openToRemote: cand.openToRemote,
            visibleToEmployers: cand.visibleToEmployers,
            recruiterViewsCount: cand.recruiterViewsCount,
            skills: cand.skills || [],
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
                totalPages: Math.ceil(totalRecords / limit) || 1,
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
 * @desc    Get candidate details by ID or customId (PII masked by default)
 * @route   GET /api/admin/candidates/:id
 * @access  Protected (super-admin, operations-admin, moderator, support-agent)
 */
export const getCandidateById = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        if (!id) {
            res.status(400).json({
                success: false,
                message: "Candidate identifier is required.",
            });
            return;
        }

        const candidate = await Candidate.findOne(buildIdentifierQuery(id)).lean();

        if (!candidate) {
            res.status(404).json({
                success: false,
                message: `Candidate with identifier '${id}' was not found.`,
            });
            return;
        }

        // PII must remain masked by default for all roles.
        // The explicit PII reveal endpoint must be used for raw PII.
        const sanitizedCandidate: Record<string, any> = {
            ...candidate,
            id: candidate.customId,
            emailMasked: maskEmail(candidate.email),
            phoneMasked: maskPhone(candidate.phone),
        };

        // Strictly delete raw email and phone
        delete sanitizedCandidate.email;
        delete sanitizedCandidate.phone;

        // Sanitize direct resume URLs so they are not exposed in standard detail view
        if (Array.isArray(sanitizedCandidate.resumes)) {
            sanitizedCandidate.resumes = sanitizedCandidate.resumes.map((r: any) => ({
                ...r,
                url: "[Protected - Requires DPDP Justification]",
            }));
        }

        // Mask emails inside linked OAuth accounts
        if (Array.isArray(sanitizedCandidate.linkedOAuthAccounts)) {
            sanitizedCandidate.linkedOAuthAccounts = sanitizedCandidate.linkedOAuthAccounts.map(
                (acc: any) => ({
                    ...acc,
                    email: maskEmail(acc.email),
                })
            );
        }

        res.status(200).json({
            success: true,
            data: sanitizedCandidate,
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
 * @access  Protected (super-admin, operations-admin, moderator, support-agent)
 */
export const unmaskCandidatePii = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { justification } = req.body;

        const trimmed = typeof justification === "string" ? justification.trim() : "";
        if (!trimmed || trimmed.length < 8) {
            res.status(400).json({
                success: false,
                message:
                    "A valid administrative justification (minimum 8 characters) is required under DPDP Act 2023.",
            });
            return;
        }

        if (!req.admin || !req.admin.id || !req.admin.role) {
            res.status(401).json({
                success: false,
                message: "Unauthenticated request. Access denied.",
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

        // Record immutable audit log before disclosing PII
        const auditLog = await CandidateAuditLog.create({
            candidateId: candidate._id,
            candidateCustomId: candidate.customId,
            adminId: req.admin.id,
            adminName: req.admin.name || "Administrative Staff",
            adminRole: req.admin.role,
            action: "UNMASK_PII",
            justification: trimmed,
            ipAddress: req.ip || req.socket?.remoteAddress || "",
            timestamp: new Date(),
        });

        // Return only the PII required by the current UI
        res.status(200).json({
            success: true,
            candidateId: candidate.customId,
            unmasked: {
                email: candidate.email,
                phone: candidate.phone || "Not provided",
                resumes: candidate.resumes,
            },
            auditLogId: auditLog._id,
            message:
                "Candidate PII successfully revealed and recorded in platform audit ledger.",
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
 * @access  Protected (super-admin, operations-admin)
 */
export const updateCandidateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { status, reason } = req.body;

        if (!status || !CANDIDATE_STATUSES.includes(status as CandidateStatus)) {
            res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${CANDIDATE_STATUSES.join(", ")}`,
            });
            return;
        }

        // Require reason for sensitive changes
        const SENSITIVE_STATUSES = ["Suspended", "Pending deletion", "Anonymised"];
        const trimmedReason = typeof reason === "string" ? reason.trim() : "";
        if (SENSITIVE_STATUSES.includes(status) && (!trimmedReason || trimmedReason.length < 3)) {
            res.status(400).json({
                success: false,
                message: `A justification reason (minimum 3 characters) is required when transitioning status to '${status}'.`,
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
        candidate.status = status as CandidateStatus;
        if (trimmedReason) {
            candidate.statusReason = trimmedReason;
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
            justification: trimmedReason || `Status changed from ${oldStatus} to ${status}`,
            details: { oldStatus, newStatus: status },
            ipAddress: req.ip || req.socket?.remoteAddress || "",
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
 * @access  Protected (super-admin, operations-admin)
 */
export const verifyCandidateEmail = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { action } = req.body;

        if (action === "resend_link") {
            // Honest response: no email delivery service is configured
            res.status(501).json({
                success: false,
                message:
                    "Email delivery service (SMTP/SES) is not configured in this environment. Cannot dispatch verification email.",
            });
            return;
        }

        if (action !== "force_verify") {
            res.status(400).json({
                success: false,
                message: "Invalid action. Supported actions: force_verify, resend_link",
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
            ipAddress: req.ip || req.socket?.remoteAddress || "",
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
 * @access  Protected (super-admin, operations-admin, moderator, support-agent)
 */
export const addStaffNote = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const id = String(req.params.id || "").trim();
        const { note } = req.body;

        const trimmed = typeof note === "string" ? note.trim() : "";
        if (!trimmed) {
            res.status(400).json({
                success: false,
                message: "Note content cannot be empty.",
            });
            return;
        }

        if (trimmed.length > 2000) {
            res.status(400).json({
                success: false,
                message: "Note content exceeds maximum allowed length of 2000 characters.",
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

        // Author identity strictly derived from verified JWT (req.admin)
        const authorName = req.admin?.name || "Administrative Staff";
        const authorRole = req.admin?.role || "Admin";
        const newNote = {
            author: `${authorName} (${authorRole})`,
            authorName,
            authorAdminId: req.admin?.id,
            note: trimmed,
            createdAt: new Date(),
        };

        candidate.staffNotes.unshift(newNote);
        await candidate.save();

        await CandidateAuditLog.create({
            candidateId: candidate._id,
            candidateCustomId: candidate.customId,
            adminId: req.admin?.id || "unknown",
            adminName: authorName,
            adminRole: req.admin?.role || "support-agent",
            action: "ADD_NOTE",
            justification: "Caseworker note added",
            details: { noteSnippet: trimmed.slice(0, 100) },
            ipAddress: req.ip || req.socket?.remoteAddress || "",
            timestamp: new Date(),
        });

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
 * @desc    Execute bulk action on selected candidates
 * @route   POST /api/admin/candidates/bulk-action
 * @access  Protected (super-admin, operations-admin)
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

        if (candidateIds.length > 100) {
            res.status(400).json({
                success: false,
                message: "Bulk action batch size cannot exceed 100 candidates per request.",
            });
            return;
        }

        const validIds = candidateIds.map((id) => String(id).trim()).filter(Boolean);

        const objectIds = validIds
            .filter((id) => mongoose.Types.ObjectId.isValid(id) && id.length === 24)
            .map((id) => new mongoose.Types.ObjectId(id));

        const matchQuery: Record<string, any> = {
            $or: [
                { customId: { $in: validIds } },
                ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
            ],
        };

        if (action === "suspend") {
            const trimmedReason = typeof reason === "string" ? reason.trim() : "";
            if (!trimmedReason || trimmedReason.length < 3) {
                res.status(400).json({
                    success: false,
                    message: "A justification reason (minimum 3 characters) is required for bulk suspension.",
                });
                return;
            }

            const result = await Candidate.updateMany(matchQuery, {
                $set: {
                    status: "Suspended",
                    statusReason: trimmedReason,
                },
            });

            await CandidateAuditLog.create({
                adminId: req.admin?.id || "unknown",
                adminName: req.admin?.name || "Administrative Staff",
                adminRole: req.admin?.role || "operations-admin",
                action: "BULK_ACTION",
                justification: trimmedReason,
                details: {
                    action: "suspend",
                    requestedCount: candidateIds.length,
                    matchedCount: result.matchedCount,
                    modifiedCount: result.modifiedCount,
                    targetIds: validIds,
                },
                ipAddress: req.ip || req.socket?.remoteAddress || "",
                timestamp: new Date(),
            });

            res.status(200).json({
                success: true,
                message: `Bulk suspension completed. ${result.modifiedCount} candidate(s) modified.`,
                requestedCount: candidateIds.length,
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                failures: [],
            });
            return;
        }

        if (action === "reactivate") {
            const result = await Candidate.updateMany(matchQuery, {
                $set: {
                    status: "Active",
                    statusReason: "Bulk reactivation by administration",
                },
            });

            await CandidateAuditLog.create({
                adminId: req.admin?.id || "unknown",
                adminName: req.admin?.name || "Administrative Staff",
                adminRole: req.admin?.role || "operations-admin",
                action: "BULK_ACTION",
                justification: reason || "Bulk reactivation",
                details: {
                    action: "reactivate",
                    requestedCount: candidateIds.length,
                    matchedCount: result.matchedCount,
                    modifiedCount: result.modifiedCount,
                    targetIds: validIds,
                },
                ipAddress: req.ip || req.socket?.remoteAddress || "",
                timestamp: new Date(),
            });

            res.status(200).json({
                success: true,
                message: `Bulk reactivation completed. ${result.modifiedCount} candidate(s) modified.`,
                requestedCount: candidateIds.length,
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount,
                failures: [],
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
 * @desc    Export candidates as CSV stream with masked PII
 * @route   GET /api/admin/candidates/export or GET /api/admin/candidates/export/csv
 * @access  Protected (super-admin, operations-admin)
 */
export const exportCandidatesCsv = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const {
            status,
            location,
            source,
            pro,
            openToRemote,
            visibleToEmployers,
            isEmailVerified,
            search,
        } = req.query;

        const filter: Record<string, any> = {};

        if (status && typeof status === "string" && status !== "All statuses" && status !== "All") {
            filter.status = status.trim();
        }

        if (location && typeof location === "string" && location !== "All locations" && location !== "All") {
            filter.location = { $regex: escapeRegex(location.trim()), $options: "i" };
        }

        if (source && typeof source === "string" && source !== "All sources" && source !== "All") {
            filter.source = source.trim();
        }

        if (pro !== undefined && pro !== "" && pro !== "All") {
            filter.pro = String(pro).toLowerCase() === "true";
        }

        if (openToRemote !== undefined && openToRemote !== "" && openToRemote !== "All") {
            filter.openToRemote = String(openToRemote).toLowerCase() === "true";
        }

        if (visibleToEmployers !== undefined && visibleToEmployers !== "" && visibleToEmployers !== "All") {
            filter.visibleToEmployers = String(visibleToEmployers).toLowerCase() === "true";
        }

        if (isEmailVerified !== undefined && isEmailVerified !== "" && isEmailVerified !== "All") {
            filter.isEmailVerified = String(isEmailVerified).toLowerCase() === "true";
        }

        if (search && typeof search === "string" && search.trim()) {
            const escaped = escapeRegex(search.trim());
            filter.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } },
                { headline: { $regex: escaped, $options: "i" } },
                { customId: { $regex: escaped, $options: "i" } },
            ];
        }

        const candidates = await Candidate.find(filter).sort({ createdAt: -1 }).lean();

        // Audit the export action
        await CandidateAuditLog.create({
            adminId: req.admin?.id || "unknown",
            adminName: req.admin?.name || "Administrative Staff",
            adminRole: req.admin?.role || "operations-admin",
            action: "EXPORT_CSV",
            justification: "Administrative candidates directory export",
            details: { recordCount: candidates.length, filter },
            ipAddress: req.ip || req.socket?.remoteAddress || "",
            timestamp: new Date(),
        });

        // Headers
        const headers = [
            "Candidate ID",
            "Name",
            "Headline",
            "Email (Masked)",
            "Phone (Masked)",
            "Location",
            "Status",
            "Completion %",
            "Source",
            "Pro",
            "Verified",
            "Open to Remote",
            "Visible to Employers",
            "Joined Date",
        ];

        // Format rows with MASKED PII
        const rows = candidates.map((c) => [
            escapeCsvField(c.customId),
            escapeCsvField(c.name),
            escapeCsvField(c.headline),
            escapeCsvField(maskEmail(c.email)),
            escapeCsvField(maskPhone(c.phone)),
            escapeCsvField(c.location),
            escapeCsvField(c.status),
            escapeCsvField(c.completion),
            escapeCsvField(c.source),
            escapeCsvField(c.pro ? "Yes" : "No"),
            escapeCsvField(c.isEmailVerified ? "Yes" : "No"),
            escapeCsvField(c.openToRemote ? "Yes" : "No"),
            escapeCsvField(c.visibleToEmployers ? "Yes" : "No"),
            escapeCsvField(c.createdAt ? new Date(c.createdAt).toISOString().split("T")[0] : ""),
        ]);

        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="candidates_export_${Date.now()}.csv"`
        );
        res.status(200).send(csvContent);
    } catch (error) {
        console.error("exportCandidatesCsv error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export candidates CSV.",
        });
    }
};
