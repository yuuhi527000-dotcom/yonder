// 投稿画面 - 次のステップで実装
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) window.location.href = 'login.html';
})();
