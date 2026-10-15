/* Read-only view of the StrengthStudioTT Supabase project.
   Workouts are mapped for the openGym UI on each request. Nothing is written
   to Supabase, and nothing is saved into the JSON state files. */
import crypto from 'node:crypto';

/* Logged name → catalogue id. Only the same movement, including equipment when the
   catalogue keeps that variation separate. */
const CATALOG = new Map([
  ['barbell full squat', '0043'],
  ['barbell full squats', '0043'],
  ['back squat', '0043'],
  ['back squats', '0043'],
  ['squat', '0043'],
  ['squats', '0043'],
  ['barbell squat', '0043'],
  ['barbell squats', '0043'],
  ['bb squat', '0043'],
  ['bb squats', '0043'],
  ['barbell back squat', '0043'],
  ['barbell back squats', '0043'],
  ['bb back squat', '0043'],
  ['bb back squats', '0043'],
  ['full squat', '0043'],
  ['full squats', '0043'],
  /* High bar was a regular back squat, so it is barbell full squat, not 1436. */
  ['barbell high bar squat', '0043'],
  ['barbell high-bar squat', '0043'],
  ['barbell highbar squat', '0043'],
  ['high bar squat', '0043'],
  ['high bar squats', '0043'],
  ['high-bar squat', '0043'],
  ['high-bar squats', '0043'],
  ['highbar squat', '0043'],
  ['highbar squats', '0043'],
  ['barbell bench press', '0025'],
  ['bench press', '0025'],
  ['bench', '0025'],
  ['bb bench press', '0025'],
  ['bb press', '0025'],
  ['barbell deadlift', '0032'],
  ['deadlift', '0032'],
  ['barbell romanian deadlift', '0085'],
  ['romanian deadlift', '0085'],
  ['romanian deadlifts', '0085'],
  ['rdl', '0085'],
  ['bb rdl', '0085'],
  ['barbell close-grip bench press', '0030'],
  ['close grip bench press', '0030'],
  ['close grip bench', '0030'],
  ['close-grip bench press', '0030'],
  ['close-grip bench', '0030'],
  ['barbell incline bench press', '0047'],
  ['incline bench press', '0047'],
  ['dumbbell incline bench press', '0314'],
  ['incline db press', '0314'],
  ['incline dumbbell press', '0314'],
  ['db incline', '0314'],
  ['incline db', '0314'],
  ['dumbbell bench press', '0289'],
  ['db flat press', '0289'],
  ['flat db press', '0289'],
  ['dumbbell romanian deadlift', '1459'],
  ['db rdl', '1459'],
  ['db rdls', '1459'],
  ['dumbbell rdl', '1459'],
  ['dumbbell rdls', '1459'],
  ['barbell bent over row', '0027'],
  ['barbell row', '0027'],
  ['barbell rows', '0027'],
  ['bb row', '0027'],
  ['bb rows', '0027'],
  ['barbell reverse grip bent over row', '0118'],
  ['reverse bb row', '0118'],
  ['reverse barbell row', '0118'],
  ['supinated bb row', '0118'],
  ['supinated bb rows', '0118'],
  ['supinated barbell row', '0118'],
  ['supinated barbell rows', '0118'],
  ['barbell shrug', '0095'],
  ['barbell shrugs', '0095'],
  ['bb shrug', '0095'],
  ['bb shrugs', '0095'],
  ['barbell upright row', '0120'],
  ['upright row', '0120'],
  ['upright rows', '0120'],
  ['barbell lunge', '0054'],
  ['barbell lunges', '0054'],
  ['bb lunge', '0054'],
  ['bb lunges', '0054'],
  ['barbell hip thrust', '1060'],
  ['hip thrusters', '1060'],
  ['barbell larsen press', '6270'],
  ['larsen press', '6270'],
  ['larsen', '6270'],
  ['barbell lying triceps extension skull crusher', '0060'],
  ['skull crusher', '0060'],
  ['skull crushers', '0060'],
  ['barbell preacher curl', '0070'],
  ['bar preacher curl', '0070'],
  ['bar preacher curls', '0070'],
  ['preacher curl', '0070'],
  ['preacher curls', '0070'],
  ['ez barbell curl', '0447'],
  ['ez bar curl', '0447'],
  ['ez bar curls', '0447'],
  ['ez bar bicep curl', '0447'],
  ['ez bar bicep curls', '0447'],
  ['dumbbell seated curl', '0391'],
  ['seated db curl', '0391'],
  ['seated db curls', '0391'],
  ['seates db curls', '0391'],
  ['dumbbell single arm preacher curl', '3084'],
  ['single arm preacher db curl', '3084'],
  ['single arm preacher curl', '3084'],
  ['single arm preacher curls', '3084'],
  ['dumbbell lateral raise', '0334'],
  ['db lateral raise', '0334'],
  ['db lateral raises', '0334'],
  ['db raise', '0334'],
  ['db raises', '0334'],
  ['dumbbell raise', '0334'],
  ['dumbbell raises', '0334'],
  ['dumbbell seated shoulder press', '0405'],
  ['seated shoulder press', '0405'],
  ['seated db shoulder press', '0405'],
  ['seated dumbbell shoulder press', '0405'],
  ['db press', '0405'],
  ['dumbbell bulgarian split squat', '2290'],
  ['bulgarian split squat', '2290'],
  ['bulgarian split squats', '2290'],
  ['bulgarian', '2290'],
  ['dumbbell seated lateral raise', '0396'],
  ['seated db lateral raise', '0396'],
  ['seated db lateral raises', '0396'],
  ['dumbbell chest supported row', '9698'],
  ['db seal row', '9698'],
  ['db seal rows', '9698'],
  ['barbell lying seal row on rack', '8798'],
  ['seal row', '8798'],
  ['seal rows', '8798'],
  ['push-up', '0662'],
  ['pushup', '0662'],
  ['pushups', '0662'],
  ['push-ups', '0662'],
  ['push ups', '0662'],
  ['side plank', '0715'],
  ['side planks', '0715'],
  ['pull-up', '0652'],
  ['pullup', '0652'],
  ['pullups', '0652'],
  ['pull-ups', '0652'],
  ['pull ups', '0652'],
  ['weighted pull-up', '0841'],
  ['weighted pullup', '0841'],
  ['weighted pullups', '0841'],
  ['weighted pull-ups', '0841'],
  ['weighted pull ups', '0841'],
  ['chin-up', '1326'],
  ['chinup', '1326'],
  ['chinups', '1326'],
  ['chin-ups', '1326'],
  ['chin ups', '1326'],
  ['weighted chin up', '4102'],
  ['weighted chin-up', '4102'],
  ['weighted chinup', '4102'],
  ['weighted chinups', '4102'],
  ['weighted chin-ups', '4102'],
  ['weighted chin ups', '4102'],
  ['close grip chin-up', '1327'],
  ['close grip chin-ups', '1327'],
  ['close grip chinups', '1327'],
  ['close grip chin ups', '1327'],
  ['chest dip', '0251'],
  ['dip', '0251'],
  ['dips', '0251'],
  ['nordic hamstring curl', '7746'],
  ['nordic curl', '7746'],
  ['nordic curls', '7746'],
  ['lever pec deck fly', '1030'],
  ['pec deck', '1030'],
  ['peck deck', '1030'],
  ['pec fly machine', '1030'],
  ['chest machine fly', '1030'],
  ['machine fly', '1030'],
  ['cable pulldown', '0198'],
  ['lat pulldown', '0198'],
  ['lat pulldowns', '0198'],
  ['pulldown', '0198'],
  ['pulldowns', '0198'],
  ['pull-down', '0198'],
  ['pull-downs', '0198'],
  ['cable wide grip lat pulldown', '2291'],
  ['wide lat pulldown', '2291'],
  ['wide grip lat pulldown', '2291'],
  ['cable close grip front lat pulldown', '1047'],
  ['narrow grip pulldown', '1047'],
  ['narrow pulldown', '1047'],
  ['narrow pull down', '1047'],
  ['cable neutral grip lat pulldown', '7583'],
  ['neutral grip pulldown', '7583'],
  ['neutral grip pulldowns', '7583'],
  ['cable lateral pulldown with v-bar', '2616'],
  ['v grip pulldown', '2616'],
  ['v grip pulldowns', '2616'],
  ['v-grip pulldown', '2616'],
  ['v-grip pulldowns', '2616'],
  ['cable seated wide-grip row', '0218'],
  ['wide cable row', '0218'],
  ['wide cable rows', '0218'],
  ['cable lateral raise', '0178'],
  ['cable lateral raises', '0178'],
  ['cable standing crossover', '8141'],
  ['cable crossover', '8141'],
  ['cable crossovers', '8141'],
  ['cable curl', '0868'],
  ['cable curls', '0868'],
  ['cable straight bar curl', '0868'],
  ['cable one arm curl', '0190'],
  ['single arm cable curl', '0190'],
  ['cable pushdown', '0201'],
  ['straight bar pushdown', '0201'],
  ['straight bar pushdowns', '0201'],
  ['cable kneeling crunch', '0175'],
  ['cable crunch', '0175'],
  ['cable crunches', '0175'],
  ['lever bicep curl', '0575'],
  ['machine bicep curl', '0575'],
  ['machine biceps curl', '0575'],
  ['dumbbell seated triceps extension', '2188'],
  ['seated overhead db extension', '2188'],
]);

