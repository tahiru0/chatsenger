import type { Config } from 'drizzle-kit';
import { loadEnvConfig } from '@next/env';
import { join } from 'path';

// Load environment variables using Next.js's built-in functionality
const projectDir = join(process.cwd());
loadEnvConfig(projectDir);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined. Please check your .env.local file.');
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
} satisfies Config;
