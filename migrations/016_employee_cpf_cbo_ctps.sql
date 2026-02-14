-- +goose Up
SET @has_emp_cpf_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'cpf'
);
SET @sql := IF(
  @has_emp_cpf_col = 0,
  'ALTER TABLE employees ADD COLUMN cpf VARCHAR(24) NULL AFTER email',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_emp_cbo_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'cbo'
);
SET @sql := IF(
  @has_emp_cbo_col = 0,
  'ALTER TABLE employees ADD COLUMN cbo VARCHAR(24) NULL AFTER cpf',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_emp_ctps_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'ctps'
);
SET @sql := IF(
  @has_emp_ctps_col = 0,
  'ALTER TABLE employees ADD COLUMN ctps VARCHAR(40) NULL AFTER cbo',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- +goose Down
SET @has_emp_ctps_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'ctps'
);
SET @sql := IF(
  @has_emp_ctps_col = 1,
  'ALTER TABLE employees DROP COLUMN ctps',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_emp_cbo_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'cbo'
);
SET @sql := IF(
  @has_emp_cbo_col = 1,
  'ALTER TABLE employees DROP COLUMN cbo',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_emp_cpf_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'cpf'
);
SET @sql := IF(
  @has_emp_cpf_col = 1,
  'ALTER TABLE employees DROP COLUMN cpf',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
