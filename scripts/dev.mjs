import { spawn } from 'node:child_process';
import { platform } from 'node:os';

const isWindows = platform() === 'win32';
const viteBin = isWindows ? 'node_modules\\.bin\\vite.cmd' : 'node_modules/.bin/vite';
const viteArgs = process.argv.slice(2);

const processes = [
  spawn(process.execPath, ['server/baiduAsrServer.mjs'], { stdio: 'inherit' }),
  spawn(viteBin, ['--host', '127.0.0.1', ...viteArgs], { shell: isWindows, stdio: 'inherit' }),
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
