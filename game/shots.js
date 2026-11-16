// Lanternfall's screenshot driver (Node 22, standard library only): drives
// headless Chrome over the DevTools protocol, waits for the scene to signal
// window.__shotReady, and writes the JPEGs listed in shots.json. No npm install:
// Node 22 ships fetch and WebSocket.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME_BIN || 'google-chrome';
const PORT = 9333;

mkdirSync(join(here, 'screenshots'), { recursive: true });
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const profile = join(here, '.chrome-profile');
rmSync(profile, { recursive: true, force: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1280,720', 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (list.webSocketDebuggerUrl) return list.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chrome never came up');
}

const browserWs = new WebSocket(await wsUrl());
await new Promise((r) => browserWs.addEventListener('open', r, { once: true }));

let nextId = 1;
const pending = new Map();
browserWs.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
  }
});

function call(method, params = {}, sessionId) {
  const id = nextId++;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  browserWs.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

// One page, reused for every shot, with the shots' console errors collected.
const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
await call('Page.enable', {}, sessionId);
await call('Runtime.enable', {}, sessionId);
await call('Emulation.setDeviceMetricsOverride',
  { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId);

const problems = [];
browserWs.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.method === 'Runtime.exceptionThrown') {
    problems.push(msg.params.exceptionDetails.exception?.description?.split('\n')[0] ?? 'exception');
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    problems.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
});

for (const shot of shots) {
  await call('Page.navigate', { url: `http://localhost:8080/index.html${shot.query}` }, sessionId);
  // Wait for the scene to say it is composed, not for a wall-clock guess.
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(150);
    const { result } = await call('Runtime.evaluate',
      { expression: 'window.__shotReady === true', returnByValue: true }, sessionId);
    ready = result.value === true;
  }
  if (!ready) throw new Error(`${shot.name} never signalled ready`);
  await sleep(400);
  const { data } = await call('Page.captureScreenshot', { format: 'jpeg', quality: 88 }, sessionId);
  writeFileSync(join(here, 'screenshots', shot.name), Buffer.from(data, 'base64'));
  console.log('shot', shot.name);
}

if (problems.length) {
  console.error('console errors:', problems.slice(0, 8).join(' | '));
  process.exitCode = 1;
}

await call('Browser.close');
chrome.kill();
