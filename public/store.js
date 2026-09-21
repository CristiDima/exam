// Progress storage in the browser's localStorage. Everything lives in one JSON
// object, which is also the format used by Export / Import.

const KEY = 'epso-quiz:progress:v1';
const BANK_KEY = 'epso-quiz:bank';

function emptyState() {
  return { version: 1, next_run_id: 1, stats: {}, runs: [] };
}

let state = emptyState();
export let persistent = true;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('Could not read saved progress', e);
  }
  try {
    localStorage.setItem(KEY + ':probe', '1');
    localStorage.removeItem(KEY + ':probe');
  } catch {
    persistent = false;
  }
}

function save() {
  if (!persistent) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save progress', e);
  }
}

const toInt = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0);

// Validates and cleans a progress object (from storage or an imported file).
function normalize(data) {
  if (!data || typeof data !== 'object' || typeof data.stats !== 'object' || !Array.isArray(data.runs)) {
    throw new Error('Not a progress file.');
  }
  const stats = {};
  for (const [hash, s] of Object.entries(data.stats)) {
    if (!s || typeof s !== 'object') continue;
    stats[hash] = { times_answered: toInt(s.times_answered), times_wrong: toInt(s.times_wrong) };
  }
  const runs = data.runs
    .filter(r => r && typeof r === 'object')
    .map(r => ({
      id: toInt(r.id),
      date: String(r.date || ''),
      bank: String(r.bank || ''),
      mode: r.mode === 'learning' ? 'learning' : 'random',
      total: toInt(r.total),
      correct: toInt(r.correct),
      time_seconds: toInt(r.time_seconds),
    }));
  const maxId = runs.reduce((m, r) => Math.max(m, r.id), 0);
  return { version: 1, next_run_id: Math.max(toInt(data.next_run_id), maxId + 1), stats, runs };
}

export function getStats() {
  return state.stats;
}

export function recordAnswer(hash, wrong) {
  const s = state.stats[hash] || { times_answered: 0, times_wrong: 0 };
  s.times_answered += 1;
  if (wrong) s.times_wrong += 1;
  state.stats[hash] = s;
  save();
}

export function saveRun(run) {
  const saved = { id: state.next_run_id++, ...run };
  state.runs.push(saved);
  save();
  return saved;
}

// Newest first.
export function getRunsPage(page, perPage) {
  const runs = state.runs.slice().sort((a, b) => b.id - a.id);
  const totalPages = Math.max(1, Math.ceil(runs.length / perPage));
  const p = Math.min(Math.max(1, page), totalPages);
  return { runs: runs.slice((p - 1) * perPage, p * perPage), page: p, totalPages, totalRuns: runs.length };
}

export function clearAll() {
  state = emptyState();
  save();
}

export function exportJson() {
  return JSON.stringify(state, null, 2);
}

// Replaces all progress with the contents of an exported file. Throws if invalid.
export function importJson(text) {
  state = normalize(JSON.parse(text));
  save();
  return state.runs.length;
}

export function getSelectedBank() {
  try {
    return localStorage.getItem(BANK_KEY);
  } catch {
    return null;
  }
}

export function setSelectedBank(id) {
  try {
    localStorage.setItem(BANK_KEY, id);
  } catch {
    // Not critical; the default bank is used next time.
  }
}

load();
