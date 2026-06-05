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
    return `
      <div class="novel-row" style="cursor:default;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
          <div class="nr-title" style="margin-right:8px;">${escHtml(novel.title)}</div>
          <span class="nr-badge ${badgeClass}" style="flex-shrink:0;">${pct}%</span>
        </div>
        <div class="nr-meta" style="margin-bottom:8px;">
          <span>${novel.genre || '—'} · ${novel.char_count ? Math.round(novel.char_count/10000*10)/10+'万字' : '—'}</span>
          <span>${total}件評価</span>
        </div>
        <div style="display:flex;gap:6px;">
          <button onclick="openDetail('${novel.id}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:7px;background:var(--bg);border:0.5px solid var(--border);border-radius:8px;font-size:11px;color:var(--ink3);cursor:pointer;font-family:'Zen Kaku Gothic New',sans-serif;transition:all .15s;" onmouseover="this.style.borderColor='var(--acc2)';this.style.color='var(--acc)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--ink3)'"><i class="ti ti-chart-bar" style="font-size:14px" aria-hidden="true"></i>統計を見る</button>
          <button onclick="shareNovel('${novel.id}','${escHtml(novel.title).replace(/'/g,'\&#39;')}','${escHtml(novel.catchcopy).replace(/'/g,'\&#39;')}')" style="display:flex;align-items:center;justify-content:center;gap:4px;padding:7px 12px;background:#000;border:none;border-radius:8px;font-size:11px;color:#fff;cursor:pointer;font-family:'Zen Kaku Gothic New',sans-serif;flex-shrink:0;transition:opacity .15s;" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'"><i class="ti ti-brand-x" style="font-size:14px" aria-hidden="true"></i>シェア</button>
        </div>
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
      <div class="stat"><div class="stat-n">${total > 0 ? Math.round(completed/total*100) : 0}%</div><div class="stat-l">読了率</div></div>
      <div class="stat"><div class="stat-n" style="color:#4a9b6f">${good}</div><div class="stat-l">よかった</div></div>
      <div class="stat"><div class="stat-n" style="color:var(--acc2)">${mid}</div><div class="stat-l">普通</div></div>
    </div>
    <div class="stats-grid">
      <div class="stat"><div class="stat-n" style="color:#b85a42">${bad}</div><div class="stat-l">期待外れ</div></div>
      <div class="stat"><div class="stat-n">${total}</div><div class="stat-l">総評価数</div></div>
      <div class="stat"></div>
      <div class="stat"></div>
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
  await renderInquirySection();
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
        <div class="r-meta" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <span>
            ${r.is_completed ? '読了' : '途中離脱'}
            ${!r.is_completed && r.bail_reason ? '<span class="bail-tag">理由：' + (bailReasonMap[r.bail_reason] || r.bail_reason) + '</span>' : ''}
          </span>
          ${r.comment ? `<button onclick="openCommentReportModal('${r.id}','${escHtml(r.comment).replace(/'/g,'&#39;').replace(/\n/g,' ').substring(0,30)}')" style="background:none;border:0.5px solid #f0c4b4;border-radius:20px;padding:2px 8px;font-size:10px;color:#b85a42;cursor:pointer;flex-shrink:0;font-family:'Zen Kaku Gothic New',sans-serif;transition:all .15s;" onmouseover="this.style.background='#fdf0ec'" onmouseout="this.style.background='none'"><i class="ti ti-flag" style="font-size:10px"></i> 通報</button>` : ''}
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
    if (data.notification_email) document.getElementById('notify-email').value = data.notification_email;
    // ニックネーム
    const nicknameInp = document.getElementById('nickname-inp');
    if (nicknameInp && data.pen_name) {
      nicknameInp.value = data.pen_name;
      const countEl = document.getElementById('nickname-char-count');
      if (countEl) countEl.textContent = data.pen_name.length + ' / 20';
    }
  }
  // ニックネーム入力イベント
  const inp = document.getElementById('nickname-inp');
  if (inp) inp.addEventListener('input', () => {
    const countEl = document.getElementById('nickname-char-count');
    if (countEl) countEl.textContent = inp.value.length + ' / 20';
  });
}

async function saveNickname() {
  const inp = document.getElementById('nickname-inp');
  const errEl = document.getElementById('nickname-err');
  const btn = document.getElementById('nickname-save-btn');
  const val = inp.value.trim();
  if (!val) { errEl.textContent = 'ニックネームを入力してください'; return; }
  if (val.length > 20) { errEl.textContent = '20文字以内で入力してください'; return; }
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '保存中...';
  await sb.from('profiles').upsert({
    user_id: currentUser.id,
    pen_name: val,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
  btn.disabled = false; btn.textContent = '保存しました ✓';
  setTimeout(() => { btn.textContent = 'ニックネームを保存する'; }, 2000);
}

function shareNovel(id, title, catchcopy) {
  const text = 'Yonderに投稿しました📖\n\n' + catchcopy + '\n\n#Yonder #なろう #小説家さんと繋がりたい\nyonder.kotobakagami.com';
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

async function saveLinks() {
  const narou = document.getElementById('link-narou').value.trim() || null;
  const kakuyomu = document.getElementById('link-kakuyomu').value.trim() || null;
  const x = document.getElementById('link-x').value.trim() || null;
  const errEl = document.getElementById('link-err');
  const btn = document.querySelector('.save-btn');

  if (narou && !narou.match(/^https?:\/\/(ncode|novel18|mypage|www)?\.?syosetu\.com\//)) { errEl.textContent = 'なろうのURLが正しくありません'; return; }
  if (kakuyomu && !kakuyomu.match(/^https?:\/\/kakuyomu\.jp\//)) { errEl.textContent = 'カクヨムのURLが正しくありません'; return; }
  if (x && !x.match(/^https?:\/\/(x|twitter)\.com\//)) { errEl.textContent = 'XのURLが正しくありません'; return; }

  errEl.textContent = '';
  btn.disabled = true; btn.textContent = '保存中...';

  await sb.from('profiles').upsert({ user_id: currentUser.id, narou_url: narou, kakuyomu_url: kakuyomu, x_url: x, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = '保存しました ✓';
  setTimeout(() => { btn.textContent = 'リンクを保存する'; }, 2000);
}

async function saveNotifyEmail() {
  const email = document.getElementById('notify-email').value.trim() || null;
  const noteEl = document.getElementById('notify-note');
  await sb.from('profiles').upsert({ user_id: currentUser.id, notification_email: email, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  noteEl.textContent = '保存しました ✓';
  noteEl.style.color = '#4a9b6f';
  setTimeout(() => { noteEl.textContent = ''; }, 2000);
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

// 問い合わせ機能
let currentInquiry = null;

async function renderInquirySection() {
  const el = document.getElementById('inquiry-section');
  if (!el) return;

  const { data: inquiries } = await sb.from('inquiries')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  currentInquiry = inquiries && inquiries.length > 0 ? inquiries[0] : null;

  let html = '<div class="section-divider"></div><div class="section-label">管理者への問い合わせ</div>';

  if (currentInquiry) {
    const { data: messages } = await sb.from('inquiry_messages')
      .select('*')
      .eq('inquiry_id', currentInquiry.id)
      .order('created_at', { ascending: true });

    const msgsHTML = (messages || []).map(m => {
      const isAdmin = m.sender_type === 'admin';
      const date = new Date(m.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
      return `
        <div style="display:flex;flex-direction:column;margin-bottom:2px;">
          ${isAdmin ? `
            <div style="background:var(--acc3);color:var(--ink);padding:8px 11px;border-radius:10px;font-size:12px;line-height:1.7;max-width:82%;">${escHtml(m.body)}</div>
            <div style="font-size:10px;color:var(--ink3);margin-bottom:6px;padding-left:4px;">管理者 · ${date}</div>
          ` : `
            <div style="background:var(--acc);color:#fff;padding:8px 11px;border-radius:10px;font-size:12px;line-height:1.7;max-width:82%;align-self:flex-end;">${escHtml(m.body)}</div>
            <div style="font-size:10px;color:var(--ink3);margin-bottom:6px;text-align:right;padding-right:4px;">あなた · ${date}</div>
          `}
        </div>
      `;
    }).join('');

    html += `
      <div style="background:#fff;border:0.5px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:0.5px solid var(--border);">
          <div style="font-family:'Noto Serif JP',serif;font-size:13px;font-weight:500;color:var(--ink);flex:1;">${escHtml(currentInquiry.title)}</div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px;background:#fdf2ef;color:#b85a42;">対応中</span>
            <button onclick="resolveInquiry('${currentInquiry.id}')" style="font-size:10px;padding:3px 9px;background:none;border:0.5px solid #a8d5b5;border-radius:20px;color:#4a9b6f;cursor:pointer;font-family:'Zen Kaku Gothic New',sans-serif;">✓ 解決済み</button>
          </div>
        </div>
        <div style="padding:11px 13px;display:flex;flex-direction:column;">${msgsHTML}</div>
        <div style="display:flex;gap:6px;align-items:flex-end;border-top:0.5px solid var(--border);padding:10px 13px;">
          <textarea id="inquiry-reply" placeholder="メッセージを入力..." style="flex:1;padding:6px 9px;border:0.5px solid var(--border);border-radius:8px;font-size:12px;resize:none;height:36px;background:var(--bg);font-family:'Zen Kaku Gothic New',sans-serif;"></textarea>
          <button onclick="sendInquiryMessage()" style="padding:7px 12px;background:var(--acc);color:#fff;border:none;border-radius:8px;font-size:11px;cursor:pointer;">送信</button>
        </div>
      </div>
    `;
  }

  html += `
    <div style="background:#fff;border:0.5px solid var(--border);border-radius:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:0.5px solid var(--border);">
        <div style="font-family:'Noto Serif JP',serif;font-size:13px;font-weight:500;color:var(--ink);">新しい問い合わせを送る</div>
        <span style="font-size:10px;background:var(--bg);color:var(--ink3);padding:2px 7px;border-radius:20px;">任意</span>
      </div>
      <div style="padding:11px 13px;">
        <input type="text" id="new-inquiry-title" placeholder="件名（例：コメント通報について）" style="width:100%;padding:8px 11px;border:0.5px solid var(--border);border-radius:9px;font-size:12px;color:var(--ink);background:var(--bg);font-family:'Zen Kaku Gothic New',sans-serif;margin-bottom:8px;">
        <textarea id="new-inquiry-body" placeholder="管理者への問い合わせ内容を入力してください" style="width:100%;padding:8px 11px;border:0.5px solid var(--border);border-radius:9px;font-size:12px;resize:vertical;min-height:72px;background:var(--bg);font-family:'Zen Kaku Gothic New',sans-serif;line-height:1.7;margin-bottom:10px;display:block;"></textarea>
        <button onclick="sendNewInquiry()" style="width:100%;padding:11px;background:var(--acc);color:#fff;border:none;border-radius:var(--r);font-family:'Noto Serif JP',serif;font-size:13px;font-weight:500;cursor:pointer;">問い合わせを送る</button>
      </div>
    </div>
  `;

  el.innerHTML = html;
}

async function sendInquiryMessage() {
  if (!currentInquiry) return;
  const body = document.getElementById('inquiry-reply').value.trim();
  if (!body) return;
  await sb.from('inquiry_messages').insert({ inquiry_id: currentInquiry.id, sender_type: 'user', body });
  await renderInquirySection();
}

async function sendNewInquiry() {
  const title = document.getElementById('new-inquiry-title').value.trim();
  const body = document.getElementById('new-inquiry-body').value.trim();
  if (!title) { alert('件名を入力してください'); return; }
  if (!body) { alert('内容を入力してください'); return; }
  const { data: inq } = await sb.from('inquiries').insert({ user_id: currentUser.id, title, status: 'open' }).select().single();
  if (inq) await sb.from('inquiry_messages').insert({ inquiry_id: inq.id, sender_type: 'user', body });
  await renderInquirySection();
}

async function resolveInquiry(inquiryId) {
  if (!confirm('解決済みにしますか？\n\nトーク内容が削除されます。この操作は取り消せません。')) return;
  await sb.from('inquiries').update({ status: 'resolved' }).eq('id', inquiryId);
  currentInquiry = null;
  await renderInquirySection();
}

// ── コメント通報 ──────────────────────────────
let commentReportReviewId = null;

function openCommentReportModal(reviewId, previewText) {
  commentReportReviewId = reviewId;
  let modal = document.getElementById('comment-report-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'comment-report-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);z-index:1000;display:flex;align-items:flex-end;justify-content:center;padding:0;';
    modal.onclick = (e) => { if (e.target === modal) closeCommentReportModal(); };
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:540px;padding:20px 20px 32px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="font-family:'Noto Serif JP',serif;font-size:15px;font-weight:500;color:var(--ink);">コメントを通報する</div>
        <button onclick="closeCommentReportModal()" style="background:none;border:none;font-size:20px;color:var(--ink3);cursor:pointer;line-height:1;">×</button>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:10px 12px;font-size:12px;color:var(--ink3);margin-bottom:14px;line-height:1.7;border:0.5px solid var(--border);">「${escHtml(previewText)}${previewText.length >= 30 ? '…' : ''}」</div>
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--ink3);text-transform:uppercase;margin-bottom:10px;">通報理由</div>
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px;" id="comment-report-reasons">
        ${[
          ['harassment','誹謗中傷・嫌がらせ','作者または他ユーザーへの攻撃的な内容'],
          ['spam','スパム・宣伝','無関係な宣伝・同じ内容の繰り返し'],
          ['spoiler','ネタバレ','作品の重要な内容を含む'],
          ['inappropriate','不適切な表現','差別・暴力・性的な表現'],
          ['other','その他','上記以外の理由'],
        ].map(([key, label, sub]) => `
          <button onclick="selCommentReportReason(this,'${key}')" style="display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border:0.5px solid var(--border);border-radius:10px;background:#fff;cursor:pointer;text-align:left;font-family:'Zen Kaku Gothic New',sans-serif;transition:all .15s;" onmouseover="this.style.borderColor='var(--acc2)'" onmouseout="if(!this.classList.contains('cr-sel'))this.style.borderColor='var(--border)'">
            <div style="flex:1;">
              <div style="font-size:13px;color:var(--ink);font-weight:500;">${label}</div>
              ${sub ? `<div style="font-size:11px;color:var(--ink3);margin-top:2px;">${sub}</div>` : ''}
            </div>
          </button>
        `).join('')}
      </div>
      <button id="comment-report-submit" onclick="submitCommentReport()" disabled style="width:100%;padding:12px;background:#b85a42;color:#fff;border:none;border-radius:var(--r);font-family:'Noto Serif JP',serif;font-size:14px;font-weight:500;cursor:pointer;opacity:.4;transition:opacity .15s;">通報する</button>
    </div>
  `;
  modal.style.display = 'flex';
}

