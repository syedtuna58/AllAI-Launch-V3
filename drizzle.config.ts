import { defineConfig } from "drizzle-kit";
import { config } from "./server/config";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: config.databaseUrl,
  },
});
