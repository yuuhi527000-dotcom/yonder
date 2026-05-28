let currentUser = null;
const REVIEWS_PER_PAGE = 3;

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
    const { data: reviews } = await sb.from('reviews').select('*').eq('novel_id', novel.id).order('created_at', { ascending: false });
    const { data: stats } = await sb.from('novel_stats').select('*').eq('novel_id', novel.id).single();

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

    const shownCount = stats ? stats.shown_count : 0;
    const chosenCount = stats ? stats.chosen_count : 0;
    const notChosenCount = stats ? stats.not_chosen_count : 0;
    const chosenPct = shownCount > 0 ? Math.round(chosenCount / shownCount * 100) : 0;

    const scoreClass = bayesPct >= 70 ? 'score-high' : bayesPct >= 50 ? 'score-mid' : 'score-low';
    const bailReasonMap = { tired:'時間・気力がない', mismatch:'思っていたのと違った', tempo:'テンポが合わなかった', other:'その他' };

    // レビューをページに分割
    const reviewPages = [];
    if (reviews && reviews.length > 0) {
      for (let i = 0; i < reviews.length; i += REVIEWS_PER_PAGE) {
        reviewPages.push(reviews.slice(i, i + REVIEWS_PER_PAGE));
      }
    }
    const totalPages = reviewPages.length;
    const nid = novel.id.replace(/-/g, '');

    const reviewsHTML = totalPages === 0
      ? '<div style="padding:16px 18px;font-size:12px;color:var(--ink3);text-align:center;">まだ評価がありません</div>'
      : reviewPages.map((page, pi) => `
          <div class="review-page ${pi === 0 ? 'active' : ''}" id="rp-${nid}-${pi}">
            ${page.map(r => `
              <div class="review-item">
                <span class="rating-badge ${r.rating === 'good' ? 'r-good' : r.rating === 'mid' ? 'r-mid' : 'r-bad'}">
                  ${r.rating === 'good' ? 'よかった' : r.rating === 'mid' ? '普通' : '期待外れ'}
                </span>
                <div class="review-body">
                  <div class="review-comment">${r.comment ? escHtml(r.comment) : '（コメントなし）'}</div>
                  <div class="review-meta">
                    ${r.is_completed ? '読了' : '途中離脱'}
                    ${!r.is_completed && r.bail_reason ? '<span class="bail-tag">理由：' + (bailReasonMap[r.bail_reason] || r.bail_reason) + '</span>' : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `).join('') + (totalPages > 1 ? `
          <div class="pagination">
            <button class="page-btn" id="prev-${nid}" onclick="changePage('${nid}', -1)" disabled aria-label="前のページ"><i class="ti ti-chevron-left" aria-hidden="true"></i></button>
            <span class="page-info" id="pi-${nid}">1 / ${totalPages}ページ</span>
            <button class="page-btn" id="next-${nid}" onclick="changePage('${nid}', 1)" aria-label="次のページ"><i class="ti ti-chevron-right" aria-hidden="true"></i></button>
          </div>
        ` : '');

    const card = document.createElement('div');
    card.className = 'novel-block';
    card.innerHTML = `
      <div class="novel-head">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px;">
          <div class="novel-title">${escHtml(novel.title)}</div>
          <span class="score-badge ${scoreClass}">よかった ${bayesPct}%</span>
        </div>
        <div class="novel-copy" id="copy-display-${novel.id}">
          ${escHtml(novel.catchcopy)}
          <button class="edit-copy" onclick="editCopy('${novel.id}','${escHtml(novel.catchcopy)}')">編集</button>
          <button class="edit-copy" style="border-color:#f0c4b4;color:#b85a42;" onclick="requestDelete('${novel.id}','${escHtml(novel.title)}')">削除申請</button>
        </div>
        <div id="copy-edit-${novel.id}" style="display:none"></div>

        <div class="stats-row" style="margin-top:12px">
          <div class="stat"><div class="stat-n">${shownCount}</div><div class="stat-l">カード表示</div></div>
          <div class="stat"><div class="stat-n">${chosenCount}</div><div class="stat-l">選ばれた</div></div>
          <div class="stat"><div class="stat-n">${notChosenCount}</div><div class="stat-l">選ばれなかった</div></div>
          <div class="stat"><div class="stat-n">${chosenPct}%</div><div class="stat-l">選択率</div></div>
        </div>
        <div class="stats-row" style="margin-top:8px">
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
      </div>
      <div class="reviews-section">${reviewsHTML}</div>
    `;
    list.appendChild(card);
  }

  // ページ状態管理
  window._pageState = window._pageState || {};
}

function changePage(nid, dir) {
  window._pageState = window._pageState || {};
  const cur = (window._pageState[nid] || 0);
  const pages = document.querySelectorAll(`[id^="rp-${nid}-"]`);
  const total = pages.length;
  document.getElementById(`rp-${nid}-${cur}`).classList.remove('active');
  const next = cur + dir;
  document.getElementById(`rp-${nid}-${next}`).classList.add('active');
  window._pageState[nid] = next;
  document.getElementById(`pi-${nid}`).textContent = (next + 1) + ' / ' + total + 'ページ';
  document.getElementById(`prev-${nid}`).disabled = next === 0;
  document.getElementById(`next-${nid}`).disabled = next === total - 1;
}

function editCopy(novelId, currentCopy) {
  document.getElementById('copy-display-' + novelId).style.display = 'none';
  const editWrap = document.getElementById('copy-edit-' + novelId);
  editWrap.style.display = 'block';
  editWrap.innerHTML = `
    <div class="copy-edit-wrap">
      <input type="text" id="copy-input-${novelId}" value="${currentCopy}" maxlength="50">
      <button class="copy-save" onclick="saveCopy('${novelId}')">保存</button>
      <button class="copy-cancel" onclick="cancelEdit('${novelId}')">キャンセル</button>
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
  document.getElementById('copy-display-' + novelId).innerHTML = escHtml(newCopy) + '<button class="edit-copy" onclick="editCopy(\'' + novelId + '\',\'' + escHtml(newCopy) + '\')">編集</button>';
  document.getElementById('copy-display-' + novelId).style.display = 'block';
  document.getElementById('copy-edit-' + novelId).style.display = 'none';
}

function cancelEdit(novelId) {
  document.getElementById('copy-display-' + novelId).style.display = 'block';
  document.getElementById('copy-edit-' + novelId).style.display = 'none';
}

async function requestDelete(novelId, title) {
  if (!confirm('「' + title + '」を削除しますか？\n\n評価データもすべて削除されます。この操作は取り消せません。')) return;
  const btn = event.target;
  btn.disabled = true; btn.textContent = '削除中...';
  try {
    await sb.from('reading_lock').delete().eq('novel_id', novelId);
    await sb.from('reports').delete().eq('novel_id', novelId);
    await sb.from('reviews').delete().eq('novel_id', novelId);
    await sb.from('novel_stats').delete().eq('novel_id', novelId);
    const { error } = await sb.from('novels').delete().eq('id', novelId).eq('author_id', currentUser.id);
    if (error) throw error;
    await loadDashboard();
  } catch(e) {
    alert('削除に失敗しました：' + e.message);
    btn.disabled = false; btn.textContent = '削除申請';
  }
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
