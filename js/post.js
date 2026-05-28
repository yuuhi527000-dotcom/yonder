let selectedGenre = null;
let dividers = new Set();
let lines = [];
let linkState = { narou: true, kakuyomu: true, x: true };
let openPopup = null;
let currentUser = null;

// 初期化
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUser = session.user;
  document.getElementById('hdr-email').textContent = currentUser.email;
})();

// ログアウト
async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}

// キャッチコピー文字数
function updCopy() {
  const v = document.getElementById('inp-copy').value;
  const len = [...v].length;
  const el = document.getElementById('copy-count');
  el.textContent = len + ' / 50';
  el.className = 'char-count' + (len > 50 ? ' over' : '');
  checkSubmit();
}

// ジャンル選択
function selGenre(el, genre) {
  document.querySelectorAll('#genre-group .tag').forEach(t => t.classList.remove('sel'));
  el.classList.add('sel');
  selectedGenre = genre;
  checkSubmit();
}

// リンクバリデーション
const RULES = {
  narou:    v => /^https:\/\/(ncode|novel18)\.syosetu\.com\//.test(v),
  kakuyomu: v => /^https:\/\/kakuyomu\.jp\//.test(v),
  x:        v => /^https:\/\/(x|twitter)\.com\//.test(v),
};
const HINTS = {
  narou:    'ncode.syosetu.com または novel18.syosetu.com で始まるURLを入力してください',
  kakuyomu: 'kakuyomu.jp で始まるURLを入力してください',
  x:        'x.com または twitter.com で始まるURLを入力してください',
};

function validateLink(key) {
  const inp = document.getElementById('inp-' + key);
  const msg = document.getElementById('msg-' + key);
  const v = inp.value.trim();
  if (v === '') {
    inp.className = ''; msg.innerHTML = ''; linkState[key] = true;
  } else if (RULES[key](v)) {
    inp.className = 'valid';
    msg.innerHTML = '<div class="link-ok">✓ 有効なURLです</div>';
    linkState[key] = true;
  } else {
    inp.className = 'invalid';
    msg.innerHTML = '<div class="link-err">✗ ' + HINTS[key] + '</div>';
    linkState[key] = false;
  }
  checkSubmit();
}

// 本文読み込み・エディタ反映
function loadBody() {
  const text = document.getElementById('body-input').value;
  if (!text.trim()) {
    document.getElementById('lines-area').innerHTML = '<div style="padding:20px;font-size:13px;color:var(--ink3);text-align:center;">下のテキストエリアに本文を貼り付けてください</div>';
    lines = [];
    dividers = new Set();
    checkSubmit();
    return;
  }
  lines = text.split('\n');
  dividers = new Set();
  renderEditor();
  checkSubmit();
}

function renderEditor() {
  const area = document.getElementById('lines-area');
  area.innerHTML = '';
  lines.forEach((text, i) => {
    if (dividers.has(i)) {
      const div = document.createElement('div');
      div.className = 'chapter-divider';
      div.innerHTML = '<div class="div-line"></div><div class="div-ornament">― 章 ―</div><div class="div-line"></div><button class="div-remove" onclick="removeDivider(' + i + ')">✕</button>';
      area.appendChild(div);
    }
    const row = document.createElement('div');
    row.className = 'line-row';
    const marker = document.createElement('div');
    marker.className = 'line-marker';
    marker.textContent = '▶';
    marker.onclick = (e) => { e.stopPropagation(); togglePopup(i, row); };
    const lineText = document.createElement('div');
    lineText.className = 'line-text' + (text.trim() === '' ? ' empty' : '');
    lineText.textContent = text || '　';
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.id = 'popup-' + i;
    popup.innerHTML = '<div class="popup-item" onclick="addDivider(' + i + ')">この行の上に章区切りを入れる</div>';
    row.appendChild(marker);
    row.appendChild(lineText);
    row.appendChild(popup);
    area.appendChild(row);
  });
}

function togglePopup(idx) {
  if (openPopup !== null && openPopup !== idx) {
    const prev = document.getElementById('popup-' + openPopup);
    if (prev) prev.classList.remove('show');
  }
  const p = document.getElementById('popup-' + idx);
  if (!p) return;
  const showing = p.classList.contains('show');
  p.classList.toggle('show', !showing);
  openPopup = showing ? null : idx;
}

function addDivider(idx) {
  dividers.add(idx);
  const p = document.getElementById('popup-' + idx);
  if (p) p.classList.remove('show');
  openPopup = null;
  renderEditor();
}

function removeDivider(idx) {
  dividers.delete(idx);
  renderEditor();
}

document.addEventListener('click', () => {
  if (openPopup !== null) {
    const p = document.getElementById('popup-' + openPopup);
    if (p) p.classList.remove('show');
    openPopup = null;
  }
});

// 投稿ボタン活性チェック
function checkSubmit() {
  const title = document.getElementById('inp-title').value.trim();
  const copy = document.getElementById('inp-copy').value.trim();
  const copyLen = [...copy].length;
  const body = document.getElementById('body-input').value.trim();
  const linksOk = linkState.narou && linkState.kakuyomu && linkState.x;
  const termsOk = document.getElementById('terms-check') ? document.getElementById('terms-check').checked : true;
  document.getElementById('submit-btn').disabled = !(title && copy && copyLen <= 50 && selectedGenre && body && linksOk && termsOk);
}

// 本文を章区切り込みで構築
function buildBody() {
  let result = '';
  lines.forEach((text, i) => {
    if (dividers.has(i)) result += '\n---CHAPTER---\n';
    result += text + '\n';
  });
  return result.trim();
}

// 投稿処理
async function submitNovel() {
  const btn = document.getElementById('submit-btn');
  const errEl = document.getElementById('err-msg');
  btn.disabled = true;
  btn.textContent = '投稿中...';
  errEl.textContent = '';

  const title = document.getElementById('inp-title').value.trim();
  const catchcopy = document.getElementById('inp-copy').value.trim();
  const pen_name = document.getElementById('inp-penname').value.trim() || null;
  const narou_url = document.getElementById('inp-narou').value.trim() || null;
  const kakuyomu_url = document.getElementById('inp-kakuyomu').value.trim() || null;
  const x_url = document.getElementById('inp-x').value.trim() || null;
  const body = buildBody();
  const char_count = [...body.replace(/---CHAPTER---/g, '')].length;

  const { error } = await sb.from('novels').insert({
    title,
    catchcopy,
    body,
    genre: selectedGenre,
    char_count,
    author_id: currentUser.id,
    pen_name,
    narou_url,
    kakuyomu_url,
    x_url,
  });

  if (error) {
    errEl.textContent = '投稿に失敗しました：' + error.message;
    btn.disabled = false;
    btn.textContent = '投稿する';
    return;
  }

  document.getElementById('form-screen').style.display = 'none';
  document.getElementById('done-screen').style.display = 'block';
}
