const { execFileSync, spawn } = require('child_process');

function enableUtf8Console() {
  if (process.platform !== 'win32') return;

  try {
    execFileSync(process.env.comspec || 'cmd.exe', ['/d', '/s', '/c', 'chcp 65001 >nul'], {
      stdio: 'ignore',
    });
  } catch {
    // Ignore code page adjustment failures and fall back to the current console encoding.
  }
}

function startElectron() {
  enableUtf8Console();

  const electronPath = require('electron');
  const child = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    windowsHide: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

startElectron();
