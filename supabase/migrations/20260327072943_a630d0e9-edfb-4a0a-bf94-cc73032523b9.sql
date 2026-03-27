INSERT INTO saas.admin_users (user_id)
SELECT unnest(ARRAY[
  '6fb326ff-526a-41d9-a697-4f159556a846'::uuid,
  'a2b79534-d464-4991-aa67-feb44c762d84'::uuid
])
ON CONFLICT DO NOTHING;