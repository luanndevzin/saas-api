-- +goose Up
SET @has_manager_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'manager_id'
);
SET @sql := IF(
  @has_manager_col = 0,
  'ALTER TABLE employees ADD COLUMN manager_id BIGINT UNSIGNED NULL AFTER position_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_manager_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND INDEX_NAME = 'idx_emp_tenant_manager'
);
SET @sql := IF(
  @has_manager_idx = 0,
  'ALTER TABLE employees ADD KEY idx_emp_tenant_manager (tenant_id, manager_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_manager_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND CONSTRAINT_NAME = 'fk_emp_manager'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @has_manager_fk = 0,
  'ALTER TABLE employees ADD CONSTRAINT fk_emp_manager FOREIGN KEY (tenant_id, manager_id) REFERENCES employees(tenant_id, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS employee_compensations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  effective_at DATE NOT NULL,
  salary_cents BIGINT NOT NULL,
  adjustment_type VARCHAR(50) NULL,
  note VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_ec_tenant_id (tenant_id, id),
  KEY idx_ec_tenant_employee (tenant_id, employee_id, effective_at),

  CONSTRAINT fk_ec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ec_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NULL,
  kind VARCHAR(50) NULL,
  country VARCHAR(80) NULL,
  state VARCHAR(80) NULL,
  city VARCHAR(80) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_loc_tenant_name (tenant_id, name),
  UNIQUE KEY uq_loc_tenant_code (tenant_id, code),
  KEY idx_loc_tenant (tenant_id),

  CONSTRAINT fk_loc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_loc_uq_tenant_id := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'locations'
    AND INDEX_NAME = 'uq_loc_tenant_id'
);
SET @sql := IF(
  @has_loc_uq_tenant_id = 0,
  'ALTER TABLE locations ADD UNIQUE KEY uq_loc_tenant_id (tenant_id, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS teams (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  manager_employee_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_team_tenant_name (tenant_id, name),
  KEY idx_team_tenant (tenant_id),
  KEY idx_team_department (tenant_id, department_id),
  KEY idx_team_manager (tenant_id, manager_employee_id),

  CONSTRAINT fk_team_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_team_dept FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id),
  CONSTRAINT fk_team_manager FOREIGN KEY (tenant_id, manager_employee_id) REFERENCES employees(tenant_id, id),
  CONSTRAINT fk_team_location FOREIGN KEY (tenant_id, location_id) REFERENCES locations(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS time_off_types (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tot_tenant_name (tenant_id, name),
  KEY idx_tot_tenant (tenant_id),

  CONSTRAINT fk_tot_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_tot_uq_tenant_id := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'time_off_types'
    AND INDEX_NAME = 'uq_tot_tenant_id'
);
SET @sql := IF(
  @has_tot_uq_tenant_id = 0,
  'ALTER TABLE time_off_types ADD UNIQUE KEY uq_tot_tenant_id (tenant_id, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS time_off_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  type_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255) NULL,
  decision_note VARCHAR(255) NULL,
  approver_id BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tor_tenant_id (tenant_id, id),
  KEY idx_tor_tenant (tenant_id),
  KEY idx_tor_status (tenant_id, status),
  KEY idx_tor_employee (tenant_id, employee_id),

  CONSTRAINT fk_tor_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_tor_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id),
  CONSTRAINT fk_tor_type FOREIGN KEY (tenant_id, type_id) REFERENCES time_off_types(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS benefits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  provider VARCHAR(200) NULL,
  cost_cents BIGINT NOT NULL DEFAULT 0,
  coverage_level VARCHAR(120) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_benefit_tenant_name (tenant_id, name),
  KEY idx_benefit_tenant (tenant_id),

  CONSTRAINT fk_benefit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has_benefit_uq_tenant_id := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'benefits'
    AND INDEX_NAME = 'uq_benefit_tenant_id'
);
SET @sql := IF(
  @has_benefit_uq_tenant_id = 0,
  'ALTER TABLE benefits ADD UNIQUE KEY uq_benefit_tenant_id (tenant_id, id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS employee_benefits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  benefit_id BIGINT UNSIGNED NOT NULL,
  effective_date DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_eb_tenant_emp_benefit (tenant_id, employee_id, benefit_id),
  KEY idx_eb_tenant (tenant_id),

  CONSTRAINT fk_eb_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_eb_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id),
  CONSTRAINT fk_eb_benefit FOREIGN KEY (tenant_id, benefit_id) REFERENCES benefits(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS employee_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  doc_type VARCHAR(120) NOT NULL,
  file_name VARCHAR(255) NULL,
  file_url VARCHAR(500) NOT NULL,
  expires_at DATE NULL,
  note VARCHAR(255) NULL,
  uploaded_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_ed_tenant (tenant_id),
  KEY idx_ed_tenant_employee (tenant_id, employee_id),
  KEY idx_ed_expires (tenant_id, expires_at),

  CONSTRAINT fk_ed_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ed_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS employee_documents;
DROP TABLE IF EXISTS employee_benefits;
DROP TABLE IF EXISTS benefits;
DROP TABLE IF EXISTS time_off_requests;
DROP TABLE IF EXISTS time_off_types;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS employee_compensations;
SET @has_manager_fk := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND CONSTRAINT_NAME = 'fk_emp_manager'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql := IF(
  @has_manager_fk = 1,
  'ALTER TABLE employees DROP FOREIGN KEY fk_emp_manager',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_manager_idx := (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND INDEX_NAME = 'idx_emp_tenant_manager'
);
SET @sql := IF(
  @has_manager_idx = 1,
  'ALTER TABLE employees DROP INDEX idx_emp_tenant_manager',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_manager_col := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'employees'
    AND COLUMN_NAME = 'manager_id'
);
SET @sql := IF(
  @has_manager_col = 1,
  'ALTER TABLE employees DROP COLUMN manager_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
