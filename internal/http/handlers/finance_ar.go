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

type FinanceARHandler struct {
	DB *sqlx.DB
}

type Customer struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Document  *string   `db:"document" json:"document,omitempty"`
	Email     *string   `db:"email" json:"email,omitempty"`
	Phone     *string   `db:"phone" json:"phone,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type Receivable struct {
	ID             uint64     `db:"id" json:"id"`
	TenantID       uint64     `db:"tenant_id" json:"tenant_id"`
	CostCenterID   *uint64    `db:"cost_center_id" json:"cost_center_id,omitempty"`
	CustomerID     uint64     `db:"customer_id" json:"customer_id"`
	Reference      *string    `db:"reference" json:"reference,omitempty"`
	Description    *string    `db:"description" json:"description,omitempty"`
	AmountCents    int64      `db:"amount_cents" json:"amount_cents"`
	Currency       string     `db:"currency" json:"currency"`
	DueDate        time.Time  `db:"due_date" json:"due_date"`
	ReceivedAt     *time.Time `db:"received_at" json:"received_at,omitempty"`
	ReceivedMethod *string    `db:"received_method" json:"received_method,omitempty"`
	Status         string     `db:"status" json:"status"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time  `db:"updated_at" json:"updated_at"`
}

type ReceivableEvent struct {
	ID           uint64    `db:"id" json:"id"`
	TenantID     uint64    `db:"tenant_id" json:"tenant_id"`
	ReceivableID uint64    `db:"receivable_id" json:"receivable_id"`
	Type         string    `db:"type" json:"type"`
	Message      *string   `db:"message" json:"message,omitempty"`
	UserID       *uint64   `db:"user_id" json:"user_id,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

type createCustomerReq struct {
	Name     string  `json:"name"`
	Document *string `json:"document"`
	Email    *string `json:"email"`
	Phone    *string `json:"phone"`
}

type createReceivableReq struct {
	CustomerID  uint64  `json:"customer_id"`
	Reference   *string `json:"reference"`
	Description *string `json:"description"`
	AmountCents int64   `json:"amount_cents"`
	Currency    *string `json:"currency"`
	DueDate     string  `json:"due_date"` // YYYY-MM-DD
}

type arEventReq struct {
	Message *string `json:"message"`
	Method  *string `json:"method"` // usado em mark-received (pix/boleto/etc)
}

type updateReceivableReq struct {
	CostCenterID *uint64 `json:"cost_center_id"`
}

func (h *FinanceARHandler) UpdateReceivable(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req updateReceivableReq
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

	var before Receivable
	if err := tx.Get(&before, `SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "receivable not found", 404)
		return
	}
	if before.Status != "draft" {
		http.Error(w, "only draft receivables can be edited", 400)
		return
	}

	if req.CostCenterID != nil {
		var tmp int
		if err := tx.Get(&tmp, `SELECT 1 FROM cost_centers WHERE tenant_id=? AND id=?`, tenantID, *req.CostCenterID); err != nil {
			http.Error(w, "cost center not found", 400)
			return
		}
	}

	_, err = tx.Exec(`UPDATE receivables SET cost_center_id=?, updated_by=? WHERE tenant_id=? AND id=?`,
		req.CostCenterID, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	var after Receivable
	_ = tx.Get(&after, `SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "receivables", toInt64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}

func (h *FinanceARHandler) CreateCustomer(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createCustomerReq
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
		INSERT INTO customers (tenant_id, name, document, email, phone, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Document), cleanPtrLower(req.Email), cleanPtr(req.Phone), userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create customer (name/document may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var c Customer
	if err := tx.Get(&c, `SELECT id, tenant_id, name, document, email, phone, created_at, updated_at FROM customers WHERE tenant_id=? AND id=?`,
		tenantID, id64); err != nil {
		http.Error(w, "db read error", 500)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "customers", id64, nil, c)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, http.StatusCreated, c)
}

func (h *FinanceARHandler) ListCustomers(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	items := make([]Customer, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, name, document, email, phone, created_at, updated_at
		FROM customers WHERE tenant_id=? ORDER BY name ASC`, tenantID); err != nil {
		http.Error(w, "db error", 500)
		return
	}
	writeJSON(w, 200, items)
}

