INSERT INTO saas.admin_users (user_id)
SELECT unnest(ARRAY[
  'f981b1da-0246-4968-918b-c68e12d70085'::uuid,
  '15ed5718-7392-45a8-9d97-003c4871bf99'::uuid,
  'bff6214e-cd82-4be8-86a7-59aef5d08714'::uuid
])
ON CONFLICT DO NOTHING;