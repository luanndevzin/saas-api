-- +goose Up
CREATE TABLE customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  document VARCHAR(40) NULL, -- CPF/CNPJ opcional
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,

  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_customer_tenant_name (tenant_id, name),
  UNIQUE KEY uq_customer_tenant_document (tenant_id, document),
  UNIQUE KEY uq_customer_tenant_id (tenant_id, id),
  KEY idx_customer_tenant (tenant_id),

  CONSTRAINT fk_customer_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE receivables (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,

  customer_id BIGINT UNSIGNED NOT NULL,
  reference VARCHAR(120) NULL, -- ex: Pedido 123 / NF 999
  description VARCHAR(255) NULL,

  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BRL',

  due_date DATE NOT NULL,
  received_at DATETIME NULL,
  received_method VARCHAR(30) NULL, -- pix, boleto, cash, card, transfer

  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  -- draft, issued, paid, canceled

  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_rec_tenant_id (tenant_id, id),
  KEY idx_rec_tenant (tenant_id),
  KEY idx_rec_tenant_status (tenant_id, status),
  KEY idx_rec_tenant_due (tenant_id, due_date),
  KEY idx_rec_tenant_customer (tenant_id, customer_id),

  CONSTRAINT fk_rec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_rec_customer FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE receivable_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  receivable_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  -- created, issued, paid, canceled
  message VARCHAR(255) NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_re_tenant_rec (tenant_id, receivable_id, created_at),

  CONSTRAINT fk_re_receivable FOREIGN KEY (tenant_id, receivable_id) REFERENCES receivables(tenant_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- +goose Down
DROP TABLE IF EXISTS receivable_events;
DROP TABLE IF EXISTS receivables;
DROP TABLE IF EXISTS customers;
