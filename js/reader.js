let currentUser = null;
let novelA = null;
let novelB = null;
let selectedNovel = null;
let bailEvalSel = null;
let reasonSel = null;
let evalSel = null;
let heartSel = false;
let bailHeartSel = false;
let isFromFav = false;
let reportReasonSel = null;
let userFavorites = [];
let todaySeenIds = [];
let skipCountToday = 0;
const MAX_SKIP_PER_DAY = 10;

function getTodayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function loadDailyState() {
  const key = 'yonder_daily_' + currentUser.id;
  const today = getTodayKey();
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (saved.date === today) {
      todaySeenIds = saved.seenIds || [];
      skipCountToday = saved.skipCount || 0;
    } else {
      todaySeenIds = [];
      skipCountToday = 0;
      saveDailyState();
    }
  } catch(e) {
    todaySeenIds = [];
    skipCountToday = 0;
  }
}

function saveDailyState() {
  const key = 'yonder_daily_' + currentUser.id;
  const today = getTodayKey();
  localStorage.setItem(key, JSON.stringify({
    date: today,
    seenIds: todaySeenIds,
    skipCount: skipCountToday
  }));
}

function updateSkipCount() {
  const el = document.getElementById('skip-ct');
  if (!el) return;
  const remaining = MAX_SKIP_PER_DAY - skipCountToday;
  if (remaining <= 0) {
    el.textContent = '本日のスキップ上限に達しました';
    const btn = document.getElementById('skip-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '.3'; btn.style.cursor = 'not-allowed'; }
  } else {
    el.textContent = 'スキップ残り ' + remaining + '回（0:00リセット）';
    const btn = document.getElementById('skip-btn');
    if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
  }
}

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  loadDailyState();
  await loadFavorites();
  updateSkipCount();

  const { data: lock } = await sb.from('reading_lock').select('*').eq('user_id', currentUser.id).single();
  if (lock) {
    const { data: novel } = await sb.from('novels').select('*').eq('id', lock.novel_id).single();
    if (novel) {
      selectedNovel = novel;
      isFromFav = lock.is_from_fav || false;
      renderReadScreen(novel);
      goTo('s-read');
      return;
    }
  }

  document.getElementById('skip-ct').textContent = '※αバージョンのみ無制限';
  renderFavorites();
})();

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// お気に入り読み込み
async function loadFavorites() {
  const { data } = await sb.from('favorites').select('*, novels(*)').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  userFavorites = data || [];
}

function renderFavorites() {
  const grid = document.getElementById('fav-grid');
  const countEl = document.getElementById('fav-count');
  if (!grid) return;
  countEl.textContent = userFavorites.length + ' / 4';
  grid.innerHTML = '';
  userFavorites.forEach(fav => {
    const novel = fav.novels;
    if (!novel) return;
    const div = document.createElement('div');
    div.className = 'fav-card';
    div.innerHTML = `
      <div class="fav-menu" onclick="showFavMenu('${fav.id}','${fav.novel_id}',event)"><i class="ti ti-dots" aria-hidden="true"></i></div>
      <div class="c-genre" style="font-size:9px">${escHtml(novel.genre||'')}</div>
      <div class="c-title" style="font-size:11px">${escHtml(novel.title)}</div>
      <div class="c-copy" style="font-size:10px;margin-bottom:0">${escHtml(novel.catchcopy)}</div>
    `;
    div.onclick = (e) => { if (!e.target.closest('.fav-menu')) startFavRead(novel); };
    grid.appendChild(div);
  });
  for (let i = userFavorites.length; i < 4; i++) {
    const div = document.createElement('div');
    div.className = 'fav-empty';
    div.textContent = '+ 空き';
    grid.appendChild(div);
  }
}

function showFavMenu(favId, novelId, e) {
  e.stopPropagation();
  if (confirm('お気に入りから解除しますか？')) removeFavorite(favId);
}

async function removeFavorite(favId) {
  await sb.from('favorites').delete().eq('id', favId);
  await loadFavorites();
  renderFavorites();
}

async function addFavorite(novelId) {
  if (userFavorites.length >= 4) { alert('お気に入りは最大4作品です'); return false; }
  const exists = userFavorites.find(f => f.novel_id === novelId);
  if (exists) return false;
  await sb.from('favorites').insert({ user_id: currentUser.id, novel_id: novelId });
  await loadFavorites();
  renderFavorites();
  return true;
}

