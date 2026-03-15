
-- Rattacher le RDV au bon client et le marquer comme R2
UPDATE rdv SET 
  client_id = '642f984b-8c7f-4b85-acba-9c7ff9327175',
  is_r2 = true,
  status = 'nouveau',
  parent_rdv_id = 'b051aa7b-f62f-4229-bf55-297a76e2e275',
  needs_reconfirmation = true,
  etude_id = 'b02de334-1d9e-409a-92af-9e058b28a78b'
WHERE id = '4f27ed77-88ed-4903-9415-e6111391bc41';

-- Supprimer le client doublon créé par erreur
DELETE FROM clients WHERE id = '2c05c637-de99-4c56-b684-dd78fe4d7250';
