import express, { type Express } from 'express';
import type { AppConfig } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { createEventRouter } from './routes/events';

export function createApp(config: AppConfig): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use('/events', createEventRouter(config.auditSharedSecret));
  app.use(errorHandler(config.nodeEnv));

  return app;
}
