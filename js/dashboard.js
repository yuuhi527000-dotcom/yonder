let currentUser = null;
const REVIEWS_PER_PAGE = 3;
let currentNovelId = null;
let currentReviews = [];
let reviewPage = 0;

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  await loadLinks();
  await loadNovels();
})();

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

function showList() {
  document.getElementById('view-list').style.display = 'block';
  document.getElementById('view-detail').style.display = 'none';
}

function showDetail() {
  document.getElementById('view-list').style.display = 'none';
  document.getElementById('view-detail').style.display = 'block';
}

async function loadNovels() {
  const el = document.getElementById('novels-list');
  const { data: novels } = await sb.from('novels').select('*, novel_stats(*)').eq('author_id', currentUser.id).order('created_at', { ascending: false });

  if (!novels || novels.length === 0) {
    el.innerHTML = '<div class="empty">まだ投稿した作品がありません。<br><a href="post.html" style="color:var(--acc)">投稿する →</a></div>';
    return;
  }

  const { data: reviews } = await sb.from('reviews').select('novel_id, rating').in('novel_id', novels.map(n => n.id));

  el.innerHTML = novels.map(novel => {
    const novelReviews = reviews ? reviews.filter(r => r.novel_id === novel.id) : [];
    const total = novelReviews.length;
    const pct = Math.round((novel.bayes_score || 0.65) * 100);
    const badgeClass = pct >= 70 ? 'good' : 'mid';
    const stats = novel.novel_stats;
    return `
      <div class="novel-row" onclick="openDetail('${novel.id}')">
        <div class="nrl">
          <div class="nr-title">${escHtml(novel.title)}</div>
          <div class="nr-meta">
            <span>${novel.genre || '—'} · ${novel.char_count ? Math.round(novel.char_count/10000*10)/10+'万字' : '—'}</span>
            <span>${total}件評価</span>
          </div>
        </div>
        <span class="nr-badge ${badgeClass}">よかった ${pct}%</span>
        <i class="ti ti-chevron-right" style="font-size:16px;color:var(--ink3);margin-left:6px" aria-hidden="true"></i>
      </div>
    `;
  }).join('');
}

