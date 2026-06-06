// Vercel Cron Job: 毎日 0:00 JST（= 15:00 UTC）に実行

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation',
  };

  try {
    // reviewsとnovelsを結合して文字数を集計
    const reviewsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?select=user_id,novels(char_count)&novels.char_count=gt.0`,
      { headers }
    );
    const reviews = await reviewsRes.json();

    // user_idごとに集計
    const map = {};
    for (const row of reviews || []) {
      const uid = row.user_id;
      const chars = row.novels?.char_count || 0;
      if (chars === 0) continue;
      if (!map[uid]) map[uid] = { total_chars: 0, novel_count: 0 };
      map[uid].total_chars += chars;
      map[uid].novel_count += 1;
    }

    // 文字数降順でソートしてrankを付与
    const sorted = Object.entries(map)
      .sort((a, b) => b[1].total_chars - a[1].total_chars);

    const upsertData = sorted.map(([user_id, v], i) => ({
      user_id,
      total_chars: v.total_chars,
      novel_count: v.novel_count,
      rank: i + 1,
      updated_at: new Date().toISOString(),
    }));

    if (upsertData.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/reader_ranking`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(upsertData),
      });
    }

    return res.status(200).json({ ok: true, updated: upsertData.length });
  } catch (e) {
    console.error('ranking_batch error:', e);
    return res.status(500).json({ error: e.message });
  }
}
