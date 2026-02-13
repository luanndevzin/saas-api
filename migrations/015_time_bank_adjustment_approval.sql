-- +goose Up
SET @has_status_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'status'
);
SET @sql := IF(
  @has_status_col = 0,
  'ALTER TABLE hr_time_bank_adjustments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT ''approved'' AFTER seconds_delta',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_review_note_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'review_note'
);
SET @sql := IF(
  @has_review_note_col = 0,
  'ALTER TABLE hr_time_bank_adjustments ADD COLUMN review_note VARCHAR(255) NULL AFTER reason',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reviewed_by_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'reviewed_by'
);
SET @sql := IF(
  @has_reviewed_by_col = 0,
  'ALTER TABLE hr_time_bank_adjustments ADD COLUMN reviewed_by BIGINT UNSIGNED NULL AFTER created_by',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reviewed_at_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'reviewed_at'
);
SET @sql := IF(
  @has_reviewed_at_col = 0,
  'ALTER TABLE hr_time_bank_adjustments ADD COLUMN reviewed_at DATETIME NULL AFTER reviewed_by',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_status_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND INDEX_NAME = 'idx_hr_time_bank_adj_tenant_status'
);
SET @sql := IF(
  @has_status_idx = 0,
  'ALTER TABLE hr_time_bank_adjustments ADD KEY idx_hr_time_bank_adj_tenant_status (tenant_id, status, effective_date)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE hr_time_bank_adjustments
SET status = 'approved'
WHERE status IS NULL OR TRIM(status) = '';

-- +goose Down
SET @has_status_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND INDEX_NAME = 'idx_hr_time_bank_adj_tenant_status'
);
SET @sql := IF(
  @has_status_idx = 1,
  'ALTER TABLE hr_time_bank_adjustments DROP INDEX idx_hr_time_bank_adj_tenant_status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reviewed_at_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'reviewed_at'
);
SET @sql := IF(
  @has_reviewed_at_col = 1,
  'ALTER TABLE hr_time_bank_adjustments DROP COLUMN reviewed_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_reviewed_by_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'reviewed_by'
);
SET @sql := IF(
  @has_reviewed_by_col = 1,
  'ALTER TABLE hr_time_bank_adjustments DROP COLUMN reviewed_by',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_review_note_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'review_note'
);
SET @sql := IF(
  @has_review_note_col = 1,
  'ALTER TABLE hr_time_bank_adjustments DROP COLUMN review_note',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_status_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'hr_time_bank_adjustments'
    AND COLUMN_NAME = 'status'
);
SET @sql := IF(
  @has_status_col = 1,
  'ALTER TABLE hr_time_bank_adjustments DROP COLUMN status',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
