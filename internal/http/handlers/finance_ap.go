package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"

	mw "saas-api/internal/http/middleware"
)

type FinanceAPHandler struct {
	DB *sqlx.DB
}

type updatePayableReq struct {
	CostCenterID *uint64 `json:"cost_center_id"`
}

type Vendor struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Document  *string   `db:"document" json:"document,omitempty"`
	Email     *string   `db:"email" json:"email,omitempty"`
	Phone     *string   `db:"phone" json:"phone,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type Payable struct {
	ID           uint64     `db:"id" json:"id"`
	CostCenterID *uint64    `db:"cost_center_id" json:"cost_center_id,omitempty"`
	TenantID     uint64     `db:"tenant_id" json:"tenant_id"`
	VendorID     uint64     `db:"vendor_id" json:"vendor_id"`
	Reference    *string    `db:"reference" json:"reference,omitempty"`
	Description  *string    `db:"description" json:"description,omitempty"`
	AmountCents  int64      `db:"amount_cents" json:"amount_cents"`
	Currency     string     `db:"currency" json:"currency"`
	DueDate      time.Time  `db:"due_date" json:"due_date"`
	PaidAt       *time.Time `db:"paid_at" json:"paid_at,omitempty"`
	Status       string     `db:"status" json:"status"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type PayableEvent struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	PayableID uint64    `db:"payable_id" json:"payable_id"`
	Type      string    `db:"type" json:"type"`
	Message   *string   `db:"message" json:"message,omitempty"`
	UserID    *uint64   `db:"user_id" json:"user_id,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type createVendorReq struct {
	Name     string  `json:"name"`
	Document *string `json:"document"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
}

type createPayableReq struct {
	VendorID    uint64  `json:"vendor_id"`
	Reference   *string `json:"reference"`
	Description *string `json:"description"`
	AmountCents int64   `json:"amount_cents"`
	Currency    *string `json:"currency"`
	DueDate     string  `json:"due_date"` // YYYY-MM-DD
}

type eventReq struct {
	Message *string `json:"message"`
}

func (h *FinanceAPHandler) CreateVendor(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createVendorReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO vendors (tenant_id, name, document, email, phone, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Document), cleanPtrLower(req.Email), cleanPtr(req.Phone), userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create vendor (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var v Vendor
	if err := tx.Get(&v, `SELECT id, tenant_id, name, document, email, phone, created_at, updated_at FROM vendors WHERE tenant_id=? AND id=?`,
		tenantID, id64); err != nil {
		http.Error(w, "db read error", 500)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "vendors", id64, nil, v)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, http.StatusCreated, v)
}

func (h *FinanceAPHandler) ListVendors(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	items := make([]Vendor, 0)

	if err := h.DB.Select(&items, `SELECT id, tenant_id, name, document, email, phone, created_at, updated_at FROM vendors WHERE tenant_id=? ORDER BY name ASC`, tenantID); err != nil {
		http.Error(w, "db error", 500)
		return
	}
	writeJSON(w, 200, items)
}

