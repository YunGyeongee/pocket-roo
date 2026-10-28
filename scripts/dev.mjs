// Dev runner: compiles the Electron main/preload, starts Vite, then launches Electron against it.
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);

const tsc = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.electron.json'], {
  stdio: 'inherit',
});
if (tsc.status !== 0) process.exit(tsc.status ?? 1);

const server = await createServer();
await server.listen();
server.printUrls();

const electronBinary = require('electron');
const child = spawn(electronBinary, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: server.resolvedUrls.local[0] },
});

child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
