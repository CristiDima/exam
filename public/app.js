import { CHOICE_KEYS, parseQuestions, pickLearning, pickRandom, shuffle } from './quiz.js';
import * as store from './store.js';

const PER_PAGE = 20;

// State
let banks = [];                // [{ id, title, file }]
const bankCache = new Map();   // bank id -> parsed questions
let currentBank = null;        // { id, title, questions }

let run = null;                // { bank, mode, questions, answers }
let currentIndex = 0;
let timerSeconds = 0;
let timerInterval = null;
let selectedChoice = null;
let dashboardPage = 1;

const $ = id => document.getElementById(id);

const views = {
  home: $('view-home'),
  quiz: $('view-quiz'),
  results: $('view-results'),
  review: $('view-review'),
  dashboard: $('view-dashboard'),
};

let toastTimeout = null;
function showToast(msg, duration = 3500) {
  const toast = $('toast-container');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), duration);
}

function showView(name) {
  Object.values(views).forEach(el => el.classList.add('hidden'));
  views[name].classList.remove('hidden');
  window.scrollTo(0, 0);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// "YYYY-MM-DDTHH:MM:SS" -> "YYYY-MM-DD HH:MM"
function formatDate(dateStr) {
  return dateStr ? dateStr.replace('T', ' ').substring(0, 16) : '';
}

function localTimestamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bankTitle(id) {
  return banks.find(b => b.id === id)?.title || id || '-';
}

// ----------------------------------------------------------------------------
// HOME
// ----------------------------------------------------------------------------

async function loadBanks() {
  const res = await fetch('data/banks.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`banks.json: HTTP ${res.status}`);
  banks = await res.json();

  const select = $('bank-select');
  select.innerHTML = '';
  for (const b of banks) {
    const opt = el('option', null, b.title);
    opt.value = b.id;
    select.appendChild(opt);
  }
  const saved = store.getSelectedBank();
  select.value = banks.some(b => b.id === saved) ? saved : banks[0]?.id;
}

async function selectBank(id) {
  const bank = banks.find(b => b.id === id);
  if (!bank) return;
  const info = $('total-questions-info');
  info.textContent = 'Loading questions...';
  currentBank = null;
  setStartEnabled(false);

  try {
    if (!bankCache.has(id)) {
      const res = await fetch(`data/${bank.file}`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      bankCache.set(id, await parseQuestions(await res.json()));
    }
    // Ignore a slow response if the user already switched to another set.
    if ($('bank-select').value !== id) return;

    const questions = bankCache.get(id);
    currentBank = { id, title: bank.title, questions };
    store.setSelectedBank(id);
    renderBankInfo();
    setStartEnabled(questions.length > 0);
  } catch (e) {
    console.error(e);
    info.textContent = `Could not load "${bank.title}" (${bank.file}).`;
  }
}

function renderBankInfo() {
  if (!currentBank) return;
  const { questions } = currentBank;
  const stats = store.getStats();
  const seen = questions.filter(q => stats[q.hash]?.times_answered > 0).length;
  $('total-questions-info').textContent = questions.length
    ? `${questions.length} questions loaded · ${seen} answered at least once`
    : 'This question set is empty.';
  for (const id of ['random-count', 'random-from', 'random-to', 'learning-count']) {
    $(id).max = questions.length;
  }
}

function setStartEnabled(enabled) {
  $('btn-start-random').disabled = !enabled;
  $('btn-start-learning').disabled = !enabled;
}

function readInt(id) {
  const v = $(id).value.trim();
  return v === '' ? null : parseInt(v, 10);
}

function startRun(mode) {
  if (!currentBank) return;
  const { questions } = currentBank;
  const count = readInt(mode === 'random' ? 'random-count' : 'learning-count');
  if (!count || count < 1) {
    showToast('Enter how many questions you want (at least 1).');
    return;
  }

  let selected;
  try {
    selected = mode === 'random'
      ? pickRandom(questions, {
          count,
          from: readInt('random-from'),
          to: readInt('random-to'),
          randomize: $('random-shuffle').checked,
        })
      : pickLearning(questions, count, store.getStats());
  } catch (e) {
    showToast(e.message);
    return;
  }
  if (selected.length === 0) {
    showToast('No questions available for this filter.');
    return;
  }
  if (selected.length < count) {
    showToast(`Only ${selected.length} questions available, starting with those.`);
  }

  run = { bank: currentBank.id, mode, questions: selected, answers: [] };
  currentIndex = 0;
  timerSeconds = 0;
  startTimer();
  renderQuestion();
  showView('quiz');
}

$('bank-select').addEventListener('change', e => selectBank(e.target.value));
$('btn-start-random').addEventListener('click', () => startRun('random'));
$('btn-start-learning').addEventListener('click', () => startRun('learning'));

function goHome() {
  renderBankInfo();
  showView('home');
}

// ----------------------------------------------------------------------------
// QUIZ RUN
// ----------------------------------------------------------------------------

function startTimer() {
  clearInterval(timerInterval);
  $('quiz-timer').textContent = '00:00';
  timerInterval = setInterval(() => {
    timerSeconds++;
    $('quiz-timer').textContent = formatTime(timerSeconds);
  }, 1000);
}

function isAnswered() {
  return !$('explanation-container').classList.contains('hidden');
}

function renderQuestion() {
  const q = run.questions[currentIndex];
  const total = run.questions.length;

  $('quiz-counter').textContent = `Question ${currentIndex + 1} / ${total}`;
  $('quiz-progress').style.width = `${(currentIndex / total) * 100}%`;
  $('question-number').textContent = `#${q.number} in ${bankTitle(run.bank)}`;
  $('question-text').textContent = q.question;

  selectedChoice = null;
  const btnSubmit = $('btn-submit-answer');
  btnSubmit.disabled = true;
  btnSubmit.classList.remove('hidden');
  $('explanation-container').classList.add('hidden');

  const container = $('choices-container');
  container.innerHTML = '';
  for (const key of shuffle(CHOICE_KEYS)) {
    const btn = el('button', 'choice-btn', q.choices[key]);
    btn.dataset.key = key;
    btn.addEventListener('click', () => {
      if (isAnswered()) return;
      Array.from(container.children).forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
      selectedChoice = key;
      btnSubmit.disabled = false;
    });
    container.appendChild(btn);
  }
}

$('btn-submit-answer').addEventListener('click', () => {
  if (!selectedChoice || isAnswered()) return;
  const q = run.questions[currentIndex];
  const correct = selectedChoice === q.answer;

  store.recordAnswer(q.hash, !correct);
  run.answers.push({ question: q, selected: selectedChoice, correct });

  for (const btn of $('choices-container').children) {
    if (btn.dataset.key === q.answer) btn.classList.add('correct');
    else if (btn.dataset.key === selectedChoice) btn.classList.add('wrong');
  }

  $('explanation-text').textContent = q.explanation;
  $('explanation-container').classList.remove('hidden');
  $('btn-submit-answer').classList.add('hidden');
  $('btn-next-question').textContent =
    currentIndex === run.questions.length - 1 ? 'Finish' : 'Next Question';
});

$('btn-next-question').addEventListener('click', () => {
  if (currentIndex === run.questions.length - 1) {
    finishRun();
  } else {
    currentIndex++;
    renderQuestion();
    window.scrollTo(0, 0);
  }
});

function finishRun() {
  clearInterval(timerInterval);
  $('quiz-progress').style.width = '100%';

  const correct = run.answers.filter(a => a.correct).length;
  const total = run.answers.length;
  store.saveRun({
    date: localTimestamp(),
    bank: run.bank,
    mode: run.mode,
    total,
    correct,
    time_seconds: timerSeconds,
  });
  renderResultsSummary(correct, total);
}

// ----------------------------------------------------------------------------
// RESULTS SUMMARY
// ----------------------------------------------------------------------------

function truncate(text, n = 30) {
  return text.length > n ? text.substring(0, n) + '...' : text;
}

function renderResultsSummary(correct, total) {
  const pct = total ? (correct / total) * 100 : 0;
  $('results-score').textContent = `${correct} / ${total} correct (${pct.toFixed(1)}%)`;
  $('results-time').textContent = `Time taken: ${formatTime(timerSeconds)}`;
  $('results-mode').textContent =
    `Mode: ${run.mode === 'learning' ? 'Learning' : 'Random'} · ${bankTitle(run.bank)}`;

  const list = $('results-breakdown-list');
  list.innerHTML = '';
  for (const a of run.answers) {
    const row = el('div', `detail-row ${a.correct ? 'correct' : 'wrong'}`);
    row.appendChild(el('span', null, `Q${a.question.number}`));
    row.appendChild(el('span', null, a.correct
      ? 'Correct'
      : `Selected: "${truncate(a.question.choices[a.selected])}" | Correct: "${truncate(a.question.choices[a.question.answer])}"`));
    list.appendChild(row);
  }

  $('btn-results-review').classList.toggle('hidden', correct === total);
  showView('results');
}

$('btn-results-home').addEventListener('click', goHome);

$('btn-results-review').addEventListener('click', () => {
  renderReviewView();
  showView('review');
});

// ----------------------------------------------------------------------------
// REVIEW (read-only)
// ----------------------------------------------------------------------------

function renderReviewView() {
  const container = $('review-list');
  container.innerHTML = '';
  for (const a of run.answers.filter(x => !x.correct)) {
    const q = a.question;
    const item = el('div', 'review-item');
    item.appendChild(el('div', 'question', `Q${q.number}: ${q.question}`));
    item.appendChild(el('div', 'your-answer', `Your Answer: ${q.choices[a.selected]}`));
    item.appendChild(el('div', 'correct-answer', `Correct Answer: ${q.choices[q.answer]}`));
    item.appendChild(el('div', 'explanation-box', q.explanation));
    container.appendChild(item);
  }
}

$('btn-review-home').addEventListener('click', goHome);

// ----------------------------------------------------------------------------
// DASHBOARD
// ----------------------------------------------------------------------------

function loadDashboard(page) {
  const data = store.getRunsPage(page, PER_PAGE);
  dashboardPage = data.page;

  $('dash-page-info').textContent = `Page ${data.page} / ${data.totalPages}`;
  $('btn-dash-prev').disabled = data.page <= 1;
  $('btn-dash-next').disabled = data.page >= data.totalPages;

  const tbody = $('dashboard-table-body');
  tbody.innerHTML = '';
  if (data.runs.length === 0) {
    const tr = el('tr');
    const td = el('td', 'status-text', 'No runs yet.');
    td.colSpan = 7;
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  for (const r of data.runs) {
    const pct = r.total ? (r.correct / r.total) * 100 : 0;
    const tr = el('tr');
    for (const text of [
      r.id,
      formatDate(r.date),
      bankTitle(r.bank),
      r.mode === 'learning' ? 'Learning' : 'Random',
      `${r.correct} / ${r.total}`,
      `${pct.toFixed(1)}%`,
      formatTime(r.time_seconds),
    ]) {
      tr.appendChild(el('td', null, String(text)));
    }
    tbody.appendChild(tr);
  }
}

$('btn-goto-dashboard').addEventListener('click', () => {
  loadDashboard(1);
  showView('dashboard');
});

$('btn-dashboard-home').addEventListener('click', goHome);
$('btn-dash-prev').addEventListener('click', () => loadDashboard(dashboardPage - 1));
$('btn-dash-next').addEventListener('click', () => loadDashboard(dashboardPage + 1));

$('btn-dash-clear').addEventListener('click', () => {
  if (confirm('Are you sure? This will delete all run history and learning progress.')) {
    store.clearAll();
    showToast('History cleared.');
    loadDashboard(1);
  }
});

$('btn-dash-export').addEventListener('click', () => {
  const blob = new Blob([store.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = `epso-progress-${localTimestamp().substring(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

$('btn-dash-import').addEventListener('click', () => $('import-file').click());

$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!confirm('Importing replaces all progress currently saved in this browser. Continue?')) return;
  try {
    const count = store.importJson(await file.text());
    showToast(`Progress imported (${count} runs).`);
    loadDashboard(1);
  } catch (err) {
    console.error(err);
    showToast('That file is not a valid progress export.');
  }
});

// ----------------------------------------------------------------------------
// INIT
// ----------------------------------------------------------------------------

async function init() {
  setStartEnabled(false);
  if (!store.persistent) $('storage-warning').classList.remove('hidden');
  if (!window.crypto?.subtle) {
    $('total-questions-info').textContent = 'Open this page over https:// or localhost to use it.';
    return;
  }
  try {
    await loadBanks();
  } catch (e) {
    console.error(e);
    $('total-questions-info').textContent = 'Could not load the list of question sets (data/banks.json).';
    return;
  }
  await selectBank($('bank-select').value);
}

showView('home');
init();
