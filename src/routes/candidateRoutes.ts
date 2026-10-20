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

// 1. Export CSV (Placed before :id route to prevent collision)
router.get(
    "/export/csv",
    protect,
    authorize("super-admin", "operations-admin"),
    exportCandidatesCsv
);

// 2. Bulk Action on Candidates
router.post(
    "/bulk-action",
    protect,
    authorize("super-admin", "operations-admin"),
    bulkCandidateAction
);

// 3. List candidates (with search, filters, pagination, and masked PII)
router.get(
    "/",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    getCandidates
);

// 4. Candidate Details
router.get(
    "/:id",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    getCandidateById
);

// 5. Unmask PII with mandatory DPDP Act justification
router.post(
    "/:id/unmask-pii",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    unmaskCandidatePii
);

// 6. Update Candidate Status (Suspend / Reactivate)
router.patch(
    "/:id/status",
    protect,
    authorize("super-admin", "operations-admin"),
    updateCandidateStatus
);

// 7. Force Verify Email
router.post(
    "/:id/verify-email",
    protect,
    authorize("super-admin", "operations-admin"),
    verifyCandidateEmail
);

// 8. Add Casework Note
router.post(
    "/:id/notes",
    protect,
    authorize("super-admin", "operations-admin", "moderator", "support-agent"),
    addStaffNote
);

export default router;
