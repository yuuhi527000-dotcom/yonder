// js/ranking.js — ランキングページ専用

const LEVELS = [
  { lv: 1, name: '読みはじめ',   min: 0,          emoji: '🌱' },
  { lv: 2, name: '本の虫',       min: 50000,       emoji: '📗' },
  { lv: 3, name: '活字中毒',     min: 200000,      emoji: '💡' },
  { lv: 4, name: '書斎の住人',   min: 500000,      emoji: '📖' },
  { lv: 5, name: '図書館の主',   min: 1000000,     emoji: '📚' },
  { lv: 6, name: '言葉の海人',   min: 3000000,     emoji: '🌊' },
  { lv: 7, name: '伝説の読み手', min: 10000000,    emoji: '✨' },
];

function getLevel(chars) {
  let level = LEVELS[0];
  for (const l of LEVELS) {
    if (chars >= l.min) level = l;
  }
  return level;
}

function getNextLevel(chars) {
  for (let i = 0; i < LEVELS.length - 1; i++) {
    if (chars < LEVELS[i + 1].min) return LEVELS[i + 1];
  }
  return null; // 最高レベル
}

function fmtChars(n) {
  if (n >= 10000) return (Math.round(n / 1000) / 10).toFixed(1) + '万字';
  return n.toLocaleString() + '字';
}

function displayName(profile) {
  const booker = profile.booker_number
    ? 'Booker#' + String(profile.booker_number).padStart(4, '0')
    : null;
  if (profile.pen_name && profile.pen_name !== booker) {
    return escHtml(profile.pen_name) + (booker ? '<span style="font-size:10px;color:var(--ink3);margin-left:4px;">（' + escHtml(booker) + '）</span>' : '');
  }
  return booker ? escHtml(booker) : '読者';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let currentUser = null;

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'landing.html'; return; }
  currentUser = session.user;
  await Promise.all([renderMyStats(), renderRanking()]);
})();

async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

