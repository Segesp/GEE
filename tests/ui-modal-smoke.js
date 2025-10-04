#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = parseInt(process.env.UI_TEST_PORT || '4100', 10);
const START_TIMEOUT = 20000;
const SHUTDOWN_TIMEOUT = 5000;

function startServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(PORT) };
    const serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: path.resolve(__dirname, '..'),
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        serverProcess.kill('SIGTERM');
        reject(new Error(`Servidor no inició en ${START_TIMEOUT} ms`));
      }
    }, START_TIMEOUT);

    const handleStdout = (data) => {
      const text = data.toString();
      process.stdout.write(`[server] ${text}`);
      if (!resolved && /Server running on http:\/\//.test(text)) {
        resolved = true;
        clearTimeout(timer);
        serverProcess.stdout.off('data', handleStdout);
        resolve(serverProcess);
      }
    };

    const handleStderr = (data) => {
      process.stderr.write(`[server:err] ${data}`);
    };

    serverProcess.stdout.on('data', handleStdout);
    serverProcess.stderr.on('data', handleStderr);

    serverProcess.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    serverProcess.once('exit', (code) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(new Error(`Servidor salió con código ${code}`));
      }
    });
  });
}

async function stopServer(serverProcess) {
  if (!serverProcess) return;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill('SIGTERM');
      }
    }, SHUTDOWN_TIMEOUT);

    const done = () => {
      clearTimeout(timer);
      resolve();
    };

    if (serverProcess.exitCode !== null) {
      done();
    } else {
      serverProcess.once('exit', done);
      try {
        serverProcess.kill('SIGINT');
      } catch (error) {
        clearTimeout(timer);
        resolve();
      }
    }
  });
}

async function runSmokeTest() {
  const baseUrl = `http://127.0.0.1:${PORT}`;
  let serverProcess;
  let browser;

  try {
    serverProcess = await startServer();

    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Asegurar que el DOM principal esté cargado
  await page.waitForSelector('#reportRunDetailsOverlay', { timeout: 15000 });
    const result = await page.evaluate(async () => {
      if (!window.openReportRunDetails) {
        throw new Error('openReportRunDetails no está definido');
      }
      const fakeRun = {
        id: 'ui-smoke-test',
        jobId: 'smoke-job',
        presetName: 'Smoke Demo',
        status: 'success',
        results: [],
        notifications: {
          email: { status: 'sent', recipients: ['demo@example.com'] }
        },
        metrics: {},
        delivery: {},
        request: {}
      };
      window.openReportRunDetails(fakeRun);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const closeButton = document.getElementById('closeReportRunDetails');
      if (!closeButton) {
        throw new Error('Botón de cierre no encontrado');
      }
      closeButton.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      const overlay = document.getElementById('reportRunDetailsOverlay');
      return {
        hidden: overlay?.hidden,
        bodyClassRemoved: !document.body.classList.contains('modal-open')
      };
    });

    if (!result.hidden) {
      throw new Error('El overlay sigue visible después de cerrar el modal');
    }

    if (!result.bodyClassRemoved) {
      throw new Error('La clase modal-open quedó en el body después de cerrar el modal');
    }

    console.log('✅ Smoke test UI: el modal se abre y se cierra correctamente.');
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopServer(serverProcess);
  }
}

runSmokeTest().catch((error) => {
  console.error('❌ Smoke test UI falló:', error);
  process.exitCode = 1;
});
