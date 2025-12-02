#!/usr/bin/env node
import { env, exit } from 'node:process';

const agent = env.npm_config_user_agent || '';

if (!agent.includes('pnpm')) {
  console.error('This project enforces pnpm. Please rerun the install with pnpm (use `corepack pnpm install`).');
  exit(1);
}
