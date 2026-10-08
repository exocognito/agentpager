import { defineConfig } from 'vitest/config';
export default defineConfig({test:{include:['design/**/*.test.ts'],environment:'node'}});
