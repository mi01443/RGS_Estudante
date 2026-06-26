/* ══════════════════════════════════════════
   RGS ESTUDANTE — app.js
   Toda a lógica do app em um só arquivo
══════════════════════════════════════════ */

// ──────────────────────────────────────────
//  CONFIGURAÇÕES FIXAS
// ──────────────────────────────────────────
const GS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycby9E6-dpf69cA9yCNM9fwqEpCqSj64ZOGPjoq4LouVOxCE6uKA65uEwHwBrl8CXvOez/exec';
const GROQ_KEY = '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';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ──────────────────────────────────────────
//  ESTADO GLOBAL
// ──────────────────────────────────────────
let cfg = { pin:'1234', gsUrl:'' };
let GS  = '';

let students   = [];
let tasks      = [];
let results    = [];

let currentStudent = null;
let currentTask    = null;
let currentQIdx    = 0;
let correctCount   = 0;
let geradaTemp     = null;
let prevScreen     = 'screenLogin';
let pinBuffer      = '';

// ──────────────────────────────────────────
//  ESTRELAS ANIMADAS
// ──────────────────────────────────────────
(function Stars() {
  const c = document.getElementById('starCanvas');
  const ctx = c.getContext('2d');
  let stars = [];
  function resize() { c.width = innerWidth; c.height = innerHeight; }
  resize(); window.addEventListener('resize', resize);
  for (let i = 0; i < 130; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.5 + .3, o: Math.random(), d: Math.random() > .5 ? 1 : -1 });
  function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    stars.forEach(s => {
      s.o += .008 * s.d; if (s.o > 1 || s.o < 0) s.d *= -1;
      ctx.beginPath(); ctx.arc(s.x * c.width, s.y * c.height, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.o})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
  setInterval(() => {
    const el = document.createElement('div');
    el.className = 'shoot';
    const len = Math.random() * 200 + 100;
    el.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*40}%;--dx:${len}px;--dy:${len}px;width:${Math.random()*2+1}px;height:${Math.random()*2+1}px;box-shadow:0 0 4px white;animation-duration:${Math.random()*.8+.4}s`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
  }, 4500);
})();

// ──────────────────────────────────────────
//  PWA INSTALL
// ──────────────────────────────────────────
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
  toast('✅ App instalado com sucesso!');
});

// ──────────────────────────────────────────
//  SPLASH → INIT
// ──────────────────────────────────────────
window.addEventListener('load', () => {
  loadLocalCfg();
  setTimeout(() => {
    const sp = document.getElementById('splash');
    sp.classList.add('hide');
    setTimeout(() => { sp.style.display = 'none'; App.init(); }, 700);
  }, 3500);
});

// ──────────────────────────────────────────
//  CONFIG LOCAL
// ──────────────────────────────────────────
function loadLocalCfg() {
  try { const c = localStorage.getItem('rgs_cfg'); if (c) cfg = { ...cfg, ...JSON.parse(c) }; } catch (e) { }
  GS = cfg.gsUrl || GS_URL_DEFAULT;
}
function saveLocalCfg() { localStorage.setItem('rgs_cfg', JSON.stringify(cfg)); }

// ──────────────────────────────────────────
//  JSONP — comunicação com Sheets sem CORS
// ──────────────────────────────────────────
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = 'rgs_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const sc = document.createElement('script');
    const tm = setTimeout(() => { delete window[cb]; sc.remove(); reject(new Error('timeout')); }, 12000);
    window[cb] = d => { clearTimeout(tm); delete window[cb]; sc.remove(); resolve(d); };
    sc.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    sc.onerror = () => { clearTimeout(tm); delete window[cb]; sc.remove(); reject(new Error('script error')); };
    document.head.appendChild(sc);
  });
}

async function gsCall(action, params = '') {
  if (!GS) return null;
  try {
    const url = GS + '?action=' + action + (params ? '&' + params : '');
    const d = await jsonp(url);
    return d;
  } catch (e) { console.error('gsCall', action, e); return null; }
}

// ──────────────────────────────────────────
//  LOADING / TOAST / BADGE
// ──────────────────────────────────────────
function showLoad(msg = 'Carregando...') {
  document.getElementById('loadingMsg').textContent = msg;
  document.getElementById('loadingOverlay').classList.add('show');
}
function hideLoad() { document.getElementById('loadingOverlay').classList.remove('show'); }

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function setBadge(state, label) {
  const b = document.getElementById('gsBadge');
  b.className = 'gs-badge' + (state === 'ok' ? ' ok' : state === 'err' ? ' err' : '');
  b.textContent = label;
}

// ──────────────────────────────────────────
//  SCREENS
// ──────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ──────────────────────────────────────────
//  APP — LÓGICA PRINCIPAL (FILHO)
// ──────────────────────────────────────────
const App = {

  async init() {
    showScreen('screenLogin');
    await this.syncAll();
  },

  async syncAll() {
    if (!GS) { setBadge('err', '⚡ Sem URL'); return; }
    setBadge('load', '⏳ Sync');
    showLoad('Conectando...');
    try {
      const d = await gsCall('tudo');
      if (d && d.alunos)  students = d.alunos;
      if (d && d.tarefas) tasks    = d.tarefas.map(normalizarTarefa);
      const r = await gsCall('resultados');
      if (r && r.resultados) results = r.resultados;
      setBadge('ok', '✅ Online');
    } catch (e) {
      setBadge('err', '❌ Offline');
      toast('Sem conexão com o Sheets.');
    }
    hideLoad();
  },

  async doLogin() {
    const name = document.getElementById('loginName').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    const errEl = document.getElementById('loginError');
    const btn   = document.getElementById('loginBtn');
    if (!name || !pass) { errEl.style.display = 'block'; errEl.textContent = 'Preencha nome e senha!'; return; }

    btn.innerHTML = '<div class="spinner sm"></div> Entrando...'; btn.disabled = true;

    // Recarrega alunos frescos do Sheets
    showLoad('Verificando...');
    const d = await gsCall('alunos');
    if (d && d.alunos) students = d.alunos;
    hideLoad();

    btn.innerHTML = '🚀 Decolar!'; btn.disabled = false;

    const s = students.find(s =>
      s.nome.toLowerCase() === name.toLowerCase() &&
      String(s.senha) === String(pass)
    );

    if (!s) {
      errEl.style.display = 'block';
      errEl.textContent = 'Nome ou senha incorretos 🚫';
      return;
    }
    errEl.style.display = 'none';
    currentStudent = s;
    document.getElementById('loginName').value = '';
    document.getElementById('loginPass').value = '';

    // Carrega tarefas frescas
    showLoad('Carregando missões...');
    const t = await gsCall('tarefas');
    if (t && t.tarefas) tasks = t.tarefas.map(normalizarTarefa);
    hideLoad();

    prevScreen = 'screenChild';
    this.refreshChild();
    showScreen('screenChild');
  },

  logout() {
    currentStudent = null;
    showScreen('screenLogin');
    document.getElementById('modeBtn').textContent = '🔒 Pais';
  },

  async installPWA() {
    if (!deferredPrompt) {
      toast('Abra o menu do navegador e toque em "Adicionar à tela inicial"');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') toast('🚀 Instalando...');
    deferredPrompt = null;
    document.getElementById('installBtn').style.display = 'none';
  },

  refreshChild() {
    if (!currentStudent) return;
    const s = currentStudent;
    const xp = s.xp || 0, lvl = Math.floor(xp / 100) + 1, inLvl = xp % 100;
    document.getElementById('heroName').textContent   = s.nome + '!';
    document.getElementById('childLevel').textContent  = lvl;
    document.getElementById('xpDisplay').textContent   = `${inLvl}/100 XP`;
    document.getElementById('xpFill').style.width      = (inLvl) + '%';
    document.getElementById('statMissoes').textContent  = s.missoes || 0;
    document.getElementById('statStars').textContent    = '⭐' + (s.estrelas || 0);
    const notas = s.notas || [];
    const avg   = notas.length ? (notas.reduce((a, b) => +a + +b, 0) / notas.length).toFixed(1) : '-';
    document.getElementById('statMedia').textContent    = avg;
    this.renderMissions();
  },

  renderMissions() {
    const sNome   = (currentStudent.nome || '').toLowerCase();
    const pending = tasks.filter(t => !t.done && (!t.targetStudent || t.targetStudent.toLowerCase() === sNome || t.targetStudent === ''));
    const done    = tasks.filter(t =>  t.done &&  (t.doneBy || '').toLowerCase() === sNome);

    const pendEl = document.getElementById('pendingList');
    const doneEl = document.getElementById('doneList');

    pendEl.innerHTML = pending.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🛸</div><div class="empty-msg">Nenhuma missão pendente.<br>Aguarde o comandante!</div></div>`
      : pending.map(t => `
        <div class="mission-card" onclick="App.startTask('${t.id}')">
          <div class="mission-header">
            <div class="mission-icon">${subIcon(t.subject)}</div>
            <div><div class="mission-name">${t.name}</div><div class="mission-meta">${t.subject} • ${t.questions.length} questões</div></div>
          </div>
          <div class="mission-footer">
            <span class="badge b-xp">+${t.xp} XP</span>
            <span class="badge b-subj">${t.subject}</span>
            <span class="badge b-diff">${t.diff || 'médio'}</span>
          </div>
        </div>`).join('');

    doneEl.innerHTML = done.length === 0
      ? `<div class="empty-state"><div class="empty-icon">🌙</div><div class="empty-msg">Nenhuma missão concluída ainda.</div></div>`
      : done.map(t => `
        <div class="mission-card" style="opacity:.65;cursor:default">
          <div class="mission-header">
            <div class="mission-icon">${subIcon(t.subject)}</div>
            <div><div class="mission-name">${t.name}</div><div class="mission-meta">${t.subject} • Nota: ${t.score}/10</div></div>
          </div>
          <div class="mission-footer">
            <span class="badge b-done">✅ Concluída</span>
            <span class="badge b-xp">+${t.xpEarned || t.xp} XP</span>
          </div>
        </div>`).join('');
  },

  startTask(id) {
    currentTask = tasks.find(t => t.id === id); if (!currentTask) return;
    currentQIdx = 0; correctCount = 0;
    document.getElementById('taskTitle').textContent = currentTask.name;
    document.getElementById('qTotal').textContent    = currentTask.questions.length;
    prevScreen = 'screenChild';
    showScreen('screenTask');
    this.renderQuestion();
  },

  renderQuestion() {
    const q     = currentTask.questions[currentQIdx];
    const total = currentTask.questions.length;
    document.getElementById('qNum').textContent       = `QUESTÃO ${currentQIdx + 1}`;
    document.getElementById('qText').textContent      = q.question;
    document.getElementById('qCurrent').textContent   = currentQIdx + 1;
    document.getElementById('qScore').textContent     = `${correctCount} certas`;
    document.getElementById('progFill').style.width   = (currentQIdx / total * 100) + '%';
    document.getElementById('feedbackBar').className  = 'feedback-bar';
    document.getElementById('nextBtn').className      = 'btn primary block next-btn';

    const area = document.getElementById('optionsArea');
    if (q.options && q.options.length) {
      area.innerHTML = `<div class="options-grid">${q.options.map((opt, i) => {
        const safe = opt.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `<button class="opt-btn" data-opt="${safe}" data-ans="${q.answer.replace(/"/g,'&quot;').replace(/'/g,'&#39;')}" onclick="App.selectOpt(this)">${opt}</button>`;
      }).join('')}</div>`;
    } else {
      area.innerHTML = `<textarea class="open-ans" id="openAns" rows="3" placeholder="Escreva sua resposta..."></textarea>
        <button class="btn primary block" onclick="App.submitOpen()">Confirmar ✓</button>`;
    }
  },

  selectOpt(btn) {
    const selected = btn.dataset.opt || '';
    const answer   = btn.dataset.ans || '';
    console.log('Selected:', selected, '| Answer:', answer);
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
    const norm = s => (s || '').trim().toLowerCase().replace(/^[a-d][).:\s]+/,'');
    const ok   = norm(selected) === norm(answer);
    btn.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) {
      document.querySelectorAll('.opt-btn').forEach(b => {
        if (norm(b.dataset.opt) === norm(answer)) b.classList.add('correct');
      });
    }
    this.showFeedback(ok, answer);
    if (ok) correctCount++;
    document.getElementById('nextBtn').classList.add('visible');
  },

  submitOpen() {
    const ans = document.getElementById('openAns').value.trim();
    if (!ans) { toast('Escreva sua resposta!'); return; }
    const q  = currentTask.questions[currentQIdx];
    const ok = ans.toLowerCase().includes(q.answer.toLowerCase()) || q.answer.toLowerCase().includes(ans.toLowerCase());
    this.showFeedback(ok, q.answer);
    if (ok) correctCount++;
    document.getElementById('openAns').disabled = true;
    const sb = document.querySelector('#optionsArea .btn'); if (sb) sb.style.display = 'none';
    document.getElementById('nextBtn').classList.add('visible');
  },

  showFeedback(ok, answer) {
    const bar = document.getElementById('feedbackBar');
    bar.className = 'feedback-bar ' + (ok ? 'correct' : 'wrong');
    document.getElementById('fbIcon').textContent = ok ? '✅' : '❌';
    document.getElementById('fbMsg').textContent  = ok ? 'Correto! Muito bem! 🎉' : 'Ops! A resposta era: ' + answer;
  },

  nextQuestion() {
    currentQIdx++;
    if (currentQIdx >= currentTask.questions.length) this.finishTask(); else this.renderQuestion();
  },

  async finishTask() {
    const total    = currentTask.questions.length;
    const grade    = Math.round(correctCount / total * 10);
    const xpEarned = Math.round(currentTask.xp * (correctCount / total));
    const stars    = grade >= 9 ? 3 : grade >= 7 ? 2 : grade >= 5 ? 1 : 0;

    currentTask.done = true; currentTask.score = grade;
    currentTask.xpEarned = xpEarned; currentTask.doneBy = currentStudent.nome;

    currentStudent.xp       = (+(currentStudent.xp) || 0) + xpEarned;
    currentStudent.missoes  = (+(currentStudent.missoes) || 0) + 1;
    currentStudent.estrelas = (+(currentStudent.estrelas) || 0) + stars;
    if (!currentStudent.notas) currentStudent.notas = [];
    currentStudent.notas.push(grade);

    showLoad('Salvando resultado...');
    await gsCall('salvarResultado', 'data=' + encodeURIComponent(JSON.stringify({
      taskId: currentTask.id, taskName: currentTask.name, subject: currentTask.subject,
      childName: currentStudent.nome, grade, correct: correctCount, total, xpEarned, stars
    })));
    hideLoad();

    const trophies = { 3: '🏆', 2: '🥈', 1: '🥉', 0: '😅' };
    const titles   = { 3: 'Lendário!', 2: 'Incrível!', 1: 'Bom trabalho!', 0: 'Continue tentando!' };
    document.getElementById('resTrophy').textContent  = trophies[stars] || '🎖️';
    document.getElementById('resTitle').textContent   = titles[stars]   || 'Concluído!';
    document.getElementById('resSub').textContent     = currentStudent.nome + ', missão concluída!';
    document.getElementById('resScore').textContent   = `${correctCount}/${total}`;
    document.getElementById('resCorrect').textContent = correctCount;
    document.getElementById('resWrong').textContent   = total - correctCount;
    document.getElementById('resGrade').textContent   = grade;
    document.getElementById('resXp').textContent      = `+${xpEarned} XP! ${'⭐'.repeat(stars)}`;
    showScreen('screenResult');
    spawnXpPop(xpEarned);
    if (stars >= 2) launchConfetti();
  },

  async afterResult() {
    showLoad('Atualizando...');
    const d = await gsCall('tudo');
    if (d && d.alunos) {
      students = d.alunos;
      currentStudent = students.find(s => s.nome.toLowerCase() === currentStudent.nome.toLowerCase()) || currentStudent;
    }
    if (d && d.tarefas) tasks = d.tarefas.map(normalizarTarefa);
    hideLoad();
    this.refreshChild();
    showScreen('screenChild');
  },

  goBack() {
    showScreen(prevScreen);
    if (prevScreen === 'screenChild') this.refreshChild();
  },

  // ── PIN / MODE TOGGLE ──
  toggleMode() {
    if (document.getElementById('screenParent').classList.contains('active')) {
      this.exitParent(); return;
    }
    pinBuffer = ''; this.updateDots();
    document.getElementById('pinError').style.display = 'none';
    showScreen('screenParentLogin');
  },

  pinDigit(d) {
    if (pinBuffer.length >= 6) return;
    pinBuffer += d; this.updateDots();
    if (pinBuffer.length >= 4) setTimeout(() => this.pinCheck(), 300);
  },
  pinDel()  { pinBuffer = pinBuffer.slice(0, -1); this.updateDots(); },
  updateDots() {
    for (let i = 0; i < 4; i++) {
      document.getElementById('pd' + i).classList.toggle('filled', i < pinBuffer.length);
    }
  },
  pinCheck() {
    if (pinBuffer === cfg.pin) {
      this.enterParent();
    } else {
      const e = document.getElementById('pinError');
      e.style.display = 'block'; e.textContent = 'PIN incorreto! 🚫';
      pinBuffer = ''; this.updateDots();
      setTimeout(() => e.style.display = 'none', 2000);
    }
  },
  cancelPin() { showScreen(prevScreen); },

  async enterParent() {
    showScreen('screenParent');
    document.getElementById('modeBtn').textContent = '👦 Filho';
    document.getElementById('cfgGs').value  = cfg.gsUrl || GS_URL_DEFAULT;
    document.getElementById('cfgPin').value = '';
    showLoad('Carregando painel...');
    const d = await gsCall('tudo');
    if (d && d.alunos)  students = d.alunos;
    if (d && d.tarefas) tasks    = d.tarefas.map(normalizarTarefa);
    const r = await gsCall('resultados');
    if (r && r.resultados) results = r.resultados;
    hideLoad();
    Parent.renderAll();
  },

  exitParent() {
    document.getElementById('modeBtn').textContent = '🔒 Pais';
    showScreen('screenLogin');
  }
};

// ──────────────────────────────────────────
//  PARENT — painel dos pais
// ──────────────────────────────────────────
const Parent = {

  tab(name) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    document.getElementById('pane-' + name).classList.add('active');
  },

  renderAll() {
    this.renderDash();
    this.renderAlunos();
    this.renderMissoes();
    this.renderResultados();
    // Popula select de alunos no form
    const sel = document.getElementById('fTarget');
    sel.innerHTML = '<option value="">— Todos —</option>';
    students.forEach(s => {
      const o = document.createElement('option'); o.value = s.nome; o.textContent = s.nome; sel.appendChild(o);
    });
  },

  renderDash() {
    document.getElementById('kAlunos').textContent  = students.length;
    document.getElementById('kMissoes').textContent = tasks.length;
    document.getElementById('kFeitas').textContent  = tasks.filter(t => t.done).length;
    const notas = results.map(r => +(r.nota) || 0);
    document.getElementById('kMedia').textContent   = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '-';

    // Ranking
    const rank = [...students].sort((a, b) => (b.xp || 0) - (a.xp || 0));
    document.getElementById('rankingWrap').innerHTML = rank.length === 0
      ? emptyRow(7, 'Nenhum aluno cadastrado')
      : `<table><thead><tr><th>#</th><th>Aluno</th><th>Nível</th><th>XP</th><th>Missões</th><th>Média</th><th>⭐</th></tr></thead><tbody>${rank.map((s, i) => `
        <tr>
          <td><b>${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</b></td>
          <td><span class="avatar">${s.nome[0].toUpperCase()}</span>${s.nome}</td>
          <td><span class="badge b-pend">Nv ${s.nivel || 1}</span></td>
          <td>${s.xp || 0}</td><td>${s.missoes || 0}</td>
          <td>${barNota(s.media || 0)}</td>
          <td>${'⭐'.repeat(Math.min(s.estrelas || 0, 5))}</td>
        </tr>`).join('')}</tbody></table>`;

    // Últimas missões
    const ult = [...tasks].reverse().slice(0, 8);
    document.getElementById('recentWrap').innerHTML = ult.length === 0
      ? emptyRow(4, 'Nenhuma missão criada')
      : `<table><thead><tr><th>Missão</th><th>Matéria</th><th>Para</th><th>Status</th></tr></thead><tbody>${ult.map(t => `
        <tr>
          <td>${subIcon(t.subject)} ${t.name}</td>
          <td><span class="badge b-subj">${t.subject}</span></td>
          <td>${t.targetStudent || 'Todos'}</td>
          <td>${t.done ? `<span class="badge b-ok">✅ ${t.score}/10</span>` : '<span class="badge b-pend">⏳ Pendente</span>'}</td>
        </tr>`).join('')}</tbody></table>`;
  },

  renderAlunos() {
    document.getElementById('alunosWrap').innerHTML = students.length === 0
      ? emptyRow(7, 'Nenhum aluno cadastrado')
      : `<table><thead><tr><th>Nome</th><th>Nível</th><th>XP</th><th>Missões</th><th>Média</th><th>⭐</th><th></th></tr></thead><tbody>${students.map(s => `
        <tr>
          <td><span class="avatar">${s.nome[0].toUpperCase()}</span><b>${s.nome}</b></td>
          <td><span class="badge b-pend">Nv ${s.nivel || 1}</span></td>
          <td>${s.xp || 0}</td><td>${s.missoes || 0}</td>
          <td>${barNota(s.media || 0)}</td>
          <td>${'⭐'.repeat(Math.min(s.estrelas || 0, 5))}</td>
          <td><button class="btn danger" onclick="Parent.removeAluno('${s.nome}')">🗑️</button></td>
        </tr>`).join('')}</tbody></table>`;
  },

  async addAluno() {
    const nome  = document.getElementById('novoNome').value.trim();
    const senha = document.getElementById('novaSenha').value.trim();
    if (!nome || !senha)  { toast('Preencha nome e senha!'); return; }
    if (senha.length < 4) { toast('Senha deve ter 4+ dígitos!'); return; }
    if (students.find(s => s.nome.toLowerCase() === nome.toLowerCase())) { toast('Nome já cadastrado!'); return; }

    showLoad('Cadastrando aluno...');
    const r = await gsCall('salvarAluno', 'data=' + encodeURIComponent(JSON.stringify({ nome, senha: String(senha), xp:0, nivel:1, missoes:0, estrelas:0, notas:[] })));
    hideLoad();

    if (r && r.ok) {
      students.push({ nome, senha: String(senha), xp:0, nivel:1, missoes:0, estrelas:0, notas:[], media:0 });
      this.renderAll();
      document.getElementById('novoNome').value  = '';
      document.getElementById('novaSenha').value = '';
      toast('👦 ' + nome + ' cadastrado!');
    } else {
      toast('Erro ao salvar. Verifique a URL do Sheets.');
    }
  },

  async removeAluno(nome) {
    if (!confirm('Remover ' + nome + '?')) return;
    showLoad('Removendo...');
    await gsCall('deletarAluno', 'nome=' + encodeURIComponent(nome));
    students = students.filter(s => s.nome !== nome);
    this.renderAll();
    hideLoad();
    toast(nome + ' removido.');
  },

  renderMissoes() {
    document.getElementById('missoesWrap').innerHTML = tasks.length === 0
      ? emptyRow(8, 'Nenhuma missão criada')
      : `<table><thead><tr><th>Nome</th><th>Matéria</th><th>Dif.</th><th>Q</th><th>XP</th><th>Para</th><th>Status</th><th></th></tr></thead><tbody>${[...tasks].reverse().map(t => `
        <tr>
          <td>${subIcon(t.subject)} <b>${t.name}</b></td>
          <td><span class="badge b-subj">${t.subject}</span></td>
          <td><span class="badge b-diff">${t.diff || 'médio'}</span></td>
          <td>${t.questions.length}</td>
          <td><span class="badge b-pend">${t.xp}</span></td>
          <td>${t.targetStudent || 'Todos'}</td>
          <td>${t.done ? `<span class="badge b-ok">✅ ${t.score}/10</span>` : '<span class="badge b-pend">⏳</span>'}</td>
          <td><button class="btn danger" onclick="Parent.removeMissao('${t.id}')">🗑️</button></td>
        </tr>`).join('')}</tbody></table>`;
  },

  async gerar() {
    const subject = document.getElementById('fSubject').value;
    const tema    = document.getElementById('fTema').value.trim();
    const diff    = document.getElementById('fDiff').value;
    const qty     = parseInt(document.getElementById('fQty').value);
    const target  = document.getElementById('fTarget').value;
    if (!tema) { toast('Descreva o tema da atividade!'); return; }

    const btn = document.getElementById('btnGerar');
    btn.disabled = true; btn.innerHTML = '<div class="spinner sm"></div> Gerando com IA...';
    document.getElementById('previewBox').classList.remove('show');

    const prompt = `Você é um professor criativo. Crie ${qty} questões de múltipla escolha sobre "${tema}" para crianças do ensino fundamental. Matéria: ${subject}. Dificuldade: ${diff}.

IMPORTANTE: Responda SOMENTE com o JSON abaixo, sem nenhum texto antes ou depois, sem markdown, sem \`\`\`:

{"title":"Nome da missão","questions":[{"question":"Pergunta aqui?","options":["A) texto","B) texto","C) texto","D) texto"],"answer":"A) texto"}]}

REGRAS OBRIGATÓRIAS:
1. O campo "answer" deve ser EXATAMENTE IGUAL a uma das opções em "options"
2. Sempre 4 opções: A), B), C), D)
3. Linguagem simples para crianças
4. Retorne APENAS o JSON, nada mais`;

    try {
      // Groq API — gratuito e rápido
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 3000
        })
      });
      const data = await res.json();
      console.log('Groq response:', JSON.stringify(data).slice(0, 300));
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      if (!data.choices || !data.choices.length) throw new Error('Sem resposta: ' + JSON.stringify(data));
      const text = data.choices[0].message.content;
      console.log('Gemini text:', text.slice(0, 200));
      // Limpa possível markdown
      const clean = text.replace(/```json|```/g, '').trim();
      const jm = clean.match(/\{[\s\S]*\}/);
      if (!jm) throw new Error('JSON não encontrado. Resposta: ' + text.slice(0, 100));
      const parsed = JSON.parse(jm[0]);
      if (!parsed.questions || !parsed.questions.length) throw new Error('Sem questões na resposta');
      // Normaliza questões — garante formato correto
      parsed.questions = parsed.questions.map(q => {
        // Garante que options existe e tem 4 itens
        const opts = (q.options || []).map((o, i) => {
          const letters = ['A','B','C','D'];
          const clean = o.replace(/^[A-Da-d][).:]\s*/,'').trim();
          return `${letters[i]}) ${clean}`;
        });
        // Encontra a resposta correta pelo conteúdo
        const ansClean = (q.answer || '').replace(/^[A-Da-d][).:]\s*/,'').trim().toLowerCase();
        const matched  = opts.find(o => o.replace(/^[A-D]\) /,'').toLowerCase() === ansClean) || opts[0];
        console.log('Q:', q.question, '| ANS:', matched, '| OPTS:', opts);
        return { question: q.question, options: opts, answer: matched };
      });
      geradaTemp = { id: 't' + Date.now(), name: parsed.title, subject, diff, questions: parsed.questions, xp: qty * 10, created: new Date().toISOString(), done: false, targetStudent: target || '' };
      this.showPreview();
    } catch (e) {
      console.error('Gemini error:', e);
      toast('⚠️ Erro na IA: ' + e.message);
      // NÃO cria template — mostra erro para depurar
      btn.disabled = false; btn.innerHTML = '🤖 Gerar Missão com IA';
      return;
    }

    btn.disabled = false; btn.innerHTML = '🤖 Gerar Missão com IA';
  },

  showPreview() {
    const q = geradaTemp.questions;
    document.getElementById('previewContent').innerHTML =
      `<div style="font-weight:800;color:var(--gold);margin-bottom:8px">${geradaTemp.name}</div>` +
      q.slice(0, 3).map((it, i) => `<div class="preview-q">📌 ${i + 1}. ${it.question}</div>`).join('') +
      (q.length > 3 ? `<div class="preview-q" style="opacity:.5">...e mais ${q.length - 3} questões</div>` : '') +
      `<div style="font-size:.73rem;color:var(--neon);margin-top:7px">✅ ${q.length} questões com gabarito automático</div>`;
    document.getElementById('previewBox').classList.add('show');
  },

  async publicar() {
    if (!geradaTemp) return;
    showLoad('Publicando missão...');
    const r = await gsCall('salvarTarefa', 'data=' + encodeURIComponent(JSON.stringify(geradaTemp)));
    hideLoad();
    if (r && r.ok) {
      tasks.push(geradaTemp);
      this.renderAll();
      document.getElementById('previewBox').classList.remove('show');
      document.getElementById('fTema').value = '';
      geradaTemp = null;
      toast('🚀 Missão publicada!');
      this.tab('missoes');
    } else {
      toast('Erro ao publicar. Verifique o Sheets.');
    }
  },

  async removeMissao(id) {
    if (!confirm('Remover esta missão?')) return;
    showLoad('Removendo...');
    await gsCall('deletarTarefa', 'id=' + encodeURIComponent(id));
    tasks = tasks.filter(t => t.id !== id);
    this.renderAll();
    hideLoad();
    toast('Missão removida.');
  },

  renderResultados() {
    const wrap = document.getElementById('resultadosWrap');
    if (!students.length) { wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">👦</div><div class="empty-msg">Nenhum aluno cadastrado.</div></div>'; return; }
    wrap.innerHTML = students.map(s => {
      const res = results.filter(r => (r.aluno || '').toLowerCase() === s.nome.toLowerCase());
      const notas = res.map(r => +(r.nota) || 0);
      const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) : '-';
      return `
        <div class="student-result-block">
          <div class="srb-head">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="avatar">${s.nome[0].toUpperCase()}</span>
                <div><div class="srb-name">${s.nome}</div><div class="srb-meta">Nível ${s.nivel||1} • ${s.xp||0} XP • Média: ${media}</div></div>
              </div>
            </div>
            <span class="badge b-pend">${res.length} missões</span>
          </div>
          ${res.length === 0
            ? '<div style="text-align:center;opacity:.5;padding:1.2rem;font-size:.83rem">Nenhuma missão concluída ainda.</div>'
            : `<table><thead><tr><th>Missão</th><th>Nota</th><th>Resultado</th><th>Estrelas</th></tr></thead><tbody>${res.map(r => `
              <tr>
                <td><b>${r.missao || '-'}</b><div style="font-size:.7rem;color:var(--muted)">${r.materia||''} • ${r.certas||0}/${r.total||0} certas</div></td>
                <td>${barNota(+(r.nota)||0)}</td>
                <td>${r.aprovacao || '-'}</td>
                <td>${r.estrelas || ''}</td>
              </tr>`).join('')}</tbody></table>`}
        </div>`;
    }).join('');
  },

  salvarPin() {
    const p = document.getElementById('cfgPin').value.trim();
    if (p.length < 4) { toast('PIN deve ter 4+ dígitos!'); return; }
    cfg.pin = p; saveLocalCfg();
    document.getElementById('cfgPin').value = '';
    toast('✅ PIN alterado!');
  },

  salvarGs() {
    const url = document.getElementById('cfgGs').value.trim();
    cfg.gsUrl = url; GS = url || GS_URL_DEFAULT; saveLocalCfg();
    toast('✅ URL salva! Reconectando...');
    setTimeout(() => App.syncAll(), 500);
  }
};

// ──────────────────────────────────────────
//  UTILITÁRIOS
// ──────────────────────────────────────────
function normalizarTarefa(t) {
  if (!t || !t.questions) return t;
  t.questions = t.questions.map(q => {
    if (!q.options || !q.options.length) return q;
    // Garante prefixo A) B) C) D)
    const letters = ['A','B','C','D'];
    const opts = q.options.map((o, i) => {
      const clean = (o || '').replace(/^[A-Da-d][).:]\s*/,'').trim();
      return `${letters[i] || i}) ${clean}`;
    });
    // Encontra resposta correta
    const ansRaw   = (q.answer || '').replace(/^[A-Da-d][).:]\s*/,'').trim().toLowerCase();
    const matched  = opts.find(o => o.replace(/^[A-D]\) /i,'').toLowerCase() === ansRaw);
    return { question: q.question, options: opts, answer: matched || opts[0] };
  });
  return t;
}

function subIcon(s) {
  return { Matemática:'🔢', Português:'📝', Ciências:'🔬', História:'📜', Geografia:'🗺️', Inglês:'🌍', Lógica:'🧠' }[s] || '📚';
}

function barNota(n) {
  return `<div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${n*10}%"></div></div><div class="nota-n">${n}</div></div>`;
}

function emptyRow(cols, msg) {
  return `<div class="empty-state"><div class="empty-msg">${msg}</div></div>`;
}

function makeTemplate(subject, tema, diff, qty, target) {
  const qs = [];
  for (let i = 1; i <= qty; i++) qs.push({ question: `Questão ${i} sobre "${tema}".`, options: ['A) Opção 1','B) Opção 2','C) Opção 3','D) Opção 4'], answer: 'A) Opção 1' });
  return { id: 't' + Date.now(), name: `Missão: ${tema}`, subject, diff, questions: qs, xp: qty*10, created: new Date().toISOString(), done: false, targetStudent: target || '' };
}

function spawnXpPop(xp) {
  const el = document.createElement('div'); el.className = 'xp-pop';
  el.textContent = `+${xp} XP!`; document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function launchConfetti() {
  const colors = ['#FFD700','#ff6eb4','#b06eff','#64c8ff','#39ff14','#ff4757'];
  for (let i = 0; i < 60; i++) {
    const el = document.createElement('div'); el.className = 'confetti';
    const dur = Math.random() * 2 + 1.5, delay = Math.random();
    el.style.cssText = `left:${Math.random()*100}%;top:-20px;width:${Math.random()*10+4}px;height:${Math.random()*10+4}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${dur}s;animation-delay:${delay}s;border-radius:${Math.random()>.5?'50%':'2px'}`;
    document.body.appendChild(el); setTimeout(() => el.remove(), (dur + delay) * 1000 + 500);
  }
}

// Enter key no login filho
document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('screenLogin').classList.contains('active')) App.doLogin();
  }
});
