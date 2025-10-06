import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Slack Configuration
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().startsWith('xoxb-'),
  SLACK_CLIENT_ID: z.string().min(1),
  SLACK_CLIENT_SECRET: z.string().min(1),
  
  // Application Configuration
  BASE_URL: z.string().url(),
  DIGEST_CHANNEL: z.string().startsWith('C').optional(),
  
  // OpenAI Configuration (optional)
  OPENAI_API_KEY: z.string().optional(),
  
  // Scheduling
  CRON_EXPR: z.string().default('0 23 * * *'),
  
  // Data Retention
  SOFT_DELETE_DAYS: z.coerce.number().int().nonnegative().optional(),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Supabase Configuration
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  
  // Rate Limiting
  RATE_LIMIT_DELAY: z.coerce.number().int().nonnegative().default(1000),
  MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
});

// Parse and validate environment variables
const config = ConfigSchema.parse(process.env);

export default config;

export type Config = typeof config;