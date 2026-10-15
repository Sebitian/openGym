/* Build the Vite app and a read-only API for Vercel.
   The filesystem server in api/ stays source for the frontend imports.
   It is not turned into a function: this writes the Build Output API. */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
execSync('npm run build --prefix frontend', { cwd: root, stdio: 'inherit' });

const out = join(root, '.vercel/output');
rmSync(out, { recursive: true, force: true });
cpSync(join(root, 'frontend/dist'), join(out, 'static'), { recursive: true });

const vc = {
  runtime: 'nodejs22.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
};

function writeFunc(name, source) {
  const dir = join(out, 'functions', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.vc-config.json'), JSON.stringify(vc));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  writeFileSync(join(dir, 'index.js'), source);
}

const trainingDir = join(out, 'functions/api/training.func');
mkdirSync(trainingDir, { recursive: true });
writeFileSync(join(trainingDir, '.vc-config.json'), JSON.stringify(vc));
writeFileSync(join(trainingDir, 'package.json'), JSON.stringify({ type: 'module' }));
cpSync(join(root, 'api/supabase-training.js'), join(trainingDir, 'supabase-training.js'));
writeFileSync(join(trainingDir, 'index.js'), `import { supabaseTraining } from './supabase-training.js';

export default async function handler(_req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  try {
    const training = await supabaseTraining();
    const body = training
      ? {
          workouts: training.workouts,
          customEx: training.customEx,
          bodyweight: training.bodyweight,
          plan: training.plan,
          maxes: training.plan?.maxes || [],
        }
      : { workouts: [], customEx: [], bodyweight: [] };
    res.statusCode = 200;
    res.end(JSON.stringify(body));
  } catch (err) {
    console.error('supabase training', err);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'supabase unavailable' }));
  }
}
`);

writeFunc('api/config.func', `export default function handler(_req, res) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ invite_only: false, allow_guest: true }));
}
`);

writeFunc('api/me.func', `export default function handler(_req, res) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.statusCode = 401;
  res.end(JSON.stringify({ error: 'not signed in' }));
}
`);

writeFileSync(join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '/api/training', dest: '/api/training' },
    { src: '/api/config', dest: '/api/config' },
    { src: '/api/me', dest: '/api/me' },
    { handle: 'filesystem' },
    { src: '/(.*)', dest: '/index.html' },
  ],
}, null, 2));