function selCommentReportReason(el, key) {
  document.querySelectorAll('#comment-report-reasons button').forEach(b => {
    b.classList.remove('cr-sel');
    b.style.borderColor = 'var(--border)';
    b.style.background = '#fff';
    b.style.color = '';
  });
  el.classList.add('cr-sel');
  el.style.borderColor = '#b85a42';
  el.style.background = '#fdf0ec';
  el.dataset.reason = key;
  const btn = document.getElementById('comment-report-submit');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

async function submitCommentReport() {
  const sel = document.querySelector('#comment-report-reasons .cr-sel');
  if (!sel || !commentReportReviewId) return;
  const reason = sel.dataset.reason;
  const btn = document.getElementById('comment-report-submit');
  btn.disabled = true; btn.textContent = '送信中...';
  await sb.from('reports').insert({
    novel_id: currentNovelId,
    review_id: commentReportReviewId,
    user_id: currentUser.id,
    reason,
    report_type: 'comment',
    status: 'pending'
  });
  closeCommentReportModal();
  // 送信完了トースト
  showToast('通報を受け付けました');
}

function closeCommentReportModal() {
  const modal = document.getElementById('comment-report-modal');
  if (modal) modal.remove();
  commentReportReviewId = null;
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(44,31,20,.85);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:2000;pointer-events:none;transition:opacity .3s;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2200);
}
