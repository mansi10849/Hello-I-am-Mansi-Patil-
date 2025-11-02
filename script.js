/* Enhanced vanilla JS demo */
const API_ENDPOINT = "http://127.0.0.1:5000/predict"; // set to your backend POST endpoint

// ---------- THEME ----------
const toggleBtn = document.getElementById('theme-toggle');
const stored = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (stored ? stored === 'dark' : prefersDark) document.documentElement.setAttribute('data-theme', 'dark');
toggleBtn.addEventListener('click', () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('theme', dark ? 'light' : 'dark');
});

// ---------- DOM ----------
const form = document.getElementById('predict-form');
const textarea = document.getElementById('news-text');
const predictBtn = document.getElementById('predict-btn');
const clearBtn = document.getElementById('clear-btn');
const errorEl = document.getElementById('error');
const resultCard = document.getElementById('result-card');
const badgeEl = document.getElementById('result-badge');
const confEl = document.getElementById('result-confidence');
const sparkEl = document.getElementById('sparkline');
const copyBtn = document.getElementById('copy-result');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const spinner = document.getElementById('loading-spinner');
const toast = document.getElementById('toast');

const HIST_KEY = 'fnd_history';

// ---------- UTILS ----------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const saveHistory = (h) => localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 20)));
const loadHistory = () => JSON.parse(localStorage.getItem(HIST_KEY) || '[]');

function showResult({ label, confidence }) {
  badgeEl.textContent = label;
  badgeEl.className = 'badge ' + label.toLowerCase();
  confEl.textContent = (confidence * 100).toFixed(1) + '%';
  resultCard.classList.remove('hidden');
  // tiny sparkline
  if (window.Recharts) {
    const { ResponsiveContainer, BarChart, Bar } = window.Recharts;
    const data = [{ name: 'c', v: confidence }];
    ReactDOM.render(
      React.createElement(ResponsiveContainer, { width: '100%', height: 50 },
        React.createElement(BarChart, { data },
          React.createElement(Bar, { dataKey: 'v', fill: label === 'Fake' ? '#ef4444' : '#10b981' })
        )
      ), sparkEl
    );
  }
}

function addHistory(item) {
  const h = [item, ...loadHistory()];
  saveHistory(h);
  renderHistory();
}

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = '';
  if (!items.length) return historyList.appendChild(Object.assign(document.createElement('li'), { textContent: 'No history yet.', className: 'muted' }));
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <div>
        <strong>${it.label}</strong> ${Math.round(it.confidence * 100)}%
        <div class="muted">${new Date(it.time).toLocaleTimeString()}</div>
      </div>
      <div>
        <button class="btn small load-btn" title="Load" tabindex="0">↻</button>
        <button class="btn small danger-btn" title="Delete" tabindex="0" aria-label="Delete history item">🗑️</button>
      </div>`;
    const [loadBtn, delBtn] = li.querySelectorAll('button');
    loadBtn.onclick = () => { textarea.value = it.text; showResult(it); };
    delBtn.onclick = () => {
      const newHist = loadHistory().filter((_, i) => i !== idx);
      saveHistory(newHist);
      renderHistory();
    };
    historyList.appendChild(li);
  });
}

// ---------- DEMO PREDICT ----------
function demoPredict(text) {
  const words = text.trim().split(/\s+/).length || 1;
  const caps = (text.match(/[A-Z]{3,}/g) || []).length / words;
  const score = Math.min(0.99, Math.max(0.05, caps * 0.8 + Math.random() * 0.4));
  return { label: score > 0.55 ? 'Fake' : 'Real', confidence: score, model: 'demo' };
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 1800);
}

async function predict(text) {
  if (!text.trim()) return (errorEl.textContent = 'Text is empty');
  errorEl.textContent = '';
  predictBtn.disabled = true;
  spinner.classList.remove('hidden'); // show spinner
  predictBtn.textContent = 'Predicting…';
  try {
    let res;
    if (API_ENDPOINT) {
      const r = await fetch(API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (!r.ok) {
        if (r.status === 0) throw new Error('Network error. Please check your connection.');
        throw new Error('Server error ' + r.status);
      }
      res = await r.json();
    } else {
      res = demoPredict(text);
    }
    showResult(res);
    addHistory({ text, ...res, time: Date.now() });
  } catch (e) {
    errorEl.textContent = e.message || 'Prediction failed. Try again.';
  } finally {
    predictBtn.disabled = false;
    predictBtn.textContent = 'Predict';
    spinner.classList.add('hidden'); // hide spinner
  }
}

// ---------- EVENTS ----------
form.addEventListener('submit', (e) => { e.preventDefault(); predict(textarea.value); });
clearBtn.addEventListener('click', () => { textarea.value = ''; resultCard.classList.add('hidden'); errorEl.textContent = ''; });

// Drag & Drop
['dragenter', 'dragover'].forEach(evt => dropZone.addEventListener(evt, (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(evt => dropZone.addEventListener(evt, (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
}));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name))) {
    file.text().then(t => textarea.value = t);
  } else {
    errorEl.textContent = 'Please drop a valid .txt or .md file.';
  }
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (file && (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name))) {
    file.text().then(t => textarea.value = t);
  } else {
    errorEl.textContent = 'Please select a valid .txt or .md file.';
  }
});

copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(`${badgeEl.textContent} – ${confEl.textContent}`);
  showToast('Result copied!');
});

clearHistoryBtn.addEventListener('click', () => { localStorage.removeItem(HIST_KEY); renderHistory(); });

// Keyboard accessibility for drop zone
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    fileInput.click();
    e.preventDefault();
  }
});

renderHistory();