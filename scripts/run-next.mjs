import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Windows resolves module identity using path spelling. Use the actual casing
// for both the CLI and working directory so React is loaded exactly once.
const root = realpathSync.native(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const child = spawn(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, ...(process.argv[2] === 'dev' && !process.env.SITE_OUTPUT_DIR ? { SITE_OUTPUT_DIR: '.local/build-dev-preview' } : {}), NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit',
  windowsHide: true,
});
child.on('error', () => { console.error('Unable to start Next.js. Run npm ci first.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