func (h *FinanceARHandler) CreateReceivable(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createReceivableReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.CustomerID == 0 {
		http.Error(w, "customer_id is required", 400)
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

	// garante customer do mesmo tenant
	var tmp int
	if err := tx.Get(&tmp, `SELECT 1 FROM customers WHERE tenant_id=? AND id=?`, tenantID, req.CustomerID); err != nil {
		http.Error(w, "customer not found", 400)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO receivables (tenant_id, customer_id, reference, description, amount_cents, currency, due_date, status, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
		tenantID, req.CustomerID, cleanPtr(req.Reference), cleanPtr(req.Description),
		req.AmountCents, cur, due, userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create receivable", 400)
		return
	}
	id64, _ := res.LastInsertId()

	_, _ = tx.Exec(`INSERT INTO receivable_events (tenant_id, receivable_id, type, message, user_id)
	                VALUES (?, ?, 'created', NULL, ?)`, tenantID, id64, userID)

	var rec Receivable
	if err := tx.Get(&rec, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", 500)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "receivables", id64, nil, rec)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 201, rec)
}

func (h *FinanceARHandler) ListReceivables(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status != "" {
		ok := map[string]bool{"draft": true, "issued": true, "paid": true, "canceled": true}
		if !ok[status] {
			http.Error(w, "invalid status filter", 400)
			return
		}
	}

	items := make([]Receivable, 0)
	if status == "" {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
			FROM receivables WHERE tenant_id=? ORDER BY id DESC`, tenantID); err != nil {
			http.Error(w, "db error", 500)
			return
		}
	} else {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
			FROM receivables WHERE tenant_id=? AND status=? ORDER BY id DESC`, tenantID, status); err != nil {
			http.Error(w, "db error", 500)
			return
		}
	}
	writeJSON(w, 200, items)
}

func (h *FinanceARHandler) IssueReceivable(w http.ResponseWriter, r *http.Request) {
	h.transition(w, r, "draft", "issued", "issued", false)
}

func (h *FinanceARHandler) CancelReceivable(w http.ResponseWriter, r *http.Request) {
	// permite cancelar draft ou issued
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req arEventReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var before Receivable
	if err := tx.Get(&before, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "receivable not found", 404)
		return
	}
	if before.Status != "draft" && before.Status != "issued" {
		http.Error(w, "only draft or issued can be canceled", 400)
		return
	}

	_, err = tx.Exec(`UPDATE receivables SET status='canceled', updated_by=? WHERE tenant_id=? AND id=?`, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	_, _ = tx.Exec(`INSERT INTO receivable_events (tenant_id, receivable_id, type, message, user_id)
	                VALUES (?, ?, 'canceled', ?, ?)`, tenantID, id, cleanPtr(req.Message), userID)

	var after Receivable
	_ = tx.Get(&after, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "receivables", toInt64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}

func (h *FinanceARHandler) MarkReceived(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req arEventReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var before Receivable
	if err := tx.Get(&before, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "receivable not found", 404)
		return
	}
	if before.Status != "issued" {
		http.Error(w, "only issued receivables can be marked received", 400)
		return
	}

	now := time.Now().UTC()
	method := cleanPtr(req.Method)

	_, err = tx.Exec(`UPDATE receivables SET status='paid', received_at=?, received_method=?, updated_by=? WHERE tenant_id=? AND id=?`,
		now, method, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	_, _ = tx.Exec(`INSERT INTO receivable_events (tenant_id, receivable_id, type, message, user_id)
	                VALUES (?, ?, 'paid', ?, ?)`, tenantID, id, cleanPtr(req.Message), userID)

	var after Receivable
	_ = tx.Get(&after, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "receivables", toInt64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}

func (h *FinanceARHandler) ListReceivableEvents(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	id := chi.URLParam(r, "id")

	items := make([]ReceivableEvent, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, receivable_id, type, message, user_id, created_at
		FROM receivable_events
		WHERE tenant_id=? AND receivable_id=?
		ORDER BY created_at ASC, id ASC
	`, tenantID, id); err != nil {
		http.Error(w, "db error", 500)
		return
	}
	writeJSON(w, 200, items)
}

func (h *FinanceARHandler) transition(w http.ResponseWriter, r *http.Request, from, to, eventType string, withMethod bool) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	id := chi.URLParam(r, "id")

	var req arEventReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	defer tx.Rollback()

	var before Receivable
	if err := tx.Get(&before, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "receivable not found", 404)
		return
	}
	if before.Status != from {
		http.Error(w, "invalid status transition", 400)
		return
	}

	_, err = tx.Exec(`UPDATE receivables SET status=?, updated_by=? WHERE tenant_id=? AND id=?`, to, userID, tenantID, id)
	if err != nil {
		http.Error(w, "db update error", 500)
		return
	}

	_, _ = tx.Exec(`INSERT INTO receivable_events (tenant_id, receivable_id, type, message, user_id)
	                VALUES (?, ?, ?, ?, ?)`, tenantID, id, eventType, cleanPtr(req.Message), userID)

	var after Receivable
	_ = tx.Get(&after, `
		SELECT id, tenant_id, customer_id, reference, description, amount_cents, currency, due_date, received_at, received_method, status, cost_center_id, created_at, updated_at
		FROM receivables WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "receivables", toInt64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", 500)
		return
	}
	writeJSON(w, 200, after)
}
