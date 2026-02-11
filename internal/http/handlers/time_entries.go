package handlers

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	mw "saas-api/internal/http/middleware"
)

type TimeEntry struct {
	ID         uint64     `db:"id" json:"id"`
	TenantID   uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID uint64     `db:"employee_id" json:"employee_id"`
	ClockIn    time.Time  `db:"clock_in" json:"clock_in"`
	ClockOut   *time.Time `db:"clock_out" json:"clock_out,omitempty"`
	NoteIn     *string    `db:"note_in" json:"note_in,omitempty"`
	NoteOut    *string    `db:"note_out" json:"note_out,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
}

type clockInReq struct {
	EmployeeID uint64  `json:"employee_id"`
	Timestamp  *string `json:"timestamp"` // RFC3339 opcional; default now
	Note       *string `json:"note"`
}

type clockOutReq struct {
	EmployeeID uint64  `json:"employee_id"`
	Timestamp  *string `json:"timestamp"` // RFC3339 opcional; default now
	Note       *string `json:"note"`
}

func (h *HRHandler) ClockIn(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req clockInReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.EmployeeID == 0 {
		http.Error(w, "employee_id is required", http.StatusBadRequest)
		return
	}

	ts, err := parseTimestamp(req.Timestamp)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	noteIn := trimPtr(req.Note)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var status string
	if err := tx.Get(&status, `SELECT status FROM employees WHERE tenant_id=? AND id=?`, tenantID, req.EmployeeID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "employee not found", http.StatusNotFound)
			return
		}
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if status != "active" {
		http.Error(w, "employee must be active to clock in", http.StatusBadRequest)
		return
	}

	var openID uint64
	if err := tx.Get(&openID, `SELECT id FROM time_entries WHERE tenant_id=? AND employee_id=? AND clock_out IS NULL LIMIT 1`, tenantID, req.EmployeeID); err == nil {
		http.Error(w, "employee already clocked in", http.StatusBadRequest)
		return
	} else if err != sql.ErrNoRows {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO time_entries (tenant_id, employee_id, clock_in, note_in, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		tenantID, req.EmployeeID, ts, noteIn, userID, userID,
	)
	if err != nil {
		http.Error(w, "db insert error", http.StatusInternalServerError)
		return
	}
	id64, _ := res.LastInsertId()

	var entry TimeEntry
	if err := tx.Get(&entry, `
		SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at
		FROM time_entries
		WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "time_entries", id64, nil, entry)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, entry)
}

func (h *HRHandler) ClockOut(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req clockOutReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.EmployeeID == 0 {
		http.Error(w, "employee_id is required", http.StatusBadRequest)
		return
	}

	ts, err := parseTimestamp(req.Timestamp)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	noteOut := trimPtr(req.Note)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before TimeEntry
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at
		FROM time_entries
		WHERE tenant_id=? AND employee_id=? AND clock_out IS NULL
		ORDER BY clock_in DESC, id DESC
		LIMIT 1`, tenantID, req.EmployeeID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "no open clock-in for employee", http.StatusBadRequest)
			return
		}
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if ts.Before(before.ClockIn) {
		http.Error(w, "timestamp must be >= clock_in", http.StatusBadRequest)
		return
	}

	if _, err := tx.Exec(`
		UPDATE time_entries
		SET clock_out=?, note_out=?, updated_by=?
		WHERE tenant_id=? AND id=?`,
		ts, noteOut, userID, tenantID, before.ID,
	); err != nil {
		http.Error(w, "db update error", http.StatusInternalServerError)
		return
	}

	var after TimeEntry
	if err := tx.Get(&after, `
		SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at
		FROM time_entries
		WHERE tenant_id=? AND id=?`, tenantID, before.ID); err != nil {
		http.Error(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "update", "time_entries", int64(before.ID), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, after)
}

func (h *HRHandler) ListTimeEntries(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	clauses := []string{"tenant_id=?"}
	args := []any{tenantID}

	q := r.URL.Query()

	if empStr := strings.TrimSpace(q.Get("employee_id")); empStr != "" {
		empID, err := strconv.ParseUint(empStr, 10, 64)
		if err != nil {
			http.Error(w, "employee_id must be an integer", http.StatusBadRequest)
			return
		}
		clauses = append(clauses, "employee_id=?")
		args = append(args, empID)
	}

	if fromStr := strings.TrimSpace(q.Get("from")); fromStr != "" {
		from, err := time.Parse("2006-01-02", fromStr)
		if err != nil {
			http.Error(w, "from must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		clauses = append(clauses, "clock_in >= ?")
		args = append(args, from)
	}

	if toStr := strings.TrimSpace(q.Get("to")); toStr != "" {
		to, err := time.Parse("2006-01-02", toStr)
		if err != nil {
			http.Error(w, "to must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		clauses = append(clauses, "clock_in < ?")
		args = append(args, to.Add(24*time.Hour))
	}

	sqlStr := `
		SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at
		FROM time_entries
		WHERE ` + strings.Join(clauses, " AND ") + `
		ORDER BY clock_in DESC, id DESC
		LIMIT 500`

	items := make([]TimeEntry, 0)
	if err := h.DB.Select(&items, sqlStr, args...); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, items)
}

func parseTimestamp(ts *string) (time.Time, error) {
	if ts == nil || strings.TrimSpace(*ts) == "" {
		return time.Now(), nil
	}
	s := strings.TrimSpace(*ts)
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05"}

	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}

	return time.Time{}, errors.New("timestamp must be RFC3339 or 'YYYY-MM-DD HH:MM:SS'")
}

func trimPtr(s *string) *string {
	if s == nil {
		return nil
	}
	v := strings.TrimSpace(*s)
	if v == "" {
		return nil
	}
	return &v
}
