import { config } from "dotenv";
import { join } from "path";

// Machine-level DATABASE_URL (e.g. Windows user env) would otherwise win over .env.
config({ path: join(process.cwd(), ".env"), override: true });
