import 'dotenv/config';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required.'),
  AUDIT_SHARED_SECRET: z.string().min(1, 'AUDIT_SHARED_SECRET is required.'),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  mongoUri: string;
  auditSharedSecret: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues.map((issue) => issue.message).join(' ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    mongoUri: result.data.MONGODB_URI,
    auditSharedSecret: result.data.AUDIT_SHARED_SECRET,
  };
}
