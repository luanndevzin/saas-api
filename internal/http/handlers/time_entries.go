package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

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

type TimeEntryHandler struct {
	DB *sqlx.DB
}

type createTimeEntryReq struct {
	EmployeeID uint64  `json:"employee_id"`
	ClockIn    string  `json:"clock_in"`
	ClockOut   *string `json:"clock_out"`
	NoteIn     *string `json:"note_in"`
	NoteOut    *string `json:"note_out"`
}

func parseDateTime(v string) (time.Time, error) {
	v = strings.TrimSpace(v)
	layouts := []string{time.RFC3339, "2006-01-02 15:04", "2006-01-02"}
	var lastErr error
	for _, l := range layouts {
		if t, err := time.Parse(l, v); err == nil {
			return t, nil
		} else {
			lastErr = err
		}
	}
	return time.Time{}, lastErr
}

func (h *TimeEntryHandler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTimeEntryReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.EmployeeID == 0 || strings.TrimSpace(req.ClockIn) == "" {
		http.Error(w, "employee_id and clock_in are required", 400)
		return
	}

	clockIn, err := parseDateTime(req.ClockIn)
	if err != nil {
		http.Error(w, "clock_in must be RFC3339 or YYYY-MM-DD HH:MM", 400)
		return
	}
	var clockOut *time.Time
	if req.ClockOut != nil && strings.TrimSpace(*req.ClockOut) != "" {
		t, err := parseDateTime(*req.ClockOut)
		if err != nil {
			http.Error(w, "clock_out must be RFC3339 or YYYY-MM-DD HH:MM", 400)
			return
		}
		clockOut = &t
	}

	// ensure employee belongs to tenant
	var tmp int
	if err := h.DB.Get(&tmp, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, req.EmployeeID); err != nil {
		http.Error(w, "employee not found", 400)
		return
	}

	res, err := h.DB.Exec(`
        INSERT INTO time_entries (tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.EmployeeID, clockIn, clockOut, trimPtr(req.NoteIn), trimPtr(req.NoteOut), userID, userID,
	)
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	id64, _ := res.LastInsertId()

	var te TimeEntry
	if err := h.DB.Get(&te, `SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", 500)
		return
	}

	writeJSON(w, 201, te)
}

type listTimeEntryResp struct {
	Items []TimeEntry `json:"items"`
}

func (h *TimeEntryHandler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	employeeIDStr := strings.TrimSpace(r.URL.Query().Get("employee_id"))
	from := strings.TrimSpace(r.URL.Query().Get("from"))
	to := strings.TrimSpace(r.URL.Query().Get("to"))

	args := []any{tenantID}
	where := " WHERE tenant_id=?"

	if employeeIDStr != "" {
		empID, err := strconv.ParseUint(employeeIDStr, 10, 64)
		if err != nil {
			http.Error(w, "employee_id must be uint", 400)
			return
		}
		where += " AND employee_id=?"
		args = append(args, empID)
	}

	if from != "" {
		t, err := parseDateTime(from)
		if err != nil {
			http.Error(w, "from must be date or datetime", 400)
			return
		}
		where += " AND clock_in >= ?"
		args = append(args, t)
	}
	if to != "" {
		t, err := parseDateTime(to)
		if err != nil {
			http.Error(w, "to must be date or datetime", 400)
			return
		}
		where += " AND clock_in <= ?"
		args = append(args, t)
	}

	var items []TimeEntry
	query := `SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries` + where + ` ORDER BY clock_in DESC`
	if err := h.DB.Select(&items, query, args...); err != nil {
		http.Error(w, "db error", 500)
		return
	}
	writeJSON(w, 200, items)
}

// util usado pelo FaceClock: encontra batida aberta (clock_out NULL)
func (h *TimeEntryHandler) findOpenEntry(ctx context.Context, tenantID, employeeID uint64) (*TimeEntry, error) {
	var te TimeEntry
	err := h.DB.GetContext(ctx, &te, `
		SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at
		FROM time_entries
		WHERE tenant_id=? AND employee_id=? AND clock_out IS NULL
		ORDER BY clock_in ASC
		LIMIT 1`, tenantID, employeeID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &te, nil
}

// createInternal: bypass helpers HTTP para reuso
func (h *TimeEntryHandler) createInternal(w http.ResponseWriter, r *http.Request, body map[string]any) {
	// aproveita Create mas com body pré-montado
	b, _ := json.Marshal(body)
	r2 := r.Clone(r.Context())
	r2.Body = io.NopCloser(strings.NewReader(string(b)))
	h.Create(w, r2)
}

// updateOpenInternal fecha o primeiro aberto
func (h *TimeEntryHandler) updateOpenInternal(w http.ResponseWriter, r *http.Request, body map[string]any) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	employeeID := uint64(0)
	if v, ok := body["employee_id"]; ok {
		switch t := v.(type) {
		case float64:
			employeeID = uint64(t)
		case int:
			employeeID = uint64(t)
		case int64:
			employeeID = uint64(t)
		case uint64:
			employeeID = t
		}
	}
	if employeeID == 0 {
		http.Error(w, "employee_id required", 400)
		return
	}
	open, err := h.findOpenEntry(r.Context(), tenantID, employeeID)
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	if open == nil {
		http.Error(w, "no open entry", 400)
		return
	}
	clockOut := time.Now().UTC()
	if v, ok := body["clock_out"].(string); ok && strings.TrimSpace(v) != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			clockOut = t
		}
	}
	noteOut := body["note_out"]

	_, err = h.DB.Exec(`UPDATE time_entries SET clock_out=?, note_out=?, updated_by=? WHERE tenant_id=? AND id=?`,
		clockOut, noteOut, userID, tenantID, open.ID)
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}
	var te TimeEntry
	_ = h.DB.Get(&te, `SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries WHERE id=?`, open.ID)
	writeJSON(w, 200, te)
}

// local helper (trim & nullify)
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
