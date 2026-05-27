// 管理者のuser IDをここに設定（後でSupabaseのAuthページで確認してください）
const ADMIN_IDS = ['d425963b-9609-4272-9fce-5a22b52bf08b'];

let currentUser = null;

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;

  // 管理者チェック（ADMIN_IDSが空の場合は全員アクセス可 - 開発中のみ）
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
}

async function loadStats() {
  const { count: novelCount } = await sb.from('novels').select('*', { count: 'exact', head: true });
  const { count: reviewCount } = await sb.from('reviews').select('*', { count: 'exact', head: true });
  const { count: reportCount } = await sb.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending');

  document.getElementById('s-novels').textContent = novelCount || 0;
  document.getElementById('s-reviews').textContent = reviewCount || 0;
  document.getElementById('s-reports').textContent = reportCount || 0;
  document.getElementById('s-users').textContent = '—';
}

let novelSortKey = 'created_at';
let novelSortAsc = false;
let allNovels = [];

async function loadNovels() {
  const el = document.getElementById('novels-table');
  const { data: novels } = await sb.from('novels').select('*').order('created_at', { ascending: false });
  allNovels = novels || [];
  renderNovels();
}

function setSort(key) {
  if (novelSortKey === key) {
    novelSortAsc = !novelSortAsc;
  } else {
    novelSortKey = key;
    novelSortAsc = key !== 'created_at';
  }
  renderNovels();
}

