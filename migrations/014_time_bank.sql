-- +goose Up
CREATE TABLE IF NOT EXISTS hr_time_bank_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  target_daily_minutes INT NOT NULL DEFAULT 480,
  include_saturday BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_hr_time_bank_settings_tenant (tenant_id),
  CONSTRAINT fk_hr_time_bank_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_time_bank_adjustments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  effective_date DATE NOT NULL,
  seconds_delta BIGINT NOT NULL,
  reason VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_hr_time_bank_adj_tenant_date (tenant_id, effective_date),
  KEY idx_hr_time_bank_adj_tenant_employee (tenant_id, employee_id, effective_date),
  CONSTRAINT fk_hr_time_bank_adj_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_hr_time_bank_adj_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_time_bank_closures (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'closed',
  note VARCHAR(255) NULL,
  closed_at DATETIME NULL,
  closed_by BIGINT UNSIGNED NULL,
  reopened_at DATETIME NULL,
  reopened_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_hr_time_bank_closure_period (tenant_id, period_start, period_end),
  KEY idx_hr_time_bank_closure_tenant_status (tenant_id, status, period_end),
  CONSTRAINT fk_hr_time_bank_closure_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_time_bank_closure_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  closure_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  worked_seconds BIGINT NOT NULL DEFAULT 0,
  expected_seconds BIGINT NOT NULL DEFAULT 0,
  adjustment_seconds BIGINT NOT NULL DEFAULT 0,
  balance_seconds BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_hr_time_bank_closure_item (tenant_id, closure_id, employee_id),
  KEY idx_hr_time_bank_closure_item_tenant (tenant_id, closure_id),
  CONSTRAINT fk_hr_time_bank_closure_item_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_hr_time_bank_closure_item_closure FOREIGN KEY (closure_id) REFERENCES hr_time_bank_closures(id),
  CONSTRAINT fk_hr_time_bank_closure_item_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS hr_time_bank_closure_items;
DROP TABLE IF EXISTS hr_time_bank_closures;
DROP TABLE IF EXISTS hr_time_bank_adjustments;
DROP TABLE IF EXISTS hr_time_bank_settings;