async function openDetail(novelId) {
  currentNovelId = novelId;
  showDetail();
  const el = document.getElementById('detail-content');
  el.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: novel } = await sb.from('novels').select('*').eq('id', novelId).single();
  const { data: stats } = await sb.from('novel_stats').select('*').eq('novel_id', novelId).single();
  const { data: reviews } = await sb.from('reviews').select('*').eq('novel_id', novelId).order('created_at', { ascending: false });

  currentReviews = reviews || [];
  reviewPage = 0;

  const total = currentReviews.length;
  const good = currentReviews.filter(r => r.rating === 'good').length;
  const mid = currentReviews.filter(r => r.rating === 'mid').length;
  const bad = currentReviews.filter(r => r.rating === 'bad').length;
  const completed = currentReviews.filter(r => r.is_completed).length;
  const pct = Math.round((novel.bayes_score || 0.65) * 100);
  const goodPct = total > 0 ? Math.round(good/total*100) : 0;
  const midPct = total > 0 ? Math.round(mid/total*100) : 0;
  const badPct = total > 0 ? Math.round(bad/total*100) : 0;

  el.innerHTML = `
    <div class="detail-title">${escHtml(novel.title)}</div>
    <div class="detail-copy">${escHtml(novel.catchcopy)}</div>
    <span class="score-badge">よかった ${pct}%</span>

    <div class="stats-grid">
      <div class="stat"><div class="stat-n">${stats ? stats.shown_count : 0}</div><div class="stat-l">カード表示</div></div>
      <div class="stat"><div class="stat-n">${stats ? stats.chosen_count : 0}</div><div class="stat-l">選ばれた</div></div>
      <div class="stat"><div class="stat-n">${stats ? stats.not_chosen_count : 0}</div><div class="stat-l">選ばれなかった</div></div>
      <div class="stat"><div class="stat-n">${stats && stats.shown_count > 0 ? Math.round(stats.chosen_count/stats.shown_count*100) : 0}%</div><div class="stat-l">選択率</div></div>
    </div>
    <div class="stats-grid">
      <div class="stat"><div class="stat-n">${completed}</div><div class="stat-l">読了数</div></div>
      <div class="stat"><div class="stat-n" style="color:#4a9b6f">${good}</div><div class="stat-l">よかった</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--acc2)">${mid}</div><div class="stat-l">普通</div></div>
      <div class="stat"><div class="stat-n" style="color:#b85a42">${bad}</div><div class="stat-l">期待外れ</div></div>
    </div>

    ${total > 0 ? `
    <div class="eval-bar">
      <div class="bar-g" style="width:${goodPct}%"></div>
      <div class="bar-m" style="width:${midPct}%"></div>
      <div class="bar-b" style="width:${badPct}%"></div>
    </div>
    <div class="legend">
      <div class="leg"><div class="dot" style="background:#7db89a"></div>よかった ${goodPct}%</div>
      <div class="leg"><div class="dot" style="background:#c4956a"></div>普通 ${midPct}%</div>
      <div class="leg"><div class="dot" style="background:#d49080"></div>期待外れ ${badPct}%</div>
    </div>` : ''}

    <div class="comments-head">
      <div class="comments-title">読者コメント</div>
      <div class="page-nav">
        <button class="page-btn" id="prev-btn" onclick="changeReviewPage(-1)" disabled aria-label="前のページ"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
        <span class="page-info" id="page-info">1 / ${Math.max(1, Math.ceil(total/REVIEWS_PER_PAGE))}ページ</span>
        <button class="page-btn" id="next-btn" onclick="changeReviewPage(1)" ${total <= REVIEWS_PER_PAGE ? 'disabled' : ''} aria-label="次のページ"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
      </div>
    </div>
    <div id="reviews-wrap"></div>

    <div id="chapter-graph"></div>
    <button class="delete-btn" onclick="deleteNovel('${novel.id}','${escHtml(novel.title)}')">この作品を削除する</button>
  `;

  renderReviews();
  await renderChapterGraph(novel, currentReviews);
}

