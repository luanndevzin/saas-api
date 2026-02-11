-- +goose Up
ALTER TABLE face_templates
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER phash,
  ADD COLUMN updated_by BIGINT UNSIGNED NULL AFTER created_by;

-- +goose Down
ALTER TABLE face_templates
  DROP COLUMN updated_by,
  DROP COLUMN created_by;
