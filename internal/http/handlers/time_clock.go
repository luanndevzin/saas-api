package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	mw "saas-api/internal/http/middleware"
)

const (
	defaultMyEntriesLimit = 30
	maxMyEntriesLimit     = 200
)

type employeeForClock struct {
	ID     uint64         `db:"id"`
	Name   string         `db:"name"`
	Email  sql.NullString `db:"email"`
	Status string         `db:"status"`
}

type myTimeEntriesResp struct {
	EmployeeID    uint64        `json:"employee_id"`
	EmployeeName  string        `json:"employee_name"`
	EmployeeEmail *string       `json:"employee_email,omitempty"`
	NowUTC        time.Time     `json:"now_utc"`
	TodaySeconds  int64         `json:"today_seconds"`
	OpenEntry     *HRTimeEntry  `json:"open_entry,omitempty"`
	Entries       []HRTimeEntry `json:"entries"`
}

func (h *HRHandler) GetMyTimeEntries(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	emp, found, err := h.resolveEmployeeForUser(tenantID, userID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if !found {
		httpError(w, "employee profile not linked to user", http.StatusNotFound)
		return
	}

	limit := defaultMyEntriesLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, convErr := strconv.Atoi(raw)
		if convErr != nil || parsed <= 0 {
			httpError(w, "limit must be numeric", http.StatusBadRequest)
			return
		}
		if parsed > maxMyEntriesLimit {
			parsed = maxMyEntriesLimit
		}
		limit = parsed
	}

	now := time.Now().UTC()
	todayStart := dateOnly(now)
	tomorrowStart := todayStart.Add(24 * time.Hour)

	var todaySeconds int64
	if err := h.DB.Get(&todaySeconds, `
		SELECT COALESCE(SUM(
			CASE WHEN is_running=1
				THEN GREATEST(TIMESTAMPDIFF(SECOND, start_at, UTC_TIMESTAMP()), 0)
				ELSE duration_seconds
			END
		), 0)
		FROM hr_time_entries
		WHERE tenant_id=? AND employee_id=? AND source='internal' AND start_at>=? AND start_at<?
	`, tenantID, emp.ID, todayStart, tomorrowStart); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	openEntry, err := h.findOpenInternalEntry(tenantID, emp.ID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	items := make([]HRTimeEntry, 0, limit)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
		       project_id, task_id, description, start_at, end_at, duration_seconds, is_running, billable,
		       synced_at, created_at, updated_at
		FROM hr_time_entries
		WHERE tenant_id=? AND employee_id=? AND source='internal'
		ORDER BY start_at DESC, id DESC
		LIMIT ?
	`, tenantID, emp.ID, limit); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	var emailPtr *string
	if emp.Email.Valid {
		email := strings.TrimSpace(emp.Email.String)
		if email != "" {
			emailPtr = &email
		}
	}

	writeJSON(w, http.StatusOK, myTimeEntriesResp{
		EmployeeID:    emp.ID,
		EmployeeName:  emp.Name,
		EmployeeEmail: emailPtr,
		NowUTC:        now,
		TodaySeconds:  todaySeconds,
		OpenEntry:     openEntry,
		Entries:       items,
	})
}

func (h *HRHandler) ClockIn(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	emp, found, err := h.resolveEmployeeForUser(tenantID, userID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if !found {
		httpError(w, "employee profile not linked to user", http.StatusNotFound)
		return
	}
	if emp.Status != "active" {
		httpError(w, "employee is not active", http.StatusBadRequest)
		return
	}

	openEntry, err := h.findOpenInternalEntry(tenantID, emp.ID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if openEntry != nil {
		httpError(w, "you already have an open time entry", http.StatusConflict)
		return
	}

	now := time.Now().UTC()
	externalID := genCode("punch")

	res, err := h.DB.Exec(`
		INSERT INTO hr_time_entries (
			tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
			project_id, task_id, description, tag_ids_json, start_at, end_at, duration_seconds,
			is_running, billable, raw_json, synced_at
		) VALUES (?, ?, 'internal', ?, ?, 'internal', NULL, NULL, NULL, NULL, ?, NULL, 0, 1, 0, NULL, ?)
	`, tenantID, emp.ID, externalID, fmt.Sprintf("internal-user-%d", userID), now, now)
	if err != nil {
		httpError(w, "could not create time entry", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var entry HRTimeEntry
	if err := h.DB.Get(&entry, `
		SELECT id, tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
		       project_id, task_id, description, start_at, end_at, duration_seconds, is_running, billable,
		       synced_at, created_at, updated_at
		FROM hr_time_entries
		WHERE tenant_id=? AND id=?
	`, tenantID, id64); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(h.DB, r, tenantID, userID, "clock_in", "hr_time_entries", id64, nil, entry)
	writeJSON(w, http.StatusCreated, entry)
}

func (h *HRHandler) ClockOut(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	emp, found, err := h.resolveEmployeeForUser(tenantID, userID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if !found {
		httpError(w, "employee profile not linked to user", http.StatusNotFound)
		return
	}

	openEntry, err := h.findOpenInternalEntry(tenantID, emp.ID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if openEntry == nil {
		httpError(w, "no open time entry found", http.StatusNotFound)
		return
	}

	now := time.Now().UTC()
	durationSeconds := int64(now.Sub(openEntry.StartAt).Seconds())
	if durationSeconds < 0 {
		durationSeconds = 0
	}

	if _, err := h.DB.Exec(`
		UPDATE hr_time_entries
		SET end_at=?, duration_seconds=?, is_running=0, synced_at=?, updated_at=CURRENT_TIMESTAMP
		WHERE tenant_id=? AND id=? AND source='internal'
	`, now, durationSeconds, now, tenantID, openEntry.ID); err != nil {
		httpError(w, "could not close time entry", http.StatusBadRequest)
		return
	}

	var closed HRTimeEntry
	if err := h.DB.Get(&closed, `
		SELECT id, tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
		       project_id, task_id, description, start_at, end_at, duration_seconds, is_running, billable,
		       synced_at, created_at, updated_at
		FROM hr_time_entries
		WHERE tenant_id=? AND id=?
	`, tenantID, openEntry.ID); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(h.DB, r, tenantID, userID, "clock_out", "hr_time_entries", int64(openEntry.ID), openEntry, closed)
	writeJSON(w, http.StatusOK, closed)
}

func (h *HRHandler) resolveEmployeeForUser(tenantID, userID uint64) (employeeForClock, bool, error) {
	var userEmail string
	if err := h.DB.Get(&userEmail, `SELECT email FROM users WHERE id=?`, userID); err != nil {
		if err == sql.ErrNoRows {
			return employeeForClock{}, false, nil
		}
		return employeeForClock{}, false, err
	}

	email := strings.ToLower(strings.TrimSpace(userEmail))
	if email == "" {
		return employeeForClock{}, false, nil
	}

	var emp employeeForClock
	if err := h.DB.Get(&emp, `
		SELECT id, name, email, status
		FROM employees
		WHERE tenant_id=? AND email IS NOT NULL AND LOWER(TRIM(email))=? AND status<>'terminated'
		ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'inactive' THEN 1 ELSE 2 END, id ASC
		LIMIT 1
	`, tenantID, email); err != nil {
		if err == sql.ErrNoRows {
			return employeeForClock{}, false, nil
		}
		return employeeForClock{}, false, err
	}
	return emp, true, nil
}

func (h *HRHandler) findOpenInternalEntry(tenantID, employeeID uint64) (*HRTimeEntry, error) {
	var entry HRTimeEntry
	if err := h.DB.Get(&entry, `
		SELECT id, tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
		       project_id, task_id, description, start_at, end_at, duration_seconds, is_running, billable,
		       synced_at, created_at, updated_at
		FROM hr_time_entries
		WHERE tenant_id=? AND employee_id=? AND source='internal' AND is_running=1
		ORDER BY start_at DESC, id DESC
		LIMIT 1
	`, tenantID, employeeID); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &entry, nil
}