// お気に入りから読む
async function startFavRead(novel) {
  selectedNovel = novel;
  isFromFav = true;
  await sb.from('reading_lock').upsert({ user_id: currentUser.id, novel_id: novel.id, is_from_fav: true });
  renderReadScreen(novel);
  goTo('s-read');
}

async function startSearch() {
  if (skipCountToday >= MAX_SKIP_PER_DAY) {
    alert('本日のスキップ回数（' + MAX_SKIP_PER_DAY + '回）に達しました。\n明日0:00にリセットされます。\nお気に入りの作品は引き続き読めます。');
    return;
  }
  goTo('s-pick');
  await loadCards();
}

async function loadCards() {
  const cardsRow = document.getElementById('cards-row');
  cardsRow.innerHTML = '<div class="loading">読み込み中...</div>';
  document.getElementById('skip-row').style.display = 'flex';
  document.getElementById('back-btn').style.display = 'none';
  selectedNovel = null; novelA = null; novelB = null; isFromFav = false;

  const selGenres = [...document.querySelectorAll('#s-setup .tag.sel')].map(t => t.textContent).filter(t => !['〜1万字','1〜5万字','5〜15万字','15万字〜'].includes(t));
  const selSizes = [...document.querySelectorAll('#s-setup .tag.sel')].map(t => t.textContent).filter(t => ['〜1万字','1〜5万字','5〜15万字','15万字〜'].includes(t));
  const evalMin = parseInt(document.getElementById('eval-min').value) || 0;
  const evalMax = parseInt(document.getElementById('eval-max').value) || 100;

  let charMin = 0, charMax = 9999999;
  if (selSizes.length > 0) {
    charMin = 9999999; charMax = 0;
    selSizes.forEach(s => {
      if (s==='〜1万字')   { charMin=Math.min(charMin,0);      charMax=Math.max(charMax,10000); }
      if (s==='1〜5万字')  { charMin=Math.min(charMin,10001);  charMax=Math.max(charMax,50000); }
      if (s==='5〜15万字') { charMin=Math.min(charMin,50001);  charMax=Math.max(charMax,150000); }
      if (s==='15万字〜')  { charMin=Math.min(charMin,150001); charMax=Math.max(charMax,9999999); }
    });
  }

  let query = sb.from('novels').select('*').eq('is_visible', true);
  if (selGenres.length > 0) query = query.in('genre', selGenres);
  if (charMin > 0) query = query.gte('char_count', charMin);
  if (charMax < 9999999) query = query.lte('char_count', charMax);
  const minScore = Math.max(0, (evalMin-5)) / 100;
  const maxScore = Math.min(100, (evalMax+5)) / 100;
  query = query.gte('bayes_score', minScore).lte('bayes_score', maxScore);

  const { data: readNovels } = await sb.from('reviews').select('novel_id').eq('user_id', currentUser.id);
  const readIds = readNovels ? readNovels.map(r => r.novel_id) : [];
  // 今日見た作品も除外
  const excludeIds = [...new Set([...readIds, ...todaySeenIds])];
  if (excludeIds.length > 0) query = query.not('id', 'in', '(' + excludeIds.join(',') + ')');

  const { data: novels } = await query.limit(20);

  if (!novels || novels.length < 2) {
    cardsRow.innerHTML = '<div class="no-novels">条件に合う作品が見つかりませんでした。<br>条件を変えて試してみてください。</div>';
    document.getElementById('skip-row').style.display = 'none';
    document.getElementById('back-btn').style.display = 'block';
    return;
  }

  document.getElementById('back-btn').style.display = 'none';
  const shuffled = novels.sort(() => Math.random() - 0.5);
  novelA = shuffled[0]; novelB = shuffled[1];
  // 今日見た作品として記録
  if (!todaySeenIds.includes(novelA.id)) todaySeenIds.push(novelA.id);
  if (!todaySeenIds.includes(novelB.id)) todaySeenIds.push(novelB.id);
  saveDailyState();
  await recordShown(novelA.id);
  await recordShown(novelB.id);

  cardsRow.innerHTML = '';
  cardsRow.appendChild(makeCard(novelA, 'A'));
  cardsRow.appendChild(makeCard(novelB, 'B'));
}

