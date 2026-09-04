const { createServer } = require('vite');
const { spawn, execSync } = require('child_process');
const electron = require('electron');
const path = require('path');

async function main() {
  console.log('Compiling Electron main process...');
  try {
    execSync('npm run build:electron', { stdio: 'inherit', cwd: __dirname });
  } catch (err) {
    console.error('Failed to compile Electron TypeScript:', err);
    process.exit(1);
  }

  const server = await createServer({
    configFile: path.resolve(__dirname, 'vite.config.ts'),
    server: { port: 3000 }
  });

  await server.listen();

  const address = server.httpServer.address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const devUrl = `http://localhost:${port}`;

  console.log(`\n  ➜  Vite dev server running at: ${devUrl}`);
  console.log(`  ➜  Launching Electron desktop app with Hot Reload (HMR)...\n`);

  const child = spawn(electron, ['.'], {
    stdio: 'inherit',
    cwd: __dirname,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devUrl
    }
  });

  child.on('close', (code) => {
    server.close();
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    child.kill();
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    child.kill();
    server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start dev runner:', err);
  process.exit(1);
});