async function renderChapterGraph(novel, reviews) {
  const el = document.getElementById('chapter-graph');
  if (!el) return;

  const totalReaders = reviews.filter(r => r.is_completed || !r.is_completed).length;
  // chapter_progressがある人のみカウント（新機能なので古い作品はデータなし）
  const { data: progress } = await sb.from('chapter_progress')
    .select('chapter_index')
    .eq('novel_id', novel.id);

  if (!progress || progress.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:var(--ink3);padding:8px 0 16px;">この作品の読了率データはまだありません。<br>新規読者から記録が始まります。</div>';
    return;
  }

  const milestones = [
    { label: '0%', value: 0 },
    { label: '25%', value: 25 },
    { label: '50%', value: 50 },
    { label: '75%', value: 75 },
    { label: '読了', value: 100 },
  ];

  const total = progress.length;

  const bars = milestones.map(m => {
    const count = progress.filter(p => p.chapter_index >= m.value).length;
    const pct = Math.round(count / total * 100);
    const color = pct >= 70 ? '#7db89a' : pct >= 40 ? '#c4956a' : '#d49080';
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
          <span style="font-size:11px;color:var(--ink3);width:36px;flex-shrink:0;text-align:right;">${m.label}</span>
          <div style="flex:1;background:var(--border);border-radius:4px;height:14px;overflow:hidden;">
            <div style="width:${pct}%;background:${color};height:100%;border-radius:4px;transition:width .5s;"></div>
          </div>
          <span style="font-size:12px;font-weight:500;color:${color};width:40px;text-align:right;">${pct}%</span>
        </div>
        <div style="font-size:10px;color:var(--ink3);padding-left:46px;">${count}人が到達</div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div style="margin-bottom:20px;padding-top:4px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.12em;color:var(--ink3);text-transform:uppercase;margin-bottom:14px;">読了率グラフ</div>
      ${bars}
      <div style="font-size:10px;color:var(--ink3);margin-top:4px;line-height:1.7;">※読み始めた${total}人のうち各地点まで到達した割合</div>
    </div>
  `;
}

function renderReviews() {
  const el = document.getElementById('reviews-wrap');
  const total = currentReviews.length;
  const totalPages = Math.max(1, Math.ceil(total / REVIEWS_PER_PAGE));
  const paged = currentReviews.slice(reviewPage * REVIEWS_PER_PAGE, (reviewPage + 1) * REVIEWS_PER_PAGE);
  const bailReasonMap = { tired:'時間・気力がない', mismatch:'思っていたのと違った', tempo:'テンポが合わなかった', other:'その他' };

  if (paged.length === 0) {
    el.innerHTML = '<div style="padding:16px 0;font-size:12px;color:var(--ink3);text-align:center;">まだ評価がありません</div>';
    return;
  }

  el.innerHTML = paged.map(r => `
    <div class="review-item">
      <span class="r-badge ${r.rating === 'good' ? 'r-good' : r.rating === 'mid' ? 'r-mid' : 'r-bad'}">
        ${r.rating === 'good' ? 'よかった' : r.rating === 'mid' ? '普通' : '期待外れ'}
      </span>
      <div class="r-body">
        <div class="r-comment">${r.comment ? escHtml(r.comment) : '（コメントなし）'}</div>
        <div class="r-meta">
          ${r.is_completed ? '読了' : '途中離脱'}
          ${!r.is_completed && r.bail_reason ? '<span class="bail-tag">理由：' + (bailReasonMap[r.bail_reason] || r.bail_reason) + '</span>' : ''}
        </div>
      </div>
    </div>
  `).join('');

  document.getElementById('page-info').textContent = (reviewPage + 1) + ' / ' + totalPages + 'ページ';
  document.getElementById('prev-btn').disabled = reviewPage === 0;
  document.getElementById('next-btn').disabled = reviewPage >= totalPages - 1;
}

function changeReviewPage(dir) {
  reviewPage += dir;
  renderReviews();
}

async function loadLinks() {
  const { data } = await sb.from('profiles').select('*').eq('user_id', currentUser.id).single();
  if (data) {
    if (data.narou_url) document.getElementById('link-narou').value = data.narou_url;
    if (data.kakuyomu_url) document.getElementById('link-kakuyomu').value = data.kakuyomu_url;
    if (data.x_url) document.getElementById('link-x').value = data.x_url;
  }
}

async function saveLinks() {
  const narou = document.getElementById('link-narou').value.trim() || null;
  const kakuyomu = document.getElementById('link-kakuyomu').value.trim() || null;
  const x = document.getElementById('link-x').value.trim() || null;
  const errEl = document.getElementById('link-err');
  const btn = document.querySelector('.save-btn');

  if (narou && !narou.match(/^https?:\/\/(ncode|novel18)\.syosetu\.com\//)) { errEl.textContent = 'なろうのURLが正しくありません'; return; }
  if (kakuyomu && !kakuyomu.match(/^https?:\/\/kakuyomu\.jp\//)) { errEl.textContent = 'カクヨムのURLが正しくありません'; return; }
  if (x && !x.match(/^https?:\/\/(x|twitter)\.com\//)) { errEl.textContent = 'XのURLが正しくありません'; return; }

  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '保存中...';

  await sb.from('profiles').upsert({ user_id: currentUser.id, narou_url: narou, kakuyomu_url: kakuyomu, x_url: x, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = '保存しました ✓';
  setTimeout(() => { btn.textContent = 'リンクを保存する'; }, 2000);
}

async function deleteNovel(id, title) {
  if (!confirm('「' + title + '」を削除しますか？\n\n評価データもすべて削除されます。この操作は取り消せません。')) return;
  try {
    await sb.from('reading_lock').delete().eq('novel_id', id);
    await sb.from('reports').delete().eq('novel_id', id);
    await sb.from('reviews').delete().eq('novel_id', id);
    await sb.from('novel_stats').delete().eq('novel_id', id);
    const { error } = await sb.from('novels').delete().eq('id', id).eq('author_id', currentUser.id);
    if (error) throw error;
    showList();
    await loadNovels();
  } catch(e) {
    alert('削除に失敗しました：' + e.message);
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
