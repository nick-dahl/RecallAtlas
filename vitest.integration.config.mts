import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      'server-only': path.join(root, 'node_modules', 'server-only', 'empty.js'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.int.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    env: loadEnv('test', root, ''),
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
