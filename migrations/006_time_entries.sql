-- +goose Up
CREATE TABLE time_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,

  clock_in DATETIME NOT NULL,
  clock_out DATETIME NULL,
  note_in VARCHAR(255) NULL,
  note_out VARCHAR(255) NULL,

  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_te_tenant (tenant_id),
  KEY idx_te_tenant_employee (tenant_id, employee_id),
  KEY idx_te_tenant_clock (tenant_id, clock_in),
  KEY idx_te_tenant_open (tenant_id, employee_id, clock_out),

  CONSTRAINT fk_te_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_te_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS time_entries;
