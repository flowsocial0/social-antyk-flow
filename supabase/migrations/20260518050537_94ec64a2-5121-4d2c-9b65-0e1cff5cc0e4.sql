-- Backfill X CreditsDepleted errors for campaign dfd66aac
UPDATE campaign_posts
SET error_code = 'X_CREDITS_DEPLETED',
    next_retry_at = NULL
WHERE campaign_id = 'dfd66aac-14b1-44cc-abc7-d49a45604664'
  AND status = 'failed'
  AND error_code = 'unknown'
  AND (error_message ILIKE '%CreditsDepleted%' OR error_message ILIKE '%402%');

-- Pause all scheduled X posts in this campaign (mark as failed with depleted code so they stop retrying)
UPDATE campaign_posts
SET status = 'failed',
    error_code = 'X_CREDITS_DEPLETED',
    error_message = 'Wstrzymane: brak kredytów na X. Doładuj konto na developer.x.com i wznów kampanię.',
    next_retry_at = NULL
WHERE campaign_id = 'dfd66aac-14b1-44cc-abc7-d49a45604664'
  AND status = 'scheduled'
  AND platforms::text ILIKE '%x%';