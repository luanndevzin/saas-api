-- +goose Up
CREATE TABLE departments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_dept_tenant_name (tenant_id, name),
  UNIQUE KEY uq_dept_tenant_code (tenant_id, code),
  UNIQUE KEY uq_dept_tenant_id (tenant_id, id),
  KEY idx_dept_tenant (tenant_id),

  CONSTRAINT fk_dept_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  department_id BIGINT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  level VARCHAR(50) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_pos_tenant_title (tenant_id, title),
  UNIQUE KEY uq_pos_tenant_id (tenant_id, id),
  KEY idx_pos_tenant (tenant_id),
  KEY idx_pos_tenant_dept (tenant_id, department_id),

  CONSTRAINT fk_pos_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_pos_dept FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  employee_code VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active', -- active, inactive, terminated
  hire_date DATE NULL,
  termination_date DATE NULL,

  department_id BIGINT UNSIGNED NULL,
  position_id BIGINT UNSIGNED NULL,

  salary_cents BIGINT NOT NULL DEFAULT 0,

  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_emp_tenant_code (tenant_id, employee_code),
  UNIQUE KEY uq_emp_tenant_id (tenant_id, id),
  KEY idx_emp_tenant (tenant_id),
  KEY idx_emp_tenant_status (tenant_id, status),
  KEY idx_emp_tenant_dept (tenant_id, department_id),
  KEY idx_emp_tenant_pos (tenant_id, position_id),

  CONSTRAINT fk_emp_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_emp_dept FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id),
  CONSTRAINT fk_emp_pos FOREIGN KEY (tenant_id, position_id) REFERENCES positions(tenant_id, id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS departments;