const MAXES = {
  squat: 295,
  'bench press': 230,
  bench: 230,
  deadlift: 405,
  rdl: 335,
  'romanian deadlift': 335,
  'close grip bench': 215,
  'close grip bench press': 215,
};

let cache = { at: 0, body: null };

function configured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

function widOf(workouts) {
  const lines = workouts.map(w => `${w.id}|${w.d}|${w.vol}`).join('\n');
  return crypto.createHash('sha256').update(lines).digest('hex').slice(0, 16);
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* Set-scheme notes leaked into a few logged names. They are not a different lift. */
function normalizeName(name) {
  let key = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  key = key.replace(/\s*\([^)]*cluster[^)]*\)/g, '');
  key = key.replace(/\s+cluster$/, '');
  key = key.replace(/\s+(ss|ds|superset)$/g, '');
  key = key.replace(/\s+\d+\s*,.*$/, '');
  return key.replace(/\s+/g, ' ').trim();
}

function catalogId(name) {
  return CATALOG.get(normalizeName(name)) || null;
}

function customId(name) {
  const hash = crypto.createHash('sha256').update(String(name || '').trim().toLowerCase()).digest('hex').slice(0, 12);
  return 'sx' + hash;
}

function mapSession(row, customs) {
  const exercises = [...(row.session_exercises || [])].sort((a, b) => num(a.sort_order) - num(b.sort_order));
  let vol = 0;
  const entries = exercises.map((exercise, index) => {
    const name = exercise.exercise_name_raw || 'Exercise';
    let id = catalogId(name);
    if (!id) {
      id = customId(name);
      if (!customs.has(id)) {
        customs.set(id, { id, n: name, custom: true, eq: 'other', tg: [], desc: '', bp: '' });
      }
    }
    const sets = [...(exercise.sets || [])]
      .sort((a, b) => num(a.set_index) - num(b.set_index))
      .map(set => {
        const w = num(set.weight_lbs);
        const r = num(set.reps);
        vol += w * r;
        return { w, r, done: true };
      });
    const topW = sets.reduce((max, set) => Math.max(max, set.w), 0);
    return { id, sets, topW, note: '' };
  });

  const day = row.performed_on;
  const title = row.title || 'Workout';
  const cycle = row.program_cycle != null ? ` · Cycle ${row.program_cycle}` : '';
  return {
    id: 'sb' + String(row.id).replace(/-/g, '').slice(0, 16),
    d: day,
    start: Date.parse(`${day}T12:00:00`),
    end: Date.parse(`${day}T13:00:00`),
    routineId: null,
    name: `${title}${cycle}`,
    entries,
    prs: [],
    vol: Math.round(vol),
  };
}

