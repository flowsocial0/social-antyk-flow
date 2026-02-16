
DELETE FROM pinterest_oauth_tokens a
USING pinterest_oauth_tokens b
WHERE a.user_id = b.user_id
  AND a.created_at < b.created_at;

ALTER TABLE pinterest_oauth_tokens
ADD CONSTRAINT pinterest_oauth_tokens_user_id_key UNIQUE (user_id);