async function renderMyStats() {
  const el = document.getElementById('my-stat-area');

  // 自分のランキングデータ
  const { data: myRank } = await sb.from('reader_ranking')
    .select('*').eq('user_id', currentUser.id).single();

  // 自分のプロフィール
  const { data: profile } = await sb.from('profiles')
    .select('pen_name, booker_number').eq('user_id', currentUser.id).single();

  const chars = myRank?.total_chars || 0;
  const rank = myRank?.rank || null;
  const novelCount = myRank?.novel_count || 0;
  const lv = getLevel(chars);
  const nextLv = getNextLevel(chars);

  const progressPct = nextLv
    ? Math.min(100, Math.round((chars - lv.min) / (nextLv.min - lv.min) * 100))
    : 100;

  const name = profile ? displayName(profile) : '読者';
  const bookerStr = profile?.booker_number
    ? 'Booker#' + String(profile.booker_number).padStart(4, '0')
    : '';

  el.innerHTML = `
    <div style="margin-bottom:14px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--ink3);text-transform:uppercase;margin-bottom:10px;">あなたの読書記録</div>
      <div style="background:#fff;border:0.5px solid var(--border);border-radius:12px;padding:14px;">
        <div style="text-align:center;margin-bottom:12px;">
          <div style="font-size:22px;margin-bottom:2px;">${lv.emoji}</div>
          <div style="font-size:13px;font-weight:500;color:var(--acc);margin-bottom:2px;">${escHtml(lv.name)}</div>
          <div style="font-size:24px;font-weight:500;color:var(--ink);font-family:'Noto Serif JP',serif;">Lv.${lv.lv}</div>
          <div style="font-size:12px;color:var(--ink2);margin-top:4px;">${name}</div>
        </div>
        ${nextLv ? `
        <div>
          <div class="lv-bar-label"><span>Lv.${nextLv.lv}まで</span><span>${fmtChars(chars)} / ${fmtChars(nextLv.min)}</span></div>
          <div class="lv-bar-track"><div class="lv-bar-fill" style="width:${progressPct}%"></div></div>
        </div>` : `<div style="font-size:11px;text-align:center;color:var(--acc);font-weight:500;">最高レベル達成！</div>`}
        <div style="display:flex;gap:0;margin-top:12px;border-top:0.5px solid var(--border);padding-top:12px;">
          <div class="my-stat-item">
            <div class="my-stat-n">${fmtChars(chars)}</div>
            <div class="my-stat-l">累計文字数</div>
          </div>
          <div class="my-stat-item" style="border-left:0.5px solid var(--border);">
            <div class="my-stat-n">${novelCount}</div>
            <div class="my-stat-l">読んだ作品</div>
          </div>
          <div class="my-stat-item" style="border-left:0.5px solid var(--border);">
            <div class="my-stat-n">${rank ? rank + '位' : '圏外'}</div>
            <div class="my-stat-l">現在の順位</div>
          </div>
        </div>
      </div>
    </div>

    <!-- レベル表 -->
    <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--ink3);text-transform:uppercase;margin-bottom:8px;">レベル表</div>
    <div style="background:#fff;border:0.5px solid var(--border);border-radius:12px;overflow:hidden;">
      ${LEVELS.map(l => {
        const isCurrent = l.lv === lv.lv;
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 13px;border-bottom:0.5px solid var(--border);${isCurrent ? 'background:var(--acc3);' : ''}">
          <span style="font-size:15px;width:20px;text-align:center;">${l.emoji}</span>
          <div style="flex:1;">
            <span style="font-size:11px;font-weight:${isCurrent ? '500' : '400'};color:${isCurrent ? 'var(--acc)' : 'var(--ink)'};">${l.name}</span>
            ${isCurrent ? '<span style="font-size:9px;background:var(--acc);color:#fff;border-radius:3px;padding:1px 5px;margin-left:5px;">現在</span>' : ''}
          </div>
          <span style="font-size:10px;color:var(--ink3);">${l.min === 0 ? '0字〜' : fmtChars(l.min) + '〜'}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

async function renderRanking() {
  const el = document.getElementById('ranking-list');

  // 上位20件 + 自分のデータを同時取得
  const [{ data: top20 }, { data: myRank }] = await Promise.all([
    sb.from('reader_ranking').select('user_id, total_chars, novel_count, rank').order('rank', { ascending: true }).limit(20),
    sb.from('reader_ranking').select('user_id, total_chars, novel_count, rank').eq('user_id', currentUser.id).single()
  ]);

  if (!top20 || top20.length === 0) {
    el.innerHTML = '<div class="rank-loading">まだランキングデータがありません。<br>明日0:00に更新されます。</div>';
    return;
  }

  // プロフィール一括取得
  const userIds = [...new Set([...top20.map(r => r.user_id), currentUser.id])];
  const { data: profiles } = await sb.from('profiles')
    .select('user_id, pen_name, booker_number')
    .in('user_id', userIds);

  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

  const myInTop20 = top20.some(r => r.user_id === currentUser.id);

  function makeCard(r, isMe) {
    const profile = profileMap[r.user_id] || {};
    const lv = getLevel(r.total_chars);
    const numClass = r.rank === 1 ? 'top1' : r.rank === 2 ? 'top2' : r.rank === 3 ? 'top3' : '';
    const name = displayName(profile);
    return `
      <div class="rank-card ${isMe ? 'rank-me' : ''}">
        <div class="rank-num ${numClass}">${r.rank}</div>
        <div class="rank-info">
          <div class="rank-name">${name}${isMe ? '<span class="me-badge">あなた</span>' : ''}</div>
          <div class="rank-lv">${lv.emoji} ${escHtml(lv.name)}　Lv.${lv.lv}</div>
        </div>
        <div class="rank-right">
          <div class="rank-chars">${fmtChars(r.total_chars)}</div>
          <div class="rank-unit">累計</div>
        </div>
      </div>
    `;
  }

  let html = top20.map(r => makeCard(r, r.user_id === currentUser.id)).join('');

  // 自分が圏外（21位以下）の場合
  if (!myInTop20 && myRank) {
    html += '<hr class="rank-divider">';
    html += makeCard(myRank, true);
  } else if (!myInTop20 && !myRank) {
    html += '<hr class="rank-divider">';
    html += `<div class="rank-card rank-me">
      <div class="rank-num">—</div>
      <div class="rank-info">
        <div class="rank-name">${displayName(profileMap[currentUser.id] || {})}<span class="me-badge">あなた</span></div>
        <div class="rank-lv">🌱 読みはじめ　Lv.1</div>
      </div>
      <div class="rank-right">
        <div class="rank-chars">0字</div>
        <div class="rank-unit">累計</div>
      </div>
    </div>`;
  }

  el.innerHTML = html;
}
