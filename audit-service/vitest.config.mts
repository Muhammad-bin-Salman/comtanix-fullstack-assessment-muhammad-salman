import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    hookTimeout: 600_000,
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      MONGOMS_DOWNLOAD_DIR: './.cache/mongodb-binaries',
    },
  },
});
