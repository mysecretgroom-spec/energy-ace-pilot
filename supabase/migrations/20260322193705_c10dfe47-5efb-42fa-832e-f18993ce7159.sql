UPDATE saas.access_state 
SET app_access = 'active', 
    is_beta_tester = true, 
    beta_expires_at = NULL,
    trial_ends_at = now() + interval '100 years',
    updated_at = now()
WHERE user_id = '5a4dbd65-5d57-4c29-ab17-fe339592039a';