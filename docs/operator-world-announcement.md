# 運営ワールド告知のセットアップ

1. supabase/migrations/202610120001_world_announcements.sql を適用します。公開クライアントは告知を読むことだけができ、直接の書き込みはできません。
2. supabase/functions/world-announcement/index.ts を Supabase Edge Function world-announcement としてデプロイし、JWT検証を無効化します。関数内で専用トークンを検証するためです。
3. Supabase Dashboard の Edge Function Secrets に WORLD_ANNOUNCEMENT_TOKEN を設定します。長くランダムな値を使用し、ゲームコードやGitHubには書き込まないでください。
4. 運営パネルを開き、同じトークンを「運営認証キー」に入力します。ゲームはトークンを保存しません。
5. 全プレイヤーは最大45秒程度で告知を受信します。各端末は45秒ごとにポーリングし、タブが非表示の間は問い合わせを止めます。

重要: サーバー側のトークン設定・マイグレーション適用・Edge Functionデプロイが終わるまでは配信できません。OPERATOR_PLAYER_ID は画面表示の追加条件であり、秘密情報ではありません。書き込み権限はサーバー関数とトークンで保護します。