function makeCard(novel, which) {
  const charStr = novel.char_count ? Math.round(novel.char_count/10000*10)/10+'万字' : '';
  const pct = Math.round(novel.bayes_score*100);
  const div = document.createElement('div');
  div.className = 'novel-card';
  div.id = 'card-'+which;
  div.innerHTML =
    '<div class="c-genre">'+(novel.genre||'')+(charStr?' · '+charStr:'')+'</div>'+
    '<div class="c-title">'+escHtml(novel.title)+'</div>'+
    '<div class="c-copy">'+escHtml(novel.catchcopy)+'</div>'+
    '<div class="c-meta"><span>♥ '+pct+'%</span><span>完結</span></div>';
  div.onclick = () => goReadDirect(which, novel);
  return div;
}

function convertNarouMarkup(str) {
  // XSS対策で先にエスケープ
  let s = String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');

  // ルビ記法: |単語《ルビ》 または 単語《ルビ》
  s = s.replace(/\|([^《]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');
  s = s.replace(/([一-龯々〆〤ヶ]+)《([^》]+)》/g, '<ruby>$1<rt>$2</rt></ruby>');

  // 傍点記法: 《《文字》》
  s = s.replace(/《《([^》]+)》》/g, '<em class="boten">$1</em>');

  return s;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function goReadDirect(which, novel) {
  selectedNovel = novel; isFromFav = false;
  await recordChosen(novel.id);
  const notChosenNovel = which==='A' ? novelB : novelA;
  if (notChosenNovel) await recordNotChosen(notChosenNovel.id);
  await sb.from('reading_lock').upsert({ user_id: currentUser.id, novel_id: novel.id, is_from_fav: false });
  renderReadScreen(novel);
  goTo('s-read');
}

async function recordShown(novelId) {
  const { data } = await sb.from('novel_stats').select('shown_count').eq('novel_id', novelId).single();
  if (data) {
    await sb.from('novel_stats').update({ shown_count: (data.shown_count||0)+1, updated_at: new Date().toISOString() }).eq('novel_id', novelId);
  } else {
    await sb.from('novel_stats').insert({ novel_id: novelId, shown_count: 1, chosen_count: 0, not_chosen_count: 0 });
  }
}

async function recordChosen(novelId) {
  const { data } = await sb.from('novel_stats').select('chosen_count').eq('novel_id', novelId).single();
  if (data) {
    await sb.from('novel_stats').update({ chosen_count: (data.chosen_count||0)+1, updated_at: new Date().toISOString() }).eq('novel_id', novelId);
  } else {
    await sb.from('novel_stats').insert({ novel_id: novelId, shown_count: 1, chosen_count: 1, not_chosen_count: 0 });
  }
}

async function recordNotChosen(novelId) {
  const { data } = await sb.from('novel_stats').select('not_chosen_count').eq('novel_id', novelId).single();
  if (data) {
    await sb.from('novel_stats').update({ not_chosen_count: (data.not_chosen_count||0)+1, updated_at: new Date().toISOString() }).eq('novel_id', novelId);
  } else {
    await sb.from('novel_stats').insert({ novel_id: novelId, shown_count: 1, chosen_count: 0, not_chosen_count: 1 });
  }
}

// しおり
let bookmarkLine = null;

function renderReadScreen(novel) {
  document.getElementById('read-title').textContent = novel.title;

  // お気に入りバナー
  const banner = document.getElementById('fav-read-banner');
  if (banner) banner.style.display = isFromFav ? 'flex' : 'none';

  // フッター切り替え
  const normalFooter = document.getElementById('read-footer-normal');
  const favFooter = document.getElementById('read-footer-fav');
  if (normalFooter) normalFooter.style.display = isFromFav ? 'none' : 'block';
  if (favFooter) favFooter.style.display = isFromFav ? 'block' : 'none';

  const body = document.getElementById('read-body');
  body.innerHTML = '';
  const parts = novel.body.split('---CHAPTER---');
  let lineIndex = 0;
  parts.forEach((part, i) => {
    if (i > 0) {
      const sep = document.createElement('div');
      sep.className = 'chapter-sep';
      sep.textContent = '― 章 ―';
      body.appendChild(sep);
    }
    part.split('\n').forEach(line => {
      const p = document.createElement('p');
      p.innerHTML = convertNarouMarkup(line);
      p.dataset.line = lineIndex;
      body.appendChild(p);
      lineIndex++;
    });
  });

  document.getElementById('prog-bar').style.width = '0%';
  bookmarkLine = null;
  lastRecordedMilestone = -1;

  // しおりジャンプバナー確認
  const savedBm = localStorage.getItem('bookmark_' + novel.id);
  if (savedBm) {
    bookmarkLine = parseInt(savedBm);
    showBookmarkJump();
    updateBookmarkBtn(true);
  } else {
    hideBookmarkJump();
    updateBookmarkBtn(false);
  }
}

let lastRecordedMilestone = -1;
const MILESTONES = [0, 25, 50, 75]; // 読了は評価時に記録

function updProg() {
  const el = document.getElementById('read-body');
  const scrollPct = el.scrollTop / (el.scrollHeight - el.clientHeight) * 100 || 0;
  document.getElementById('prog-bar').style.width = Math.min(100, Math.round(scrollPct)) + '%';

  // 文字数ベースのマイルストーン到達を記録
  if (!selectedNovel || isFromFav) return;
  let reached = -1;
  MILESTONES.forEach((m, i) => {
    if (scrollPct >= m) reached = i;
  });
  if (reached > lastRecordedMilestone) {
    lastRecordedMilestone = reached;
    recordMilestoneProgress(MILESTONES[reached]);
  }
}

async function recordMilestoneProgress(milestone) {
  if (!currentUser || !selectedNovel) return;
  await sb.from('chapter_progress').upsert({
    novel_id: selectedNovel.id,
    user_id: currentUser.id,
    chapter_index: milestone
  }, { onConflict: 'novel_id,user_id' });
}

// しおり
function toggleBookmark() {
  if (!selectedNovel) return;
  if (bookmarkLine !== null) {
    localStorage.removeItem('bookmark_' + selectedNovel.id);
    bookmarkLine = null;
  lastRecordedMilestone = -1;
    hideBookmarkJump();
    updateBookmarkBtn(false);
  } else {
    const body = document.getElementById('read-body');
    const scrollTop = body.scrollTop;
    const ps = body.querySelectorAll('p[data-line]');
    let nearestLine = 0;
    ps.forEach(p => {
      if (p.offsetTop <= scrollTop + 60) nearestLine = parseInt(p.dataset.line);
    });
    bookmarkLine = nearestLine;
    localStorage.setItem('bookmark_' + selectedNovel.id, bookmarkLine);
    showBookmarkJump();
    updateBookmarkBtn(true);
  }
}

function updateBookmarkBtn(active) {
  const btn = document.getElementById('bookmark-btn');
  if (!btn) return;
  if (active) {
    btn.style.borderColor = 'var(--acc2)';
    btn.style.color = 'var(--acc)';
    btn.style.background = 'var(--acc3)';
    btn.innerHTML = '<i class="ti ti-bookmark" style="font-size:11px" aria-hidden="true"></i>しおり中';
  } else {
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--ink3)';
    btn.style.background = 'none';
    btn.innerHTML = '<i class="ti ti-bookmark" style="font-size:11px" aria-hidden="true"></i>しおり';
  }
}

function showBookmarkJump() {
  const el = document.getElementById('bookmark-jump');
  if (el) el.style.display = 'flex';
}

function hideBookmarkJump() {
  const el = document.getElementById('bookmark-jump');
  if (el) el.style.display = 'none';
}

function jumpToBookmark() {
  if (bookmarkLine === null) return;
  const body = document.getElementById('read-body');
  const target = body.querySelector('p[data-line="' + bookmarkLine + '"]');
  if (target) body.scrollTop = target.offsetTop - 20;
}

// スキップ
async function doSkip() {
  if (skipCountToday >= MAX_SKIP_PER_DAY) {
    alert('本日のスキップ回数（' + MAX_SKIP_PER_DAY + '回）に達しました。\n明日0:00にリセットされます。');
    return;
  }
  skipCountToday++;
  saveDailyState();
  updateSkipCount();
  await loadCards();
}

function backToSetup() {
  document.getElementById('back-btn').style.display = 'none';
  document.getElementById('skip-row').style.display = 'flex';
  goTo('s-setup');
}

// 途中離脱
function selBailEval(el, key) {
  document.querySelectorAll('#bail-eval-grp .eval-opt').forEach(b => b.classList.remove('sel-good','sel-mid','sel-bad'));
  el.classList.add('sel-'+key);
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

function toggleBailHeart() {
  bailHeartSel = !bailHeartSel;
  const icon = document.getElementById('bail-heart-icon');
  if (icon) {
    icon.style.color = bailHeartSel ? '#e05a7a' : 'var(--acc)';
  }
}

async function submitBail() {
  const comment = document.getElementById('bail-comment').value.trim() || null;
  const btn = document.getElementById('bail-submit');
  btn.disabled = true; btn.textContent = '送信中...';
  await sb.from('reviews').insert({ novel_id: selectedNovel.id, user_id: currentUser.id, rating: bailEvalSel, is_completed: false, bail_reason: reasonSel, comment });
  await updateBayesScore(selectedNovel.id);
  if (bailHeartSel) await addFavorite(selectedNovel.id);
  await sb.from('reading_lock').delete().eq('user_id', currentUser.id);
  if (selectedNovel) localStorage.removeItem('bookmark_' + selectedNovel.id);
  evalSel = null;
  document.getElementById('done-title').textContent = 'フィードバックありがとうございます';
  document.getElementById('done-sub').textContent = 'あなたの評価が作者に届きます';
  await showDone();
}

// 評価
function selEval(el, key) {
  document.querySelectorAll('#eval-grp .eval-opt').forEach(b => b.classList.remove('sel-good','sel-mid','sel-bad'));
  el.classList.add('sel-'+key);
  evalSel = key;
  document.getElementById('eval-submit').disabled = false;
}

function toggleHeart() {
  heartSel = !heartSel;
  const icon = document.getElementById('heart-icon');
  if (icon) {
    icon.style.color = heartSel ? '#e05a7a' : 'var(--acc)';
  }
}

async function submitEval() {
  const comment = document.getElementById('eval-comment').value.trim() || null;
  const btn = document.getElementById('eval-submit');
  btn.disabled = true; btn.textContent = '送信中...';
  await sb.from('reviews').insert({ novel_id: selectedNovel.id, user_id: currentUser.id, rating: evalSel, is_completed: true, comment });
  await sb.from('chapter_progress').upsert({ novel_id: selectedNovel.id, user_id: currentUser.id, chapter_index: 100 }, { onConflict: 'novel_id,user_id' });
  await updateBayesScore(selectedNovel.id);
  if (heartSel) await addFavorite(selectedNovel.id);
  await sb.from('reading_lock').delete().eq('user_id', currentUser.id);
  if (selectedNovel) localStorage.removeItem('bookmark_' + selectedNovel.id);
  document.getElementById('done-title').textContent = 'ありがとうございます';
  document.getElementById('done-sub').textContent = 'あなたの評価が次の作家さんに届きます';
  await showDone();
}

// お気に入りから読み終わった
async function finishFavRead() {
  await sb.from('reading_lock').delete().eq('user_id', currentUser.id);
  resetUI();
  goTo('s-setup');
}

async function updateBayesScore(novelId) {
  const { data: reviews } = await sb.from('reviews').select('rating').eq('novel_id', novelId);
  if (!reviews || reviews.length === 0) return;
  const total = reviews.length;
  const good = reviews.filter(r => r.rating === 'good').length;
  const prior = 0.65, priorN = 10;
  const bayesScore = (good + prior * priorN) / (total + priorN);
  await sb.from('novels').update({ bayes_score: bayesScore, is_visible: bayesScore >= 0.3 }).eq('id', novelId);
}

async function showDone() {
  const links = document.getElementById('done-links');
  links.innerHTML = '';

  if (selectedNovel && (selectedNovel.pen_name || selectedNovel.narou_url || selectedNovel.kakuyomu_url || selectedNovel.x_url)) {
    let html = '<div style="background:var(--bg);border:0.5px solid var(--border);border-radius:10px;padding:14px;width:100%;max-width:300px;">';
    if (selectedNovel.pen_name) {
      html += '<div style="font-family:Noto Serif JP,serif;font-size:15px;font-weight:500;color:var(--ink);margin-bottom:10px;display:flex;align-items:center;gap:6px;"><i class=\"ti ti-user\" style=\"font-size:14px;color:var(--acc2)\" aria-hidden=\"true\"></i>' + escHtml(selectedNovel.pen_name) + '</div>';
    }
    html += '<div style=\"display:flex;flex-direction:column;gap:7px;\">';
    if (selectedNovel.narou_url) {
      html += '<a href=\"' + escHtml(selectedNovel.narou_url) + '\" target=\"_blank\" class=\"done-link\" style=\"display:flex;align-items:center;gap:10px;padding:10px 14px;border:0.5px solid var(--border);border-radius:9px;background:#fff;text-decoration:none;\"><i class=\"ti ti-pencil\" style=\"font-size:16px;color:var(--acc2);flex-shrink:0\" aria-hidden=\"true\"></i><div><div style=\"font-size:13px;color:var(--acc)\">なろうで他の作品を読む</div></div><i class=\"ti ti-chevron-right\" style=\"font-size:14px;color:var(--ink3);margin-left:auto\" aria-hidden=\"true\"></i></a>';
    }
    if (selectedNovel.kakuyomu_url) {
      html += '<a href=\"' + escHtml(selectedNovel.kakuyomu_url) + '\" target=\"_blank\" class=\"done-link\" style=\"display:flex;align-items:center;gap:10px;padding:10px 14px;border:0.5px solid var(--border);border-radius:9px;background:#fff;text-decoration:none;\"><i class=\"ti ti-feather\" style=\"font-size:16px;color:var(--acc2);flex-shrink:0\" aria-hidden=\"true\"></i><div><div style=\"font-size:13px;color:var(--acc)\">カクヨムで他の作品を読む</div></div><i class=\"ti ti-chevron-right\" style=\"font-size:14px;color:var(--ink3);margin-left:auto\" aria-hidden=\"true\"></i></a>';
    }
    if (selectedNovel.x_url) {
      html += '<a href=\"' + escHtml(selectedNovel.x_url) + '\" target=\"_blank\" class=\"done-link\" style=\"display:flex;align-items:center;gap:10px;padding:10px 14px;border:0.5px solid var(--border);border-radius:9px;background:#fff;text-decoration:none;\"><i class=\"ti ti-brand-x\" style=\"font-size:16px;color:var(--acc2);flex-shrink:0\" aria-hidden=\"true\"></i><div><div style=\"font-size:13px;color:var(--acc)\">作者のXを見る</div></div><i class=\"ti ti-chevron-right\" style=\"font-size:14px;color:var(--ink3);margin-left:auto\" aria-hidden=\"true\"></i></a>';
    }
    html += '</div></div>';
    links.innerHTML = html;
  }

  resetUI();
  goTo('s-done');
}


function resetUI() {
  bailEvalSel = null; reasonSel = null; evalSel = null; heartSel = false; bailHeartSel = false;
  document.getElementById('bail-comment').value = '';
  document.getElementById('eval-comment').value = '';
  document.querySelectorAll('.eval-opt').forEach(b => b.classList.remove('sel-good','sel-mid','sel-bad'));
  document.querySelectorAll('.reason-btn').forEach(b => b.classList.remove('sel'));
  document.getElementById('eval-submit').disabled = true;
  document.getElementById('bail-submit').disabled = true;
  const hi = document.getElementById('heart-icon');
  if (hi) hi.style.color = 'var(--acc)';
  const bhi = document.getElementById('bail-heart-icon');
  if (bhi) bhi.style.color = 'var(--acc)';
}

// 通報
function selReportReason(el, key) {
  document.querySelectorAll('#report-reason-grp .reason-btn').forEach(b => b.classList.remove('sel'));
  el.classList.add('sel');
  reportReasonSel = key;
  document.getElementById('report-submit').disabled = false;
}

async function submitReport() {
  if (!reportReasonSel || !selectedNovel) return;
  const comment = document.getElementById('report-comment').value.trim() || null;
  const btn = document.getElementById('report-submit');
  btn.disabled = true; btn.textContent = '送信中...';
  await sb.from('reports').insert({ novel_id: selectedNovel.id, user_id: currentUser.id, reason: reportReasonSel, comment, status: 'pending' });
  reportReasonSel = null;
  document.getElementById('report-comment').value = '';
  document.querySelectorAll('#report-reason-grp .reason-btn').forEach(b => b.classList.remove('sel'));
  btn.disabled = true; btn.textContent = '通報する';
  alert('通報を受け付けました。');
  goTo('s-read');
}