async function fetchTraining() {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const select = [
    'id', 'performed_on', 'title', 'program_cycle', 'program_day', 'bodyweight_lbs',
    'session_exercises(exercise_name_raw,sort_order,sets(set_index,reps,weight_lbs))',
  ].join(',');
  const url = `${base}/rest/v1/sessions?select=${encodeURIComponent(select)}&order=performed_on.asc`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}`);
  const rows = await res.json();
  const customs = new Map();
  const workouts = rows.map(row => mapSession(row, customs)).filter(w => w.entries.length > 0);
  // One weigh-in per day, in the stored unit (lb). No `t`: openGym treats `t` as the time
  // the entry was edited and rewrites it to now, which stacks the whole history on today.
  const byDay = new Map();
  for (const row of rows) {
    if (row.bodyweight_lbs == null || !row.performed_on) continue;
    byDay.set(row.performed_on, num(row.bodyweight_lbs));
  }
  const bodyweight = [...byDay.entries()].map(([d, w]) => ({ d, w }));
  return { workouts, customEx: [...customs.values()], bodyweight, plan: buildPlan(rows, customs), wid: widOf(workouts) };
}

function dowOf(iso) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function modeDow(days) {
  const recent = days.slice(-4);
  const counts = new Map();
  const last = new Map();
  recent.forEach((day, index) => {
    counts.set(day, (counts.get(day) || 0) + 1);
    last.set(day, index);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || last.get(b[0]) - last.get(a[0]))[0][0];
}

function prescribe(sets) {
  const logged = sets.filter(set => set.w > 0 || set.r > 0);
  const use = logged.length ? logged : sets;
  if (!use.length) return null;
  const groups = new Map();
  for (const set of use) {
    const key = String(set.w);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(set);
  }
  let chosen = [...groups.values()][0];
  const biggest = Math.max(...[...groups.values()].map(group => group.length));
  if (biggest === 1) {
    const top = use.reduce((best, set) => (set.w >= best.w ? set : best));
    return { sets: use.length, reps: top.r || 8, weight: top.w };
  }
  for (const group of groups.values()) {
    if (group.length > chosen.length) chosen = group;
    else if (group.length === chosen.length && group[0].w > chosen[0].w) chosen = group;
  }
  const reps = chosen.map(set => set.r).filter(rep => rep > 0).sort((a, b) => a - b);
  return {
    sets: chosen.length,
    reps: reps.length ? reps[Math.floor((reps.length - 1) / 2)] : 8,
    weight: chosen[0].w,
  };
}

/* The repeating week, from the latest cycle: one routine per SSTT day, on the weekday it usually lands. */
function buildPlan(rows, customs) {
  const byProgramDay = new Map();
  for (const row of rows) {
    const day = Number(row.program_day);
    if (!(day >= 1 && day <= 4) || !row.performed_on) continue;
    if (!byProgramDay.has(day)) byProgramDay.set(day, []);
    byProgramDay.get(day).push(row);
  }
  if (!byProgramDay.size) return null;
  const used = new Set();
  const week = {};
  const routines = [];
  const maxes = new Map();
  for (const day of [...byProgramDay.keys()].sort((a, b) => a - b)) {
    const sessions = byProgramDay.get(day);
    const latest = sessions[sessions.length - 1];
    const grouped = new Map();
    const nameOf = new Map();
    for (const exercise of [...(latest.session_exercises || [])].sort((a, b) => num(a.sort_order) - num(b.sort_order))) {
      const name = exercise.exercise_name_raw || 'Exercise';
      const id = catalogId(name) || customId(name);
      if (!catalogId(name) && !customs.has(id)) {
        customs.set(id, { id, n: name, custom: true, eq: 'other', tg: [], desc: '', bp: '' });
      }
      if (!grouped.has(id)) grouped.set(id, []);
      nameOf.set(id, String(name).trim().toLowerCase());
      for (const set of exercise.sets || []) grouped.get(id).push({ w: num(set.weight_lbs), r: num(set.reps) });
    }
    const ex = [];
    for (const [id, sets] of grouped) {
      const prescribed = prescribe(sets);
      if (!prescribed) continue;
      const max = MAXES[normalizeName(nameOf.get(id))];
      const kept = maxes.get(id);
      if (max && (kept == null || max > kept)) maxes.set(id, max);
      ex.push({ id, mode: 'reps', ...prescribed });
    }
    if (!ex.length) continue;
    const id = `sstt-d${day}`;
    routines.push({ id, name: `SSTT D${day}`, emoji: 'dumbbell', prog: 'off', ex });
    let dow = modeDow(sessions.map(session => dowOf(session.performed_on)));
    for (let step = 0; used.has(dow) && step < 7; step++) dow = (dow + 1) % 7;
    used.add(dow);
    week[dow] = [id];
  }
  return routines.length ? { routines, week, maxes: [...maxes].map(([id, w]) => ({ id, w })) } : null;
}

export async function supabaseTraining() {
  if (!configured()) return null;
  if (cache.body && Date.now() - cache.at < 15000) return cache.body;
  const body = await fetchTraining();
  cache = { at: Date.now(), body };
  return body;
}

/* Swap the workout list the UI reads. The JSON file stays the profile store. */
export async function overlaySupabaseTraining(state) {
  const training = await supabaseTraining();
  if (!training) return state;
  const base = state && typeof state === 'object' ? { ...state } : {};
  const previous = [];
  if (base._wid) previous.push(base._wid);
  if (Array.isArray(base._wids)) previous.push(...base._wids);
  const have = new Set((base.customEx || []).map(ex => ex.id));
  return {
    ...base,
    workouts: training.workouts,
    unit: 'lb',
    unitSet: { at: 1, convert: false },
    bodyweight: training.bodyweight.length ? training.bodyweight : (base.bodyweight || []),
    customEx: [...(base.customEx || []), ...training.customEx.filter(ex => !have.has(ex.id))],
    _rev: (base._rev || 0) + 1,
    _wid: training.wid,
    _wids: [...new Set([...previous, training.wid])],
  };
}
