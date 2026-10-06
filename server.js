// Universal entrypoint for DirectAdmin / cPanel / Render / VPS
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import cp from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const distServer = path.join(__dirname, 'dist', 'server.cjs');

if (!fs.existsSync(distServer)) {
  try {
    console.log('[Attack 25] Building dist/server.cjs...');
    cp.execSync('npx vite build && npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (err) {
    console.warn('[Attack 25] Auto-bundle notification:', err.message);
  }
}

if (fs.existsSync(distServer)) {
  require(distServer);
} else {
  console.log('[Attack 25] Loading server.ts...');
  await import('./server.ts');
}
