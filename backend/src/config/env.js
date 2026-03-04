import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env (not dependent on the process working directory).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
