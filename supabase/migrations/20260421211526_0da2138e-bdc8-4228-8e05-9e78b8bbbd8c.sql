UPDATE saas.access_state
SET 
  app_access = 'trial',
  trial_started_at = now(),
  trial_ends_at = now() + interval '30 days',
  updated_at = now()
WHERE user_id = '57497be9-977e-4678-a115-44a428b85b13';

INSERT INTO saas.access_state (user_id, trial_started_at, trial_ends_at, app_access)
SELECT '57497be9-977e-4678-a115-44a428b85b13', now(), now() + interval '30 days', 'trial'
WHERE NOT EXISTS (SELECT 1 FROM saas.access_state WHERE user_id = '57497be9-977e-4678-a115-44a428b85b13');