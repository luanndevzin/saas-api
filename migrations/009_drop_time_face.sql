-- +goose Up
DROP TABLE IF EXISTS face_templates;
DROP TABLE IF EXISTS time_entries;

-- +goose Down
-- As tabelas foram removidas; recriação não suportada automaticamente.
