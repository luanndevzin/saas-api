package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	mw "saas-api/internal/http/middleware"
)

func (h *HRHandler) CreateBenefit(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createBenefitReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpError(w, "name is required", http.StatusBadRequest)
		return
	}
	cost := int64(0)
	if req.CostCents != nil {
		if *req.CostCents < 0 {
			httpError(w, "cost_cents must be >= 0", http.StatusBadRequest)
			return
		}
		cost = *req.CostCents
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO benefits (tenant_id, name, provider, cost_cents, coverage_level, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Provider), cost, cleanPtr(req.CoverageLevel), userID, userID)
	if err != nil {
		httpError(w, "could not create benefit (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var b Benefit
	_ = tx.Get(&b, `
		SELECT id, tenant_id, name, provider, cost_cents, coverage_level, created_at, updated_at
		FROM benefits WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "benefits", id64, nil, b)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, b)
}

func (h *HRHandler) ListBenefits(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	items := make([]Benefit, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, name, provider, cost_cents, coverage_level, created_at, updated_at
		FROM benefits WHERE tenant_id=?
		ORDER BY name ASC`, tenantID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) AssignBenefitToEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req employeeBenefitReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	var effDate *time.Time
	if req.EffectiveDate != nil && strings.TrimSpace(*req.EffectiveDate) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.EffectiveDate))
		if err != nil {
			httpError(w, "effective_date must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		effDate = &t
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// ensure employee and benefit exist
	var exists int
	if err := tx.Get(&exists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, empID); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}
	if err := tx.Get(&exists, `SELECT 1 FROM benefits WHERE tenant_id=? AND id=?`, tenantID, req.BenefitID); err != nil {
		httpError(w, "benefit not found", http.StatusNotFound)
		return
	}

	if _, err := tx.Exec(`
		INSERT INTO employee_benefits (tenant_id, employee_id, benefit_id, effective_date, created_by)
		VALUES (?, ?, ?, ?, ?)`,
		tenantID, empID, req.BenefitID, effDate, userID); err != nil {
		httpError(w, "could not assign benefit (maybe already assigned)", http.StatusBadRequest)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "employee_benefits", 0, nil, map[string]any{
		"employee_id": empID,
		"benefit_id":  req.BenefitID,
		"effective":   effDate,
	})

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *HRHandler) RemoveBenefitFromEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}
	benefitID, err := strconv.ParseUint(chi.URLParam(r, "benefit_id"), 10, 64)
	if err != nil {
		httpError(w, "invalid benefit id", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		DELETE FROM employee_benefits WHERE tenant_id=? AND employee_id=? AND benefit_id=?`,
		tenantID, empID, benefitID)
	if err != nil {
		httpError(w, "db delete error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		httpError(w, "relation not found", http.StatusNotFound)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "delete", "employee_benefits", 0, map[string]any{
		"employee_id": empID,
		"benefit_id":  benefitID,
	}, nil)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HRHandler) ListEmployeeBenefits(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	items := make([]EmployeeBenefit, 0)
	if err := h.DB.Select(&items, `
		SELECT eb.benefit_id, eb.employee_id, eb.effective_date,
		       b.name, b.provider, b.coverage_level, b.cost_cents
		FROM employee_benefits eb
		JOIN benefits b ON b.tenant_id=eb.tenant_id AND b.id=eb.benefit_id
		WHERE eb.tenant_id=? AND eb.employee_id=?
		ORDER BY eb.effective_date IS NULL, eb.effective_date ASC, b.name ASC`, tenantID, empID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateEmployeeDocument(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req createEmployeeDocumentReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.DocType = strings.TrimSpace(req.DocType)
	if req.DocType == "" {
		httpError(w, "doc_type is required", http.StatusBadRequest)
		return
	}
	req.FileURL = strings.TrimSpace(req.FileURL)
	if req.FileURL == "" {
		httpError(w, "file_url is required", http.StatusBadRequest)
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && strings.TrimSpace(*req.ExpiresAt) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.ExpiresAt))
		if err != nil {
			httpError(w, "expires_at must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		expiresAt = &t
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var exists int
	if err := tx.Get(&exists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, empID); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO employee_documents (tenant_id, employee_id, doc_type, file_name, file_url, expires_at, note, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empID, req.DocType, cleanPtr(req.FileName), req.FileURL, expiresAt, cleanPtr(req.Note), userID)
	if err != nil {
		httpError(w, "could not create document", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var doc EmployeeDocument
	_ = tx.Get(&doc, `
		SELECT id, tenant_id, employee_id, doc_type, file_name, file_url, expires_at, note, uploaded_by, created_at
		FROM employee_documents WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "employee_documents", id64, nil, doc)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, doc)
}

func (h *HRHandler) ListEmployeeDocuments(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	items := make([]EmployeeDocument, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, employee_id, doc_type, file_name, file_url, expires_at, note, uploaded_by, created_at
		FROM employee_documents
		WHERE tenant_id=? AND employee_id=?
		ORDER BY created_at DESC, id DESC`, tenantID, empID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

/* ---------------- helpers ---------------- */
