import express from "express";
import cors from "cors";
import helmet from "helmet";
import { dbErrorHandler } from "./utils/dbErrorHandler.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(dbErrorHandler);
app.get("/health", (_, res) => res.json({ ok: true }));

export default app;
