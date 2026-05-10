import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import { configure } from 'passmark';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Configure Passmark to route all AI calls through OpenRouter.
// Use :free suffix models — these have $0 pricing and don't consume
// OpenRouter credits regardless of context window size.
configure({
  ai: {
    gateway: 'openrouter',
    models: {
      stepExecution: 'openai/gpt-4.1-mini',
      userFlowLow: 'openai/gpt-4.1-mini',
      userFlowHigh: 'openai/gpt-4.1-mini',
      assertionPrimary: 'openai/gpt-4.1-mini',
      assertionSecondary: 'openai/gpt-4.1-mini',
      assertionArbiter: 'openai/gpt-4.1-mini',
      utility: 'openai/gpt-4.1-mini',
    },
  },
});
export default defineConfig({
  testDir: './tests',
  timeout: 180_000,         // AI steps need more time (free models are slow)
  workers: 1,               // Keep serial — prevents auth races
  retries: 1,

  use: {
    baseURL: process.env.PW_BASE_URL || 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
