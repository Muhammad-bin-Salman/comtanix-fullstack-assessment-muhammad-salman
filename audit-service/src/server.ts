import mongoose from 'mongoose';
import { createApp } from './app';
import { loadConfig } from './config/env';

async function startServer(): Promise<void> {
  const config = loadConfig();

  await mongoose.connect(config.mongoUri);

  createApp(config).listen(config.port, () => {
    console.log(`Audit service listening on port ${config.port}.`);
  });
}

startServer().catch((error: unknown) => {
  console.error('Audit service failed to start.', error);
  process.exitCode = 1;
});
