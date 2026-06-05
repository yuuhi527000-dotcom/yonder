const ADMIN_IDS = ['d425963b-9609-4272-9fce-5a22b52bf08b'];

let currentUser = null;
let allNovels = [];
let novelSortKey = 'bayes_score';
let novelSortAsc = false;
let currentPage = 1;
const PER_PAGE = 10;
let filterGenre = '';
let filterStatus = '';

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  if (ADMIN_IDS.length > 0 && !ADMIN_IDS.includes(currentUser.id)) {
    alert('管理者のみアクセスできます');
    window.location.href = 'index.html';
    return;
  }
  await loadStats();
  await loadNovels();
})();

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active');
  if (tab === 'reports') loadReports();
  if (tab === 'notices') loadNoticesAdmin();
  if (tab === 'inquiries') loadInquiriesAdmin();
}

async function loadStats() {
  const { count: novelCount } = await sb.from('novels').select('*', { count: 'exact', head: true });
  const { count: reviewCount } = await sb.from('reviews').select('*', { count: 'exact', head: true });
  const { count: reportCount } = await sb.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { data: userCount } = await sb.rpc('get_user_count');

  document.getElementById('s-novels').textContent = novelCount || 0;
  document.getElementById('s-reviews').textContent = reviewCount || 0;
  document.getElementById('s-reports').textContent = reportCount || 0;
  document.getElementById('s-users').textContent = userCount || 0;
}

async function loadNovels() {
  const el = document.getElementById('novels-table');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const { data: novels } = await sb.from('novels').select('*').order('created_at', { ascending: false });
  allNovels = novels || [];
  currentPage = 1;
  renderFilters();
  renderNovels();
}

