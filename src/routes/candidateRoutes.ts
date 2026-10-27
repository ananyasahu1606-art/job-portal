import { Router } from "express";
import {
    getCandidates,
    getCandidateById,
    unmaskCandidatePii,
    updateCandidateStatus,
    verifyCandidateEmail,
    addStaffNote,
    bulkCandidateAction,
    exportCandidatesCsv,
} from "../controllers/candidateController";
import { protect, authorize } from "../middleware/authMiddleware";

const router = Router();

// 1. Export CSV (Must be placed before /:id routes to avoid route param collision)
router.get(
    "/export",
    protect,
    authorize("super-admin", "operations-admin"),
    exportCandidatesCsv
);

router.get(
    "/export/csv",
    protect,
    authorize("super-admin", "operations-admin"),
    exportCandidatesCsv
);

// 2. Bulk Action on Candidates (Placed before /:id)
router.post(
    "/bulk-action",
    protect,
    authorize("super-admin", "operations-admin"),
    bulkCandidateAction
);

// 3. Paginated Candidate Directory (with search, filtering, sorting, masked PII)
router.get(
    "/",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    getCandidates
);

// 4. Candidate Details (PII masked by default)
router.get(
    "/:id",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    getCandidateById
);

// 5. Unmask PII with mandatory DPDP Act justification (min 8 chars, logged)
router.post(
    "/:id/unmask-pii",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    unmaskCandidatePii
);

// 6. Update Candidate Status (Active, Suspended, Self-deactivated, etc.)
router.patch(
    "/:id/status",
    protect,
    authorize("super-admin", "operations-admin"),
    updateCandidateStatus
);

// 7. Verify Candidate Email (force_verify, resend_link)
router.post(
    "/:id/verify-email",
    protect,
    authorize("super-admin", "operations-admin"),
    verifyCandidateEmail
);

// 8. Add Caseworker Note
router.post(
    "/:id/notes",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    addStaffNote
);

export default router;
