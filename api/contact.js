export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, type, body, userId, userEmail, pageUrl, userAgent, now } = req.body;

  const typeLabels = {
    bug: '不具合・エラーの報告',
    feature: '機能のご要望',
    copyright: '著作権・コンテンツに関するご相談',
    account: 'アカウントに関するご相談',
    delete: '作品・アカウントの削除依頼',
    other: 'その他'
  };

  const emailBody =
    '【Yonder お問い合わせ】\n\n' +
    '種別: ' + (typeLabels[type] || type) + '\n' +
    'お名前: ' + (name || '未記入') + '\n' +
    '返信先メール: ' + email + '\n\n' +
    '--- お問い合わせ内容 ---\n' +
    body + '\n\n' +
    '--- システム情報 ---\n' +
    '送信日時: ' + now + '\n' +
    'ユーザーID: ' + userId + '\n' +
    'ログインメール: ' + userEmail + '\n' +
    'ページURL: ' + pageUrl + '\n' +
    'ブラウザ: ' + userAgent;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY
      },
      body: JSON.stringify({
        from: 'Yonder お問い合わせ <noreply@kotobakagami.com>',
        to: ['yuuhi527000@gmail.com'],
        reply_to: email,
        subject: '【Yonder】' + (typeLabels[type] || type) + ' - ' + (name || email),
        text: emailBody
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
