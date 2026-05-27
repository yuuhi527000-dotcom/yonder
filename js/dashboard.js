let currentUser = null;

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  await loadDashboard();
})();

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

async function loadDashboard() {
  const list = document.getElementById('novels-list');

  const { data: novels } = await sb.from('novels').select('*').eq('author_id', currentUser.id).order('created_at', { ascending: false });

  if (!novels || novels.length === 0) {
    list.innerHTML = '<div class="empty">まだ投稿した作品がありません。<br><a href="post.html" style="color:var(--acc)">投稿する →</a></div>';
    return;
  }

  list.innerHTML = '';

  for (const novel of novels) {
    const { data: reviews } = await sb.from('reviews').select('*').eq('novel_id', novel.id);
    const total = reviews ? reviews.length : 0;
    const good = reviews ? reviews.filter(r => r.rating === 'good').length : 0;
    const mid = reviews ? reviews.filter(r => r.rating === 'mid').length : 0;
    const bad = reviews ? reviews.filter(r => r.rating === 'bad').length : 0;
    const completed = reviews ? reviews.filter(r => r.is_completed).length : 0;
    const bails = reviews ? reviews.filter(r => !r.is_completed) : [];
    const goodPct = total > 0 ? Math.round(good / total * 100) : 0;
    const midPct = total > 0 ? Math.round(mid / total * 100) : 0;
    const badPct = total > 0 ? Math.round(bad / total * 100) : 0;
    const bayesPct = Math.round((novel.bayes_score || 0.65) * 100);

    const scoreClass = bayesPct >= 70 ? 'score-high' : bayesPct >= 50 ? 'score-mid' : 'score-low';

    const bailReasonMap = { tired:'時間・気力がない', mismatch:'思っていたのと違った', tempo:'テンポが合わなかった', other:'その他' };

    const bailHTML = bails.length > 0
      ? '<div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--ink3);text-transform:uppercase;margin-bottom:8px;">途中離脱のコメント</div><div class="bail-list">' +
        bails.filter(b => b.comment || b.bail_reason).map(b =>
          '<div class="bail-item">' +
          (b.comment ? escHtml(b.comment) : '（コメントなし）') +
          '<div class="bail-reason">理由：' + (bailReasonMap[b.bail_reason] || b.bail_reason || '未選択') + '</div>' +
          '</div>'
        ).join('') + '</div>'
      : '';

    const comments = reviews ? reviews.filter(r => r.is_completed && r.comment) : [];
    const commentHTML = comments.length > 0
      ? '<div class="divider"></div><div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--ink3);text-transform:uppercase;margin-bottom:8px;">読者コメント</div><div class="bail-list">' +
        comments.map(c => '<div class="bail-item">' + escHtml(c.comment) + '</div>').join('') + '</div>'
      : '';

    const card = document.createElement('div');
    card.className = 'novel-card';
    card.id = 'novel-card-' + novel.id;
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;">
        <div class="novel-title">${escHtml(novel.title)}</div>
        <span class="score-badge ${scoreClass}">よかった ${bayesPct}%</span>
      </div>
      <div class="novel-copy" id="copy-display-${novel.id}">
        ${escHtml(novel.catchcopy)}
        <button class="edit-copy" onclick="editCopy('${novel.id}', '${escHtml(novel.catchcopy)}')">編集</button>
      </div>
      <div id="copy-edit-${novel.id}" style="display:none"></div>

      <div class="stats-grid">
        <div class="stat-box"><div class="stat-num">${total}</div><div class="stat-label">総評価数</div></div>
        <div class="stat-box"><div class="stat-num">${completed}</div><div class="stat-label">読了数</div></div>
        <div class="stat-box"><div class="stat-num">${bails.length}</div><div class="stat-label">途中離脱数</div></div>
      </div>

      ${total > 0 ? `
      <div class="eval-bar">
        <div class="bar-good" style="width:${goodPct}%"></div>
        <div class="bar-mid" style="width:${midPct}%"></div>
        <div class="bar-bad" style="width:${badPct}%"></div>
      </div>
      <div class="eval-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#7db89a"></div>よかった ${goodPct}%</div>
        <div class="legend-item"><div class="legend-dot" style="background:#c4956a"></div>普通 ${midPct}%</div>
        <div class="legend-item"><div class="legend-dot" style="background:#d49080"></div>期待外れ ${badPct}%</div>
      </div>` : '<div style="font-size:12px;color:var(--ink3);text-align:center;padding:10px 0;">まだ評価がありません</div>'}

      ${bails.length > 0 ? '<div class="divider"></div>' + bailHTML : ''}
      ${commentHTML}
    `;
    list.appendChild(card);
  }
}

function editCopy(novelId, currentCopy) {
  document.getElementById('copy-display-' + novelId).style.display = 'none';
  const editWrap = document.getElementById('copy-edit-' + novelId);
  editWrap.style.display = 'block';
  editWrap.innerHTML = `
    <div class="copy-edit-wrap">
      <input type="text" id="copy-input-${novelId}" value="${currentCopy}" maxlength="50">
      <button class="copy-save" onclick="saveCopy('${novelId}')">保存</button>
      <button class="copy-cancel" onclick="cancelEdit('${novelId}', '${currentCopy}')">キャンセル</button>
    </div>
    <div style="font-size:10px;color:var(--ink3);margin-top:3px;">50字以内</div>
  `;
}

async function saveCopy(novelId) {
  const inp = document.getElementById('copy-input-' + novelId);
  const newCopy = inp.value.trim();
  if (!newCopy || [...newCopy].length > 50) { alert('50字以内で入力してください'); return; }
  const { error } = await sb.from('novels').update({ catchcopy: newCopy }).eq('id', novelId).eq('author_id', currentUser.id);
  if (error) { alert('保存に失敗しました'); return; }
  document.getElementById('copy-display-' + novelId).innerHTML = escHtml(newCopy) + '<button class="edit-copy" onclick="editCopy(\'' + novelId + '\', \'' + escHtml(newCopy) + '\')">編集</button>';
  document.getElementById('copy-display-' + novelId).style.display = 'block';
  document.getElementById('copy-edit-' + novelId).style.display = 'none';
}

function cancelEdit(novelId, originalCopy) {
  document.getElementById('copy-display-' + novelId).style.display = 'block';
  document.getElementById('copy-edit-' + novelId).style.display = 'none';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
