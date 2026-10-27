import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db";
import authRoutes from "./routes/authRoutes";
import candidateRoutes from "./routes/candidateRoutes";
import { seedCandidates } from "./seeds/candidateSeed";

dotenv.config();

connectDB().then(() => {
    if (process.env.NODE_ENV !== "production") {
        seedCandidates().catch((err) => console.error("Candidate seed error:", err));
    }
});

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.use("/api/auth", authRoutes);
app.use("/api/admin/candidates", candidateRoutes);

app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        message: "JobRisers Admin Backend is running",
    });
});

app.listen(PORT, () => {
    console.log(`JobRisers Admin Backend running on port ${PORT}`);
});