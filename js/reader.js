let currentUser = null;
let novelA = null;
let novelB = null;
let selectedNovel = null;
let skipLeft = 3;
let bailEvalSel = null;
let reasonSel = null;
let evalSel = null;

// 初期化
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  // 読書ロック確認
  const { data: lock } = await sb.from('reading_lock').select('*').eq('user_id', currentUser.id).single();
  if (lock) {
    const { data: novel } = await sb.from('novels').select('*').eq('id', lock.novel_id).single();
    if (novel) {
      selectedNovel = novel;
      renderReadScreen(novel);
      goTo('s-read');
      return;
    }
  }

  // スキップ残数取得
  const today = new Date().toISOString().split('T')[0];
  const { data: skipData } = await sb.from('skips').select('count').eq('user_id', currentUser.id).eq('skip_date', today).single();
  if (skipData) skipLeft = Math.max(0, 3 - skipData.count);
  document.getElementById('skip-ct').textContent = 'スキップ残り ' + skipLeft + '回';
})();

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

async function startSearch() {
  goTo('s-pick');
  await loadCards();
}

async function loadCards() {
  const cardsRow = document.getElementById('cards-row');
  cardsRow.innerHTML = '<div class="loading">読み込み中...</div>';
  document.getElementById('read-btn').disabled = true;
  document.getElementById('skip-row').style.display = 'flex';
  selectedNovel = null;
  novelA = null;
  novelB = null;

  // 選択ジャンル・文字数
  const selGenres = [...document.querySelectorAll('#s-setup .tag.sel')].map(t => t.textContent).filter(t => !['〜1万字','1〜5万字','5〜15万字','15万字〜'].includes(t));
  const selSizes = [...document.querySelectorAll('#s-setup .tag.sel')].map(t => t.textContent).filter(t => ['〜1万字','1〜5万字','5〜15万字','15万字〜'].includes(t));
  const evalMin = parseInt(document.getElementById('eval-min').value) || 0;
  const evalMax = parseInt(document.getElementById('eval-max').value) || 100;

  let charMin = 0, charMax = 9999999;
  if (selSizes.length > 0) {
    charMin = 9999999; charMax = 0;
    selSizes.forEach(s => {
      if (s === '〜1万字')    { charMin = Math.min(charMin, 0);      charMax = Math.max(charMax, 10000); }
      if (s === '1〜5万字')   { charMin = Math.min(charMin, 10001);  charMax = Math.max(charMax, 50000); }
      if (s === '5〜15万字')  { charMin = Math.min(charMin, 50001);  charMax = Math.max(charMax, 150000); }
      if (s === '15万字〜')   { charMin = Math.min(charMin, 150001); charMax = Math.max(charMax, 9999999); }
    });
  }

  let query = sb.from('novels').select('*').eq('is_visible', true);
  if (selGenres.length > 0) query = query.in('genre', selGenres);
  if (charMin > 0) query = query.gte('char_count', charMin);
  if (charMax < 9999999) query = query.lte('char_count', charMax);

  const minScore = Math.max(0, (evalMin - 5)) / 100;
  const maxScore = Math.min(100, (evalMax + 5)) / 100;
  query = query.gte('bayes_score', minScore).lte('bayes_score', maxScore);

  // 自分が読んだ・スキップした作品を除外
  const { data: readNovels } = await sb.from('reviews').select('novel_id').eq('user_id', currentUser.id);
  const readIds = readNovels ? readNovels.map(r => r.novel_id) : [];
  if (readIds.length > 0) query = query.not('id', 'in', '(' + readIds.join(',') + ')');

  const { data: novels } = await query.limit(20);

  // 2件未満 → 条件設定に戻るボタンを表示
  if (!novels || novels.length < 2) {
    cardsRow.innerHTML = '<div class="no-novels" style="grid-column:1/-1">条件に合う作品が見つかりませんでした。<br>条件を変えて試してみてください。</div>';
    document.getElementById('skip-row').style.display = 'none';
    document.getElementById('read-btn').style.display = 'none';
    document.getElementById('back-btn').style.display = 'block';
    return;
  }

  // 通常表示に戻す
  document.getElementById('read-btn').style.display = 'block';
  document.getElementById('back-btn').style.display = 'none';

  const shuffled = novels.sort(() => Math.random() - 0.5);
  novelA = shuffled[0];
  novelB = shuffled[1];

  cardsRow.innerHTML = '';
  cardsRow.appendChild(makeCard(novelA, 'A'));
  cardsRow.appendChild(makeCard(novelB, 'B'));
}

function makeCard(novel, which) {
  const charStr = novel.char_count ? Math.round(novel.char_count / 10000 * 10) / 10 + '万字' : '';
  const pct = Math.round(novel.bayes_score * 100);
  const div = document.createElement('div');
  div.className = 'novel-card';
  div.id = 'card-' + which;
  div.innerHTML =
    '<div class="c-genre">' + (novel.genre || '') + (charStr ? ' · ' + charStr : '') + '</div>' +
    '<div class="c-title">' + escHtml(novel.title) + '</div>' +
    '<div class="c-copy">' + escHtml(novel.catchcopy) + '</div>' +
    '<div class="c-meta"><span>♥ ' + pct + '%</span><span>完結</span></div>';
  div.onclick = () => selCard(which, novel);
  return div;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function selCard(which, novel) {
  document.getElementById('card-A') && document.getElementById('card-A').classList.remove('sel');
  document.getElementById('card-B') && document.getElementById('card-B').classList.remove('sel');
  document.getElementById('card-' + which).classList.add('sel');
  selectedNovel = novel;
  document.getElementById('read-btn').disabled = false;
}

async function goRead() {
  if (!selectedNovel) return;
  await sb.from('reading_lock').upsert({ user_id: currentUser.id, novel_id: selectedNovel.id });
  await recordStats(selectedNovel.id, novelA.id, novelB.id);
  renderReadScreen(selectedNovel);
  goTo('s-read');
}

async function recordStats(chosenId, aId, bId) {
  await sb.rpc('increment_chosen', { p_novel_id: chosenId }).catch(() => {});
  const notChosenId = chosenId === aId ? bId : aId;
  await sb.rpc('increment_not_chosen', { p_novel_id: notChosenId }).catch(() => {});
}

function renderReadScreen(novel) {
  document.getElementById('read-title').textContent = novel.title;
  const body = document.getElementById('read-body');
  body.innerHTML = '';
  const parts = novel.body.split('---CHAPTER---');
  parts.forEach((part, i) => {
    if (i > 0) {
      const sep = document.createElement('div');
      sep.className = 'chapter-sep';
      sep.textContent = '― 章 ―';
      body.appendChild(sep);
    }
    part.split('\n').forEach(line => {
      const p = document.createElement('p');
      p.textContent = line;
      body.appendChild(p);
    });
  });
  document.getElementById('prog-bar').style.width = '0%';
}

function updProg() {
  const el = document.getElementById('read-body');
  const pct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100 || 0;
  document.getElementById('prog-bar').style.width = Math.min(100, Math.round(pct)) + '%';
}

async function doSkip() {
  if (skipLeft <= 0) { alert('本日のスキップ回数を使い切りました'); return; }
  skipLeft--;
  document.getElementById('skip-ct').textContent = 'スキップ残り ' + skipLeft + '回';
  const today = new Date().toISOString().split('T')[0];
  await sb.from('skips').upsert({ user_id: currentUser.id, skip_date: today, count: 3 - skipLeft }, { onConflict: 'user_id,skip_date' });
  await loadCards();
}

function backToSetup() {
  document.getElementById('read-btn').style.display = 'block';
  document.getElementById('back-btn').style.display = 'none';
  document.getElementById('skip-row').style.display = 'flex';
  goTo('s-setup');
}

// 途中離脱
function selBailEval(el, key) {
  document.querySelectorAll('#bail-eval-grp .eval-opt').forEach(b => b.classList.remove('sel-good','sel-mid','sel-bad'));
  el.classList.add('sel-' + key);
  bailEvalSel = key;
  checkBailReady();
}

function selReason(el, key) {
  document.querySelectorAll('#reason-grp .reason-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  reasonSel = key;
  checkBailReady();
}

function checkBailReady() {
  document.getElementById('bail-submit').disabled = !(bailEvalSel && reasonSel);
}

async function submitBail() {
  const comment = document.getElementById('bail-comment').value.trim() || null;
  const btn = document.getElementById('bail-submit');
  btn.disabled = true; btn.textContent = '送信中...';
  await sb.from('reviews').insert({ novel_id: selectedNovel.id, user_id: currentUser.id, rating: bailEvalSel, is_completed: false, bail_reason: reasonSel, comment });
  await updateBayesScore(selectedNovel.id);
  await sb.from('reading_lock').delete().eq('user_id', currentUser.id);
  evalSel = null;
  await showDone();
}

// 評価
function selEval(el, key) {
  document.querySelectorAll('#eval-grp .eval-opt').forEach(b => b.classList.remove('sel-good','sel-mid','sel-bad'));
  el.classList.add('sel-' + key);
  evalSel = key;
  document.getElementById('eval-submit').disabled = false;
}

async function submitEval() {
  const comment = document.getElementById('eval-comment').value.trim() || null;
  const btn = document.getElementById('eval-submit');
  btn.disabled = true; btn.textContent = '送信中...';
  await sb.from('reviews').insert({ novel_id: selectedNovel.id, user_id: currentUser.id, rating: evalSel, is_completed: true, comment });
  await updateBayesScore(selectedNovel.id);
  await sb.from('reading_lock').delete().eq('user_id', currentUser.id);
  await showDone();
}

async function updateBayesScore(novelId) {
  const { data: reviews } = await sb.from('reviews').select('rating').eq('novel_id', novelId);
  if (!reviews || reviews.length === 0) return;
  const total = reviews.length;
  const good = reviews.filter(r => r.rating === 'good').length;
  const prior = 0.65, priorN = 10;
  const bayesScore = (good + prior * priorN) / (total + priorN);
  const isVisible = bayesScore >= 0.3;
  await sb.from('novels').update({ bayes_score: bayesScore, is_visible: isVisible }).eq('id', novelId);
}

async function showDone() {
  const links = document.getElementById('done-links');
  links.innerHTML = '';
  if (evalSel && selectedNovel) {
    if (selectedNovel.narou_url) links.innerHTML += '<a href="' + selectedNovel.narou_url + '" target="_blank" class="done-link">なろうで続きを読む →</a>';
    if (selectedNovel.kakuyomu_url) links.innerHTML += '<a href="' + selectedNovel.kakuyomu_url + '" target="_blank" class="done-link">カクヨムで続きを読む →</a>';
    if (selectedNovel.x_url) links.innerHTML += '<a href="' + selectedNovel.x_url + '" target="_blank" class="done-link">作者のXを見る →</a>';
  }
  bailEvalSel = null; reasonSel = null; evalSel = null;
  document.getElementById('bail-comment').value = '';
  document.getElementById('eval-comment').value = '';
  document.querySelectorAll('.eval-opt').forEach(b => b.classList.remove('sel-good','sel-mid','sel-bad'));
  document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('sel'));
  document.getElementById('eval-submit').disabled = true;
  document.getElementById('bail-submit').disabled = true;
  goTo('s-done');
}