function renderFilters() {
  const genres = [...new Set(allNovels.map(n => n.genre).filter(Boolean))];
  const filterEl = document.getElementById('novel-filters');
  if (!filterEl) return;
  filterEl.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
      <span style="font-size:11px;color:var(--ink3);font-weight:700;letter-spacing:.1em;text-transform:uppercase;">ジャンル</span>
      <button class="filter-tag ${filterGenre===''?'active':''}" onclick="setGenreFilter('')">すべて</button>
      ${genres.map(g => `<button class="filter-tag ${filterGenre===g?'active':''}" onclick="setGenreFilter('${g}')">${g}</button>`).join('')}
      <span style="margin-left:8px;font-size:11px;color:var(--ink3);font-weight:700;letter-spacing:.1em;text-transform:uppercase;">状態</span>
      <button class="filter-tag ${filterStatus===''?'active':''}" onclick="setStatusFilter('')">すべて</button>
      <button class="filter-tag ${filterStatus==='visible'?'active':''}" onclick="setStatusFilter('visible')">公開中</button>
      <button class="filter-tag ${filterStatus==='hidden'?'active':''}" onclick="setStatusFilter('hidden')">非表示</button>
      <button class="filter-tag ${filterStatus==='reported'?'active':''}" onclick="setStatusFilter('reported')">通報あり</button>
    </div>
  `;
}

function setGenreFilter(genre) {
  filterGenre = genre;
  currentPage = 1;
  renderFilters();
  renderNovels();
}

function setStatusFilter(status) {
  filterStatus = status;
  currentPage = 1;
  renderFilters();
  renderNovels();
}

function setSort(key) {
  if (novelSortKey === key) { novelSortAsc = !novelSortAsc; }
  else { novelSortKey = key; novelSortAsc = key !== 'created_at'; }
  renderNovels();
}

async function renderNovels() {
  const el = document.getElementById('novels-table');
  if (!allNovels || allNovels.length === 0) {
    el.innerHTML = '<div class="loading">作品がありません</div>';
    return;
  }

  const { data: allReports } = await sb.from('reports').select('novel_id').eq('status', 'pending');
  const reportedIds = allReports ? allReports.map(r => r.novel_id) : [];

  // フィルタ
  let filtered = [...allNovels];
  if (filterGenre) filtered = filtered.filter(n => n.genre === filterGenre);
  if (filterStatus === 'visible') filtered = filtered.filter(n => n.is_visible);
  if (filterStatus === 'hidden') filtered = filtered.filter(n => !n.is_visible);
  if (filterStatus === 'reported') filtered = filtered.filter(n => reportedIds.includes(n.id));

  // ソート
  filtered.sort((a, b) => {
    let av, bv;
    if (novelSortKey === 'created_at') { av = new Date(a.created_at); bv = new Date(b.created_at); }
    else if (novelSortKey === 'bayes_score') { av = a.bayes_score || 0; bv = b.bayes_score || 0; }
    else if (novelSortKey === 'char_count') { av = a.char_count || 0; bv = b.char_count || 0; }
    return novelSortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  // ページング
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PER_PAGE;
  const paged = filtered.slice(start, start + PER_PAGE);
  const sortIcon = (key) => novelSortKey === key ? (novelSortAsc ? ' ↑' : ' ↓') : '';

  el.innerHTML = `
    <div style="font-size:12px;color:var(--ink3);margin-bottom:10px;">${total}件中 ${start+1}〜${Math.min(start+PER_PAGE, total)}件表示</div>
    <table>
      <thead>
        <tr>
          <th>タイトル・キャッチコピー</th>
          <th>ジャンル</th>
          <th style="cursor:pointer" onclick="setSort('char_count')">文字数${sortIcon('char_count')}</th>
          <th style="cursor:pointer" onclick="setSort('bayes_score')">スコア${sortIcon('bayes_score')}</th>
          <th>状態</th>
          <th style="cursor:pointer" onclick="setSort('created_at')">投稿日${sortIcon('created_at')}</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${paged.map(n => {
          const charStr = n.char_count ? (n.char_count >= 10000 ? Math.round(n.char_count/10000*10)/10+'万字' : n.char_count.toLocaleString()+'字') : '—';
          const bayesPct = Math.round((n.bayes_score || 0.65) * 100);
          const scoreClass = bayesPct >= 70 ? 'color:#4a9b6f' : bayesPct >= 50 ? 'color:var(--acc)' : 'color:#b85a42';
          const isReported = reportedIds.includes(n.id);
          const statusBadge = !n.is_visible
            ? '<span class="badge badge-hidden">非表示</span>'
            : isReported
            ? '<span class="badge badge-report">通報あり</span>'
            : '<span class="badge badge-good">公開中</span>';
          return `
            <tr>
              <td>
                <div class="novel-title-cell" style="cursor:pointer;color:var(--acc);" onclick="viewNovel('${n.id}')">${escHtml(n.title)}</div>
                <div style="font-size:11px;color:var(--ink3);margin-top:2px;">${escHtml(n.catchcopy)}</div>
                ${n.pen_name ? '<div style="font-size:10px;color:var(--acc2);margin-top:2px;">✍️ ' + escHtml(n.pen_name) + '</div>' : ''}
              </td>
              <td style="font-size:12px">${n.genre || '—'}</td>
              <td style="font-size:12px;white-space:nowrap">${charStr}</td>
              <td style="font-size:13px;font-weight:500;${scoreClass}">${bayesPct}%</td>
              <td>${statusBadge}</td>
              <td style="font-size:11px;color:var(--ink3);white-space:nowrap">${new Date(n.created_at).toLocaleDateString('ja-JP')}</td>
              <td style="white-space:nowrap">
                ${n.is_visible
                  ? `<button class="action-btn danger" onclick="hideNovel('${n.id}')">非表示</button>`
                  : `<button class="action-btn success" onclick="showNovel('${n.id}')">公開</button>`}
                <button class="action-btn danger" onclick="deleteNovel('${n.id}')">削除</button>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
    ${totalPages > 1 ? `
    <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;">
      <button class="action-btn" onclick="changePage(${currentPage-1})" ${currentPage<=1?'disabled':''}>← 前</button>
      <span style="font-size:12px;color:var(--ink3)">${currentPage} / ${totalPages}ページ</span>
      <button class="action-btn" onclick="changePage(${currentPage+1})" ${currentPage>=totalPages?'disabled':''}>次 →</button>
    </div>` : ''}
  `;
}

function changePage(page) {
  currentPage = page;
  renderNovels();
  document.getElementById('novels-table').scrollIntoView({ behavior: 'smooth' });
}

async function loadReports() {
  const el = document.getElementById('reports-table');
  el.innerHTML = '<div class="loading">読み込み中...</div>';
  const { data: reports } = await sb.from('reports').select('*, novels(title, catchcopy), reviews(comment, rating)').order('created_at', { ascending: false });
  if (!reports || reports.length === 0) { el.innerHTML = '<div class="loading">通報はありません</div>'; return; }
  const reasonMap = { copyright:'著作権侵害', inappropriate:'不適切な内容', other:'その他', spam:'スパム・宣伝', harassment:'誹謗中傷', spoiler:'ネタバレ' };
  const statusMap = { pending:'未対応', resolved:'対応済み', dismissed:'却下' };
  const statusClass = { pending:'badge-report', resolved:'badge-good', dismissed:'badge-hidden' };

  // タブ切り替えUI
  const novelReports = reports.filter(r => r.report_type !== 'comment');
  const commentReports = reports.filter(r => r.report_type === 'comment');
  const pendingNovel = novelReports.filter(r => r.status === 'pending').length;
  const pendingComment = commentReports.filter(r => r.status === 'pending').length;

  function renderTable(list) {
    if (list.length === 0) return '<div class="loading">通報はありません</div>';
    return `<table>
      <thead><tr><th>対象</th><th>理由</th><th>内容</th><th>状態</th><th>日付</th><th>操作</th></tr></thead>
      <tbody>
        ${list.map(r => {
          const isComment = r.report_type === 'comment';
          const targetCell = isComment
            ? `<div style="font-size:11px;color:var(--ink3);margin-bottom:2px;"><span style="background:#fdf0ec;color:#b85a42;border-radius:4px;padding:1px 5px;font-size:10px;">コメント</span></div>
               <div class="novel-title-cell">${r.novels ? escHtml(r.novels.title) : '（削除済み）'}</div>
               ${r.reviews && r.reviews.comment ? '<div style="font-size:11px;color:var(--ink3);margin-top:3px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">💬 ' + escHtml(r.reviews.comment) + '</div>' : ''}`
            : `<div class="novel-title-cell">${r.novels ? escHtml(r.novels.title) : '（削除済み）'}</div>`;
          return `<tr id="report-row-${r.id}">
            <td>${targetCell}</td>
            <td style="font-size:12px">${reasonMap[r.reason]||r.reason}</td>
            <td style="font-size:12px;color:var(--ink3);max-width:160px;">${r.comment?escHtml(r.comment):'—'}</td>
            <td><span class="badge ${statusClass[r.status]}">${statusMap[r.status]}</span></td>
            <td style="font-size:11px;color:var(--ink3);white-space:nowrap">${new Date(r.created_at).toLocaleDateString('ja-JP')}</td>
            <td>${r.status==='pending'?`
              ${isComment
                ? `<button class="action-btn danger" onclick="handleReport('${r.id}','${r.novel_id}','resolved',true)">コメント削除</button>`
                : `<button class="action-btn danger" onclick="handleReport('${r.id}','${r.novel_id}','resolved',false)">非表示</button>`}
              <button class="action-btn" onclick="handleReport('${r.id}','${r.novel_id}','dismissed',false)">却下</button>`:'—'}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  el.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:14px;">
      <button id="rtab-all" onclick="switchReportTab('all')" class="filter-tag active">すべて（${reports.filter(r=>r.status==='pending').length}件未対応）</button>
      <button id="rtab-novel" onclick="switchReportTab('novel')" class="filter-tag">作品（${pendingNovel}）</button>
      <button id="rtab-comment" onclick="switchReportTab('comment')" class="filter-tag">コメント（${pendingComment}）</button>
    </div>
    <div id="rtab-content-all">${renderTable(reports)}</div>
    <div id="rtab-content-novel" style="display:none">${renderTable(novelReports)}</div>
    <div id="rtab-content-comment" style="display:none">${renderTable(commentReports)}</div>
  `;
}

function switchReportTab(tab) {
  ['all','novel','comment'].forEach(t => {
    document.getElementById('rtab-' + t).classList.toggle('active', t === tab);
    document.getElementById('rtab-content-' + t).style.display = t === tab ? 'block' : 'none';
  });
}

async function hideNovel(id) {
  if (!confirm('この作品を非表示にしますか？')) return;
  await sb.from('novels').update({ is_visible: false }).eq('id', id);
  await loadNovels(); await loadStats();
}
async function showNovel(id) {
  await sb.from('novels').update({ is_visible: true }).eq('id', id);
  await loadNovels();
}
async function deleteNovel(id) {
  if (!confirm('この作品を完全に削除しますか？この操作は取り消せません。')) return;
  try {
    await sb.from('reading_lock').delete().eq('novel_id', id);
    await sb.from('reports').delete().eq('novel_id', id);
    await sb.from('reviews').delete().eq('novel_id', id);
    await sb.from('novel_stats').delete().eq('novel_id', id);
    await sb.from('novels').delete().eq('id', id);
    await loadNovels(); await loadStats();
  } catch(e) { alert('削除に失敗しました：' + e.message); }
}
async function handleReport(reportId, novelId, action, isComment) {
  await sb.from('reports').update({ status: action }).eq('id', reportId);
  if (action === 'resolved') {
    if (isComment) {
      // コメント通報の場合：対象レビューのコメントをnullにする
      const { data: rep } = await sb.from('reports').select('review_id').eq('id', reportId).single();
      if (rep && rep.review_id) {
        await sb.from('reviews').update({ comment: null }).eq('id', rep.review_id);
      }
    } else if (novelId) {
      await sb.from('novels').update({ is_visible: false }).eq('id', novelId);
    }
  }
  await loadReports(); await loadStats();
}

async function loadNoticesAdmin() {
  const el = document.getElementById('notices-list-admin');
  const { data: notices } = await sb.from('notices').select('*').order('created_at', { ascending: false });

  if (!notices || notices.length === 0) {
    el.innerHTML = '<div class="loading">お知らせはありません</div>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead><tr><th>タイトル</th><th>本文</th><th>投稿日</th><th>操作</th></tr></thead>
      <tbody>
        ${notices.map(n => `
          <tr>
            <td style="font-weight:500">${escHtml(n.title)}</td>
            <td style="font-size:12px;color:var(--ink3);max-width:300px;">${escHtml(n.body)}</td>
            <td style="font-size:11px;color:var(--ink3);white-space:nowrap">${new Date(n.created_at).toLocaleDateString('ja-JP')}</td>
            <td><button class="action-btn danger" onclick="deleteNotice('${n.id}')">削除</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function postNotice() {
  const title = document.getElementById('notice-title').value.trim();
  const body = document.getElementById('notice-body').value.trim();
  const errEl = document.getElementById('notice-err');

  if (!title) { errEl.textContent = 'タイトルを入力してください'; return; }
  if (!body) { errEl.textContent = '本文を入力してください'; return; }

  const { error } = await sb.from('notices').insert({ title, body });
  if (error) { errEl.textContent = '投稿に失敗しました'; return; }

  document.getElementById('notice-title').value = '';
  document.getElementById('notice-body').value = '';
  errEl.textContent = '';
  await loadNoticesAdmin();
}

async function deleteNotice(id) {
  if (!confirm('このお知らせを削除しますか？')) return;
  await sb.from('notices').delete().eq('id', id);
  await loadNoticesAdmin();
}

function closeModal() {
  const m = document.getElementById('novel-modal');
  if (m) m.remove();
}

async function viewNovel(id) {
  const { data: novel } = await sb.from('novels').select('*').eq('id', id).single();
  if (!novel) return;
  let modal = document.getElementById('novel-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'novel-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
  }
  const charStr = novel.char_count ? novel.char_count.toLocaleString() + '字（' + Math.round(novel.char_count/10000*10)/10 + '万字）' : '—';
  const parts = novel.body.split('---CHAPTER---');
  const bodyHTML = parts.map((part, i) =>
    (i > 0 ? '<div style="text-align:center;color:#a08060;margin:20px 0;font-size:13px;">--- 章 ---</div>' : '') +
    part.split('\n').map(l => '<p style="margin-bottom:.7em;font-size:14px;line-height:2;color:#2c1f14;">' + escHtml(l) + '</p>').join('')
  ).join('');
  modal.innerHTML =
    '<div style="background:#faf8f5;border-radius:16px;max-width:640px;width:100%;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">' +
    '<div style="padding:16px 20px;border-bottom:0.5px solid #e8ddd3;background:#fff;">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">' +
    '<div style="font-family:Noto Serif JP,serif;font-size:16px;font-weight:500;color:#2c1f14;">' + escHtml(novel.title) + '</div>' +
    '<button onclick="closeModal()" style="background:none;border:0.5px solid #e8ddd3;border-radius:8px;padding:6px 12px;font-size:12px;color:#a08060;cursor:pointer;flex-shrink:0;margin-left:10px;">閉じる</button>' +
    '</div>' +
    '<div style="font-size:12px;color:#a08060;margin-bottom:6px;">' + escHtml(novel.catchcopy) + '</div>' +
    '<div style="display:flex;gap:12px;font-size:11px;color:#a08060;">' +
    '<span>ジャンル：' + (novel.genre||'—') + '</span>' +
    '<span>文字数：' + charStr + '</span>' +
    '<span>スコア：' + Math.round((novel.bayes_score||0.65)*100) + '%</span>' +
    (novel.pen_name ? '<span>ペンネーム：' + escHtml(novel.pen_name) + '</span>' : '') +
    '</div>' +
    '</div>' +
    '<div style="padding:20px;overflow-y:auto;flex:1;">' + bodyHTML + '</div>' +
    '</div>';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 管理者：問い合わせ一覧
let adminInquiryOpen = null;

async function loadInquiriesAdmin() {
  const el = document.getElementById('inquiries-list');
  el.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: inquiries } = await sb.from('inquiries')
    .select('*, inquiry_messages(count)')
    .order('created_at', { ascending: false });

  if (!inquiries || inquiries.length === 0) {
    el.innerHTML = '<div class="loading">問い合わせはありません</div>';
    return;
  }

  el.innerHTML = `
    <table>
      <thead><tr><th>件名</th><th>状態</th><th>日付</th><th>操作</th></tr></thead>
      <tbody>
        ${inquiries.map(inq => `
          <tr>
            <td style="font-weight:500">${escHtml(inq.title)}</td>
            <td><span class="badge ${inq.status === 'open' ? 'badge-report' : 'badge-hidden'}">${inq.status === 'open' ? '対応中' : '解決済み'}</span></td>
            <td style="font-size:11px;color:var(--ink3)">${new Date(inq.created_at).toLocaleDateString('ja-JP')}</td>
            <td><button class="action-btn success" onclick="openInquiryAdmin('${inq.id}')">返信</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div id="inquiry-admin-chat" style="margin-top:16px;"></div>
  `;
}

async function openInquiryAdmin(inquiryId) {
  adminInquiryOpen = inquiryId;
  const { data: messages } = await sb.from('inquiry_messages')
    .select('*')
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true });

  const { data: inq } = await sb.from('inquiries').select('*').eq('id', inquiryId).single();

  const msgsHTML = (messages || []).map(m => {
    const isAdmin = m.sender_type === 'admin';
    const date = new Date(m.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
    return `
      <div style="display:flex;flex-direction:column;margin-bottom:4px;">
        ${isAdmin ? `
          <div style="background:var(--acc);color:#fff;padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.7;max-width:82%;align-self:flex-end;">${escHtml(m.body)}</div>
          <div style="font-size:10px;color:var(--ink3);margin-bottom:4px;text-align:right;padding-right:4px;">管理者 · ${date}</div>
        ` : `
          <div style="background:var(--acc3);color:var(--ink);padding:9px 12px;border-radius:10px;font-size:13px;line-height:1.7;max-width:82%;">${escHtml(m.body)}</div>
          <div style="font-size:10px;color:var(--ink3);margin-bottom:4px;padding-left:4px;">ユーザー · ${date}</div>
        `}
      </div>
    `;
  }).join('');

  const el = document.getElementById('inquiry-admin-chat');
  el.innerHTML = `
    <div style="background:#fff;border:0.5px solid var(--border);border-radius:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:0.5px solid var(--border);">
        <div style="font-family:'Noto Serif JP',serif;font-size:14px;font-weight:500;color:var(--ink);">${escHtml(inq.title)}</div>
        <span class="badge ${inq.status === 'open' ? 'badge-report' : 'badge-hidden'}">${inq.status === 'open' ? '対応中' : '解決済み'}</span>
      </div>
      <div style="padding:14px 16px;display:flex;flex-direction:column;max-height:300px;overflow-y:auto;">${msgsHTML}</div>
      ${inq.status === 'open' ? `
        <div style="display:flex;gap:8px;align-items:flex-end;border-top:0.5px solid var(--border);padding:12px 16px;">
          <textarea id="admin-reply-input" placeholder="返信を入力..." style="flex:1;padding:8px 11px;border:0.5px solid var(--border);border-radius:9px;font-size:13px;resize:none;height:40px;background:var(--bg);font-family:'Zen Kaku Gothic New',sans-serif;"></textarea>
          <button onclick="sendAdminReply('${inquiryId}')" style="padding:9px 16px;background:var(--acc);color:#fff;border:none;border-radius:9px;font-size:12px;cursor:pointer;">送信</button>
        </div>
      ` : ''}
    </div>
  `;
}

async function sendAdminReply(inquiryId) {
  const body = document.getElementById('admin-reply-input').value.trim();
  if (!body) return;
  await sb.from('inquiry_messages').insert({ inquiry_id: inquiryId, sender_type: 'admin', body });
  await openInquiryAdmin(inquiryId);
}