function renderNovels() {
  const el = document.getElementById('novels-table');

  if (!allNovels || allNovels.length === 0) {
    el.innerHTML = '<div class="loading">作品がありません</div>';
    return;
  }

  const sorted = [...allNovels].sort((a, b) => {
    let av, bv;
    if (novelSortKey === 'created_at') { av = new Date(a.created_at); bv = new Date(b.created_at); }
    else if (novelSortKey === 'bayes_score') { av = a.bayes_score || 0; bv = b.bayes_score || 0; }
    return novelSortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const { data: allReports } = await sb.from('reports').select('novel_id').eq('status', 'pending');
  const reportedIds = allReports ? allReports.map(r => r.novel_id) : [];

  const sortIcon = (key) => novelSortKey === key ? (novelSortAsc ? ' ↑' : ' ↓') : '';

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>タイトル</th>
          <th>ジャンル</th>
          <th style="cursor:pointer" onclick="setSort('bayes_score')">スコア${sortIcon('bayes_score')}</th>
          <th>状態</th>
          <th style="cursor:pointer" onclick="setSort('created_at')">投稿日${sortIcon('created_at')}</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(n => `
          <tr id="novel-row-${n.id}">
            <td>
              <div class="novel-title-cell" style="cursor:pointer;color:var(--acc);" onclick="viewNovel('${n.id}')">${escHtml(n.title)}</div>
              <div style="font-size:11px;color:var(--ink3);margin-top:2px;">${escHtml(n.catchcopy)}</div>
            </td>
            <td>${n.genre || '—'}</td>
            <td class="score-cell" style="color:${n.bayes_score >= 0.7 ? '#4a9b6f' : n.bayes_score >= 0.5 ? 'var(--acc)' : '#b85a42'}">
              ${Math.round((n.bayes_score || 0.65) * 100)}%
            </td>
            <td>
              ${!n.is_visible ? '<span class="badge badge-hidden">非表示</span>' : reportedIds.includes(n.id) ? '<span class="badge badge-report">通報あり</span>' : '<span class="badge badge-good">公開中</span>'}
            </td>
            <td style="font-size:11px;color:var(--ink3);">${new Date(n.created_at).toLocaleDateString('ja-JP')}</td>
            <td>
              ${n.is_visible
                ? `<button class="action-btn danger" onclick="hideNovel('${n.id}')">非表示</button>`
                : `<button class="action-btn success" onclick="showNovel('${n.id}')">公開に戻す</button>`
              }
              <button class="action-btn danger" onclick="deleteNovel('${n.id}')">削除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadReports() {
  const el = document.getElementById('reports-table');
  el.innerHTML = '<div class="loading">読み込み中...</div>';

  const { data: reports } = await sb.from('reports')
    .select('*, novels(title, catchcopy)')
    .order('created_at', { ascending: false });

  if (!reports || reports.length === 0) {
    el.innerHTML = '<div class="loading">通報はありません</div>';
    return;
  }

  const reasonMap = { copyright:'著作権侵害', inappropriate:'不適切な内容', other:'その他' };
  const statusMap = { pending:'未対応', resolved:'対応済み', dismissed:'却下' };
  const statusClass = { pending:'badge-report', resolved:'badge-good', dismissed:'badge-hidden' };

  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>作品</th>
          <th>理由</th>
          <th>コメント</th>
          <th>状態</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${reports.map(r => `
          <tr id="report-row-${r.id}">
            <td>
              <div class="novel-title-cell">${r.novels ? escHtml(r.novels.title) : '（削除済み）'}</div>
            </td>
            <td>${reasonMap[r.reason] || r.reason}</td>
            <td style="font-size:12px;color:var(--ink3);max-width:200px;">${r.comment ? escHtml(r.comment) : '—'}</td>
            <td><span class="badge ${statusClass[r.status]}">${statusMap[r.status]}</span></td>
            <td>
              ${r.status === 'pending' ? `
                <button class="action-btn danger" onclick="handleReport('${r.id}','${r.novel_id}','resolved')">非表示にする</button>
                <button class="action-btn" onclick="handleReport('${r.id}','${r.novel_id}','dismissed')">却下</button>
              ` : '—'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function hideNovel(id) {
  if (!confirm('この作品を非表示にしますか？')) return;
  await sb.from('novels').update({ is_visible: false }).eq('id', id);
  await loadNovels();
  await loadStats();
}

async function showNovel(id) {
  await sb.from('novels').update({ is_visible: true }).eq('id', id);
  await loadNovels();
}

async function deleteNovel(id) {
  if (!confirm('この作品を完全に削除しますか？この操作は取り消せません。')) return;
  await sb.from('reviews').delete().eq('novel_id', id);
  await sb.from('novel_stats').delete().eq('novel_id', id);
  await sb.from('reading_lock').delete().eq('novel_id', id);
  await sb.from('reports').delete().eq('novel_id', id);
  await sb.from('novels').delete().eq('id', id);
  await loadNovels();
  await loadStats();
}

async function handleReport(reportId, novelId, action) {
  await sb.from('reports').update({ status: action }).eq('id', reportId);
  if (action === 'resolved' && novelId) {
    await sb.from('novels').update({ is_visible: false }).eq('id', novelId);
  }
  await loadReports();
  await loadStats();
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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

  const parts = novel.body.split('---CHAPTER---');
  const bodyHTML = parts.map((part, i) =>
    (i > 0 ? '<div style="text-align:center;color:#a08060;margin:20px 0;font-size:13px;">― 章 ―</div>' : '') +
    part.split('\n').map(l => '<p style="margin-bottom:.7em;font-size:14px;line-height:2;color:#2c1f14;">' + escHtml(l) + '</p>').join('')
  ).join('');

  modal.innerHTML = \`
    <div style="background:#faf8f5;border-radius:16px;max-width:640px;width:100%;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;">
      <div style="padding:16px 20px;border-bottom:0.5px solid #e8ddd3;display:flex;align-items:center;justify-content:space-between;background:#fff;">
        <div>
          <div style="font-family:'Noto Serif JP',serif;font-size:16px;font-weight:500;color:#2c1f14;">\${escHtml(novel.title)}</div>
          <div style="font-size:12px;color:#a08060;margin-top:2px;">\${escHtml(novel.catchcopy)}</div>
        </div>
        <button onclick="document.getElementById('novel-modal').remove()" style="background:none;border:0.5px solid #e8ddd3;border-radius:8px;padding:6px 12px;font-size:12px;color:#a08060;cursor:pointer;">閉じる</button>
      </div>
      <div style="padding:20px;overflow-y:auto;flex:1;">\${bodyHTML}</div>
    </div>
  \`;
}
