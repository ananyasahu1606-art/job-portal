import { Router } from "express";
import { loginAdmin, getMe, seedAdmin } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";

const router = Router();

router.post("/login", loginAdmin);
router.get("/me", protect, getMe);
router.post("/seed", seedAdmin);

export default router;
