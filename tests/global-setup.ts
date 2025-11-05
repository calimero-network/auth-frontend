import { FullConfig } from '@playwright/test';
import { ensureMerobox, runMerobox } from '@calimero-network/merobox-js';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export default async function globalSetup(config: FullConfig) {
  // If CI provides external merobox bootstrap, skip
  if (process.env.MEROBOX_EXTERNAL === '1') {
    return;
  }

  // Try to spin up with merobox (works on Linux and macOS); fallback to local dev auth on 3001
  try {
    await ensureMerobox();

    const workflowPath = resolve(process.cwd(), 'workflow.yml');
    if (!existsSync(workflowPath)) {
      writeFileSync(
        workflowPath,
        `name: "Auth E2E"\n` +
          `description: "Single node with auth service"\n` +
          `auth_service: true\n` +
          `nodes:\n` +
          `  count: 1\n` +
          `  base_port: 2428\n` +
          `  base_rpc_port: 2528\n` +
          `  chain_id: "testnet-1"\n` +
          `  prefix: "calimero-node"\n` +
          `  image: "ghcr.io/calimero-network/merod:edge"\n` +
          `steps:\n` +
          `  - name: "Wait for node startup"\n` +
          `    type: "wait"\n` +
          `    seconds: 5\n`
      );
    }

    await runMerobox(
      [
        'bootstrap',
        'run',
        'workflow.yml',
        '--auth-service',
        '--auth-image',
        'ghcr.io/calimero-network/mero-auth:latest',
      ],
      { stdio: 'inherit' }
    );
    return;
  } catch (e) {
    // Fallback to local - check if server is already running
  }

  // macOS or fallback: ensure local auth dev stack is running on 3001
  const url = 'http://localhost:3001/auth/identity';
  const res = await fetch(url).catch(() => null);
  if (!res || !res.ok) {
    throw new Error(
      `Auth dev service not reachable at ${url}. Start it, e.g. core/scripts/auth-dev.sh <frontend-build-path>.`
    );
  }
}


