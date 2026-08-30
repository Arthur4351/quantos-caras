import { defineConfig } from 'vitest/config';
import path from 'path';
export default defineConfig({
  resolve: {
    alias: {
      'phaser3spectorjs': path.resolve(__dirname, 'tests/mocks/phaser3spectorjs.ts')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['node_modules', 'dist', 'e2e', '.idea', '.git', '.cache'],
    setupFiles: ['tests/setup.ts']
  }
});
