-- +goose Up
ALTER TABLE memberships
  MODIFY role VARCHAR(50) NOT NULL DEFAULT 'colaborador';

UPDATE memberships
SET role = 'colaborador'
WHERE role = 'member';

-- +goose Down
UPDATE memberships
SET role = 'member'
WHERE role = 'colaborador';

ALTER TABLE memberships
  MODIFY role VARCHAR(50) NOT NULL DEFAULT 'member';

