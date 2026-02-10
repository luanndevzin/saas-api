package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	mw "saas-api/internal/http/middleware"
)

type CostCenterHandler struct {
	DB *sqlx.DB
}

type CostCenter struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Code      *string   `db:"code" json:"code,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type createCostCenterReq struct {
	Name string  `json:"name"`
	Code *string `json:"code"`
}

func (h *CostCenterHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createCostCenterReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400); return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" { http.Error(w, "name is required", 400); return }

	tx, err := h.DB.Beginx()
	if err != nil { http.Error(w, "db error", 500); return }
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO cost_centers (tenant_id, name, code, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Code), userID, userID,
	)
	if err != nil { http.Error(w, "could not create cost center (name/code may exist)", 400); return }
	id64, _ := res.LastInsertId()

	var cc CostCenter
	if err := tx.Get(&cc, `SELECT id, tenant_id, name, code, created_at, updated_at FROM cost_centers WHERE tenant_id=? AND id=?`,
		tenantID, id64); err != nil {
		http.Error(w, "db read error", 500); return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "cost_centers", id64, nil, cc)

	if err := tx.Commit(); err != nil { http.Error(w, "db commit error", 500); return }
	writeJSON(w, 201, cc)
}

func (h *CostCenterHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	items := make([]CostCenter, 0)

	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, name, code, created_at, updated_at
		FROM cost_centers WHERE tenant_id=? ORDER BY name ASC`, tenantID); err != nil {
		http.Error(w, "db error", 500); return
	}

	writeJSON(w, 200, items)
}
