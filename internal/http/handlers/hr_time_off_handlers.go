package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	mw "saas-api/internal/http/middleware"
)

func (h *HRHandler) CreateTimeOffType(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTimeOffTypeReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpError(w, "name is required", http.StatusBadRequest)
		return
	}
	requires := true
	if req.RequiresApproval != nil {
		requires = *req.RequiresApproval
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO time_off_types (tenant_id, name, description, requires_approval, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Description), requires, userID, userID)
	if err != nil {
		httpError(w, "could not create time off type (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var item TimeOffType
	_ = tx.Get(&item, `
		SELECT id, tenant_id, name, description, requires_approval, created_at, updated_at
		FROM time_off_types WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "time_off_types", id64, nil, item)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, item)
}

func (h *HRHandler) ListTimeOffTypes(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	items := make([]TimeOffType, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, name, description, requires_approval, created_at, updated_at
		FROM time_off_types WHERE tenant_id=?
		ORDER BY name ASC`, tenantID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTimeOffRequestReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	start, err := time.Parse("2006-01-02", strings.TrimSpace(req.StartDate))
	if err != nil {
		httpError(w, "start_date must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	end, err := time.Parse("2006-01-02", strings.TrimSpace(req.EndDate))
	if err != nil {
		httpError(w, "end_date must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if end.Before(start) {
		httpError(w, "end_date must be >= start_date", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var empExists int
	if err := tx.Get(&empExists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, req.EmployeeID); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}
	var typeExists int
	if err := tx.Get(&typeExists, `SELECT 1 FROM time_off_types WHERE tenant_id=? AND id=?`, tenantID, req.TypeID); err != nil {
		httpError(w, "time_off_type not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO time_off_requests (tenant_id, employee_id, type_id, status, start_date, end_date, reason, created_by, updated_by)
		VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
		tenantID, req.EmployeeID, req.TypeID, start, end, cleanPtr(req.Reason), userID, userID)
	if err != nil {
		httpError(w, "could not create time off request", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var item TimeOffRequest
	_ = tx.Get(&item, `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "time_off_requests", id64, nil, item)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (h *HRHandler) ListTimeOffRequests(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status != "" && status != "pending" && status != "approved" && status != "rejected" && status != "canceled" {
		httpError(w, "status filter must be pending|approved|rejected|canceled", http.StatusBadRequest)
		return
	}

	var args []any
	query := `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests
		WHERE tenant_id=?`
	args = append(args, tenantID)

	if status != "" {
		query += " AND status=?"
		args = append(args, status)
	}

	empIDStr := strings.TrimSpace(r.URL.Query().Get("employee_id"))
	if empIDStr != "" {
		empID, err := strconv.ParseUint(empIDStr, 10, 64)
		if err != nil {
			httpError(w, "employee_id must be numeric", http.StatusBadRequest)
			return
		}
		query += " AND employee_id=?"
		args = append(args, empID)
	}

	typeIDStr := strings.TrimSpace(r.URL.Query().Get("type_id"))
	if typeIDStr != "" {
		tid, err := strconv.ParseUint(typeIDStr, 10, 64)
		if err != nil {
			httpError(w, "type_id must be numeric", http.StatusBadRequest)
			return
		}
		query += " AND type_id=?"
		args = append(args, tid)
	}

	query += " ORDER BY created_at DESC, id DESC"

	items := make([]TimeOffRequest, 0)
	if err := h.DB.Select(&items, query, args...); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) ApproveTimeOff(w http.ResponseWriter, r *http.Request) {
	h.changeTimeOffStatus(w, r, "approved")
}
func (h *HRHandler) RejectTimeOff(w http.ResponseWriter, r *http.Request) {
	h.changeTimeOffStatus(w, r, "rejected")
}
func (h *HRHandler) CancelTimeOff(w http.ResponseWriter, r *http.Request) {
	h.changeTimeOffStatus(w, r, "canceled")
}

func (h *HRHandler) changeTimeOffStatus(w http.ResponseWriter, r *http.Request, to string) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		httpError(w, "invalid request id", http.StatusBadRequest)
		return
	}

	var req decisionReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before TimeOffRequest
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		httpError(w, "time off request not found", http.StatusNotFound)
		return
	}

	// allowed transitions:
	// pending -> approved/rejected/canceled
	// approved -> canceled
	if before.Status == "pending" {
		// ok
	} else if before.Status == "approved" && to == "canceled" {
		// ok
	} else {
		httpError(w, "invalid status transition", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	if _, err := tx.Exec(`
		UPDATE time_off_requests
		SET status=?, decision_note=?, approver_id=?, reviewed_at=?, updated_by=?
		WHERE tenant_id=? AND id=?`,
		to, cleanPtr(req.Note), userID, now, userID, tenantID, id); err != nil {
		httpError(w, "db update error", http.StatusInternalServerError)
		return
	}

	var after TimeOffRequest
	_ = tx.Get(&after, `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "time_off_requests", int64(id), before, after)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, after)
}
