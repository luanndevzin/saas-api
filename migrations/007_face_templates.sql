-- +goose Up
CREATE TABLE face_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NOT NULL,
  phash BIGINT NOT NULL,
  image LONGBLOB NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_face_tenant_employee (tenant_id, employee_id),
  KEY idx_face_tenant (tenant_id),

  CONSTRAINT fk_face_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_face_employee FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS face_templates;
