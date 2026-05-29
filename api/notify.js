export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { authorEmail, authorPenName, novelTitle, rating, comment } = req.body;
  if (!authorEmail || !novelTitle) return res.status(400).json({ error: 'Missing params' });

  const ratingMap = { good: 'よかった', mid: '普通', bad: '期待外れ' };
  const ratingLabel = ratingMap[rating] || rating;

  const text = [
    '【Yonder】新しい評価が届きました',
    '',
    '作品：' + novelTitle,
    '評価：' + ratingLabel,
    comment ? 'コメント：' + comment : '',
    '',
    'ダッシュボードで詳細を確認できます：',
    'https://yonder.kotobakagami.com/dashboard.html',
  ].filter(Boolean).join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'Yonder <noreply@kotobakagami.com>',
        to: [authorEmail],
        subject: '【Yonder】「' + novelTitle + '」に新しい評価が届きました',
        text
      })
    });
    if (!response.ok) throw new Error('send failed');
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
