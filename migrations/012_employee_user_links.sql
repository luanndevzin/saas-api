-- +goose Up
CREATE TABLE IF NOT EXISTS hr_employee_user_links (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  linked_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_hr_emp_user_tenant_employee (tenant_id, employee_id),
  UNIQUE KEY uq_hr_emp_user_tenant_user (tenant_id, user_id),
  KEY idx_hr_emp_user_tenant (tenant_id),

  CONSTRAINT fk_hr_emp_user_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_hr_emp_user_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id),
  CONSTRAINT fk_hr_emp_user_membership FOREIGN KEY (tenant_id, user_id) REFERENCES memberships(tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS hr_employee_user_links;

