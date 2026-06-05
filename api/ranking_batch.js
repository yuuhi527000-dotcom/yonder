// Vercel Cron Job: 毎日 0:00 JST（= 15:00 UTC）に実行
// vercel.json で crons を設定してください

import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  // Cron からの呼び出しか確認
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // reviews に紐づく novels.char_count を user ごとに合計
    const { data: aggregated, error } = await sb
      .from('reviews')
      .select('user_id, novels(char_count)')
      .not('novels.char_count', 'is', null);

    if (error) throw error;

    // user_id ごとに集計
    const map = {};
    for (const row of aggregated || []) {
      const uid = row.user_id;
      const chars = row.novels?.char_count || 0;
      if (!map[uid]) map[uid] = { total_chars: 0, novel_count: 0 };
      map[uid].total_chars += chars;
      map[uid].novel_count += 1;
    }

    // 文字数降順でソートして rank を付与
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
      const { error: upsertErr } = await sb
        .from('reader_ranking')
        .upsert(upsertData, { onConflict: 'user_id' });
      if (upsertErr) throw upsertErr;
    }

    // 集計対象外になったユーザー（全作品削除など）のランクをリセット
    const activeUserIds = upsertData.map(d => d.user_id);
    if (activeUserIds.length > 0) {
      await sb
        .from('reader_ranking')
        .delete()
        .not('user_id', 'in', `(${activeUserIds.join(',')})`);
    }

    return res.status(200).json({ ok: true, updated: upsertData.length });
  } catch (e) {
    console.error('ranking_batch error:', e);
    return res.status(500).json({ error: e.message });
  }
}
