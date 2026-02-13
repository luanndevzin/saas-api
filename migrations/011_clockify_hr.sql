-- +goose Up
CREATE TABLE IF NOT EXISTS hr_clockify_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  workspace_id VARCHAR(120) NOT NULL,
  api_key VARCHAR(255) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_clockify_conn_tenant (tenant_id),
  CONSTRAINT fk_clockify_conn_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_clockify_user_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  clockify_user_id VARCHAR(120) NOT NULL,
  clockify_user_name VARCHAR(200) NULL,
  clockify_user_email VARCHAR(255) NULL,
  last_synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_clockify_user_link_tenant_employee (tenant_id, employee_id),
  UNIQUE KEY uq_clockify_user_link_tenant_clockify (tenant_id, clockify_user_id),
  KEY idx_clockify_user_link_tenant (tenant_id),

  CONSTRAINT fk_clockify_user_link_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_clockify_user_link_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hr_time_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'clockify',
  external_entry_id VARCHAR(120) NOT NULL,
  clockify_user_id VARCHAR(120) NOT NULL,
  workspace_id VARCHAR(120) NOT NULL,
  project_id VARCHAR(120) NULL,
  task_id VARCHAR(120) NULL,
  description VARCHAR(500) NULL,
  tag_ids_json JSON NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,
  duration_seconds BIGINT NOT NULL DEFAULT 0,
  is_running BOOLEAN NOT NULL DEFAULT FALSE,
  billable BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSON NULL,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_hr_time_entry_tenant_source_external (tenant_id, source, external_entry_id),
  KEY idx_hr_time_entry_tenant_start (tenant_id, start_at),
  KEY idx_hr_time_entry_tenant_employee_start (tenant_id, employee_id, start_at),
  KEY idx_hr_time_entry_tenant_clockify_user (tenant_id, clockify_user_id),

  CONSTRAINT fk_hr_time_entry_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_hr_time_entry_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS hr_time_entries;
DROP TABLE IF EXISTS hr_clockify_user_links;
DROP TABLE IF EXISTS hr_clockify_connections;
