import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const isWindows = platform() === 'win32';
const viteBin = isWindows ? 'node_modules\\.bin\\vite.cmd' : 'node_modules/.bin/vite';
const viteArgs = process.argv.slice(2);
const childEnv = {
  ...process.env,
  LANG: process.env.LANG ?? 'C.UTF-8',
  LC_ALL: process.env.LC_ALL ?? 'C.UTF-8',
  PYTHONUTF8: process.env.PYTHONUTF8 ?? '1',
};

const processes = [
  spawn(process.execPath, ['server/baiduAsrServer.mjs'], { env: childEnv, stdio: 'inherit' }),
  spawn(viteBin, ['--host', '127.0.0.1', ...viteArgs], { env: childEnv, shell: isWindows, stdio: 'inherit' }),
];

function stopAll(signal) {
  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll('SIGTERM');
      process.exit(code);
    }
  });
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  process.exit(0);
});
