-- +goose Up
CREATE TABLE cost_centers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NULL,

  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_cc_tenant_name (tenant_id, name),
  UNIQUE KEY uq_cc_tenant_code (tenant_id, code),
  UNIQUE KEY uq_cc_tenant_id (tenant_id, id),
  KEY idx_cc_tenant (tenant_id),

  CONSTRAINT fk_cc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE payables
  ADD COLUMN cost_center_id BIGINT UNSIGNED NULL,
  ADD KEY idx_payable_tenant_cc (tenant_id, cost_center_id),
  ADD CONSTRAINT fk_payable_cc FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers(tenant_id, id);

ALTER TABLE receivables
  ADD COLUMN cost_center_id BIGINT UNSIGNED NULL,
  ADD KEY idx_rec_tenant_cc (tenant_id, cost_center_id),
  ADD CONSTRAINT fk_rec_cc FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers(tenant_id, id);

ALTER TABLE employees
  ADD COLUMN cost_center_id BIGINT UNSIGNED NULL,
  ADD KEY idx_emp_tenant_cc (tenant_id, cost_center_id),
  ADD CONSTRAINT fk_emp_cc FOREIGN KEY (tenant_id, cost_center_id) REFERENCES cost_centers(tenant_id, id);

-- +goose Down
ALTER TABLE employees DROP FOREIGN KEY fk_emp_cc;
ALTER TABLE employees DROP KEY idx_emp_tenant_cc;
ALTER TABLE employees DROP COLUMN cost_center_id;

ALTER TABLE receivables DROP FOREIGN KEY fk_rec_cc;
ALTER TABLE receivables DROP KEY idx_rec_tenant_cc;
ALTER TABLE receivables DROP COLUMN cost_center_id;

ALTER TABLE payables DROP FOREIGN KEY fk_payable_cc;
ALTER TABLE payables DROP KEY idx_payable_tenant_cc;
ALTER TABLE payables DROP COLUMN cost_center_id;

DROP TABLE IF EXISTS cost_centers;