func (h *FinanceAPHandler) UpdatePayable(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req updatePayableReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var before Payable
	if err := tx.Get(&before, `SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "payable not found", 404)
		return
	}

	if before.Status != "draft" {
		http.Error(w, "only draft payables can be edited", 400)
		return
	}

	// valida CC se veio
	if req.CostCenterID != nil {
		var tmp int
		if err := tx.Get(&tmp, `SELECT 1 FROM cost_centers WHERE tenant_id=? AND id=?`, tenantID, *req.CostCenterID); err != nil {
			http.Error(w, "cost center not found", 400)
			return
		}
	}

	_, err = tx.Exec(`UPDATE payables SET cost_center_id=?, updated_by=? WHERE tenant_id=? AND id=?`,
		req.CostCenterID, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	var after Payable
	_ = tx.Get(&after, `SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "payables", toInt64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}

func (h *FinanceAPHandler) CreatePayable(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createPayableReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.VendorID == 0 {
		http.Error(w, "vendor_id is required", 400)
		return
	}
	if req.AmountCents <= 0 {
		http.Error(w, "amount_cents must be > 0", 400)
		return
	}
	due, err := time.Parse("2006-01-02", strings.TrimSpace(req.DueDate))
	if err != nil {
		http.Error(w, "due_date must be YYYY-MM-DD", 400)
		return
	}

	cur := "BRL"
	if req.Currency != nil && strings.TrimSpace(*req.Currency) != "" {
		cur = strings.ToUpper(strings.TrimSpace(*req.Currency))
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	// garante vendor do mesmo tenant
	var tmp int
	if err := tx.Get(&tmp, `SELECT 1 FROM vendors WHERE tenant_id=? AND id=?`, tenantID, req.VendorID); err != nil {
		http.Error(w, "vendor not found", 400)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO payables (tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, status, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
		tenantID, req.VendorID, cleanPtr(req.Reference), cleanPtr(req.Description),
		req.AmountCents, cur, due, userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create payable", 400)
		return
	}
	id64, _ := res.LastInsertId()

	_, _ = tx.Exec(`INSERT INTO payable_events (tenant_id, payable_id, type, message, user_id) VALUES (?, ?, 'created', NULL, ?)`,
		tenantID, id64, userID,
	)

	var p Payable
	if err := tx.Get(&p, `
		SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", 500)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "payables", id64, nil, p)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 201, p)
}

func (h *FinanceAPHandler) ListPayables(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status != "" {
		ok := map[string]bool{"draft": true, "pending_approval": true, "approved": true, "rejected": true, "paid": true, "canceled": true}
		if !ok[status] {
			http.Error(w, "invalid status filter", 400)
			return
		}
	}

	items := make([]Payable, 0)
	if status == "" {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency,
       due_date, paid_at, status, cost_center_id, created_at, updated_at
FROM payables
WHERE tenant_id=?
ORDER BY id DESC
`, tenantID); err != nil {
			http.Error(w, "db error", 500)
			return
		}
	} else {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
			FROM payables WHERE tenant_id=? AND status=? ORDER BY id DESC`, tenantID, status); err != nil {
			http.Error(w, "db error", 500)
			return
		}
	}
	writeJSON(w, 200, items)
}

func (h *FinanceAPHandler) SubmitPayable(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "draft", "pending_approval", "submitted")
}
func (h *FinanceAPHandler) ApprovePayable(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "pending_approval", "approved", "approved")
}
func (h *FinanceAPHandler) RejectPayable(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "pending_approval", "rejected", "rejected")
}

func (h *FinanceAPHandler) MarkPaid(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req eventReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var p Payable
	if err := tx.Get(&p, `
		SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "payable not found", 404)
		return
	}
	if p.Status != "approved" {
		http.Error(w, "only approved payables can be marked paid", 400)
		return
	}

	now := time.Now().UTC()
	_, err = tx.Exec(`UPDATE payables SET status='paid', paid_at=?, updated_by=? WHERE tenant_id=? AND id=?`, now, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	_, _ = tx.Exec(`INSERT INTO payable_events (tenant_id, payable_id, type, message, user_id) VALUES (?, ?, 'paid', ?, ?)`,
		tenantID, id, cleanPtr(req.Message), userID,
	)

	var after Payable
	_ = tx.Get(&after, `
		SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "payables", toInt64(id), p, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}

func (h *FinanceAPHandler) transition(w http.ResponseWriter, r *http.Request, from, to, eventType string) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req eventReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var before Payable
	if err := tx.Get(&before, `
		SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "payable not found", 404)
		return
	}
	if before.Status != from {
		http.Error(w, "invalid status transition", 400)
		return
	}

	_, err = tx.Exec(`UPDATE payables SET status=?, updated_by=? WHERE tenant_id=? AND id=?`, to, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	_, _ = tx.Exec(`INSERT INTO payable_events (tenant_id, payable_id, type, message, user_id) VALUES (?, ?, ?, ?, ?)`,
		tenantID, id, eventType, cleanPtr(req.Message), userID,
	)

	var after Payable
	_ = tx.Get(&after, `
		SELECT id, tenant_id, vendor_id, reference, description, amount_cents, currency, due_date, paid_at, status, cost_center_id, created_at, updated_at
		FROM payables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "payables", toInt64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}

// func writeJSON(w http.ResponseWriter, status int, v any) {
// 	w.Header().Set("Content-Type", "application/json; charset=utf-8")
// 	w.WriteHeader(status)

// 	enc := json.NewEncoder(w)
// 	enc.SetEscapeHTML(false)
// 	_ = enc.Encode(v)
// }

func (h *FinanceAPHandler) ListPayableEvents(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	id := chi.URLParam(r, "id")

	items := make([]PayableEvent, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, payable_id, type, message, user_id, created_at
		FROM payable_events
		WHERE tenant_id=? AND payable_id=?
		ORDER BY created_at ASC, id ASC
	`, tenantID, id); err != nil {
		http.Error(w, "db error", 500)
		return
	}
	writeJSON(w, 200, items)
}

/* utils */
func cleanPtr(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return &v
}
func cleanPtrLower(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(strings.ToLower(*s))
	if v == "" {
		return nil
	}
	return &v
}
func toInt64(id string) int64 {
	// best-effort: se não converter, fica 0 (audit ainda funciona)
	var n int64
	for _, ch := range id {
		if ch < '0' || ch > '9' {
			return 0
		}
		n = n*10 + int64(ch-'0')
	}
	return n
}
