-- Usun stary token i wstaw poprawny sandbox
DELETE FROM pinterest_oauth_tokens WHERE user_id = '644dcc40-a8ec-4125-b340-0b3a6e068683';

INSERT INTO pinterest_oauth_tokens (user_id, access_token, is_sandbox, username, account_name)
VALUES (
  '644dcc40-a8ec-4125-b340-0b3a6e068683',
  'pina_AMATTFQXACFOUBIAGDAJMDZEJCWWNHABACGSPSDI3JWH7NNZGC3LS6BQWANFVK3VZ6T72UYZSCC2SFXUYJNND3LKHTYXR2QA',
  true,
  'flowsocial0',
  'flowsocial0'
);