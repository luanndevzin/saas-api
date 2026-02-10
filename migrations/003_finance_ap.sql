-- +goose Up
CREATE TABLE vendors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  document VARCHAR(40) NULL, -- CNPJ/CPF opcional
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_vendor_tenant_name (tenant_id, name),
  UNIQUE KEY uq_vendor_tenant_id (tenant_id, id),
  KEY idx_vendor_tenant (tenant_id),

  CONSTRAINT fk_vendor_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payables (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,

  vendor_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(120) NULL, -- ex: NF 1234
  description VARCHAR(255) NULL,

  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',

  due_date DATE NOT NULL,
  paid_at DATETIME NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- draft, pending_approval, approved, rejected, paid, canceled

  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_payable_tenant_id (tenant_id, id),
  KEY idx_payable_tenant (tenant_id),
  KEY idx_payable_tenant_status (tenant_id, status),
  KEY idx_payable_tenant_due (tenant_id, due_date),
  KEY idx_payable_tenant_vendor (tenant_id, vendor_id),

  CONSTRAINT fk_payable_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_payable_vendor FOREIGN KEY (tenant_id, vendor_id) REFERENCES vendors(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE payable_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  payable_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  -- created, submitted, approved, rejected, paid, canceled
  message VARCHAR(255) NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_pe_tenant_payable (tenant_id, payable_id, created_at),

  CONSTRAINT fk_pe_payable FOREIGN KEY (tenant_id, payable_id) REFERENCES payables(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS payable_events;
DROP TABLE IF EXISTS payables;
DROP TABLE IF EXISTS vendors;
