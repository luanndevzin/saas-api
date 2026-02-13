package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	mw "saas-api/internal/http/middleware"
)

const (
	defaultTimeBankDailyMinutes = 480
	defaultTimeBankRangeDays    = 30
	defaultTimeBankLimit        = 30
	maxTimeBankLimit            = 200
	maxTimeBankDailyMinutes     = 960
	timeBankStatusPending       = "pending"
	timeBankStatusApproved      = "approved"
	timeBankStatusRejected      = "rejected"
)

type timeBankSettings struct {
	TargetDailyMinutes int        `db:"target_daily_minutes" json:"target_daily_minutes"`
	IncludeSaturday    bool       `db:"include_saturday" json:"include_saturday"`
	UpdatedAt          *time.Time `db:"updated_at" json:"updated_at,omitempty"`
}

type upsertTimeBankSettingsReq struct {
	TargetDailyMinutes *int  `json:"target_daily_minutes"`
	IncludeSaturday    *bool `json:"include_saturday"`
}

type timeBankEmployeeRow struct {
	ID              uint64       `db:"id"`
	Name            string       `db:"name"`
	Status          string       `db:"status"`
	HireDate        sql.NullTime `db:"hire_date"`
	TerminationDate sql.NullTime `db:"termination_date"`
}

type employeeWorkedSecondsRow struct {
	EmployeeID    uint64 `db:"employee_id"`
	WorkedSeconds int64  `db:"worked_seconds"`
}

type employeeAdjustmentSecondsRow struct {
	EmployeeID        uint64 `db:"employee_id"`
	AdjustmentSeconds int64  `db:"adjustment_seconds"`
}

type TimeBankEmployeeSummary struct {
	EmployeeID        uint64     `json:"employee_id"`
	Name              string     `json:"name"`
	Status            string     `json:"status"`
	HireDate          *time.Time `json:"hire_date,omitempty"`
	TerminationDate   *time.Time `json:"termination_date,omitempty"`
	WorkedSeconds     int64      `json:"worked_seconds"`
	ExpectedSeconds   int64      `json:"expected_seconds"`
	AdjustmentSeconds int64      `json:"adjustment_seconds"`
	BalanceSeconds    int64      `json:"balance_seconds"`
}

type TimeBankSummaryTotals struct {
	WorkedSeconds     int64 `json:"worked_seconds"`
	ExpectedSeconds   int64 `json:"expected_seconds"`
	AdjustmentSeconds int64 `json:"adjustment_seconds"`
	BalanceSeconds    int64 `json:"balance_seconds"`
}

type TimeBankSummaryResp struct {
	StartDate          string                    `json:"start_date"`
	EndDate            string                    `json:"end_date"`
	TargetDailyMinutes int                       `json:"target_daily_minutes"`
	IncludeSaturday    bool                      `json:"include_saturday"`
	Employees          []TimeBankEmployeeSummary `json:"employees"`
	Totals             TimeBankSummaryTotals     `json:"totals"`
}

type createTimeBankAdjustmentReq struct {
	EmployeeID    uint64  `json:"employee_id"`
	EffectiveDate string  `json:"effective_date"`
	SecondsDelta  *int64  `json:"seconds_delta"`
	MinutesDelta  *int64  `json:"minutes_delta"`
	Reason        *string `json:"reason"`
}

type timeBankDecisionReq struct {
	Note *string `json:"note"`
}

type TimeBankAdjustment struct {
	ID            uint64     `db:"id" json:"id"`
	TenantID      uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID    uint64     `db:"employee_id" json:"employee_id"`
	EmployeeName  string     `db:"employee_name" json:"employee_name"`
	EffectiveDate time.Time  `db:"effective_date" json:"effective_date"`
	SecondsDelta  int64      `db:"seconds_delta" json:"seconds_delta"`
	Status        string     `db:"status" json:"status"`
	Reason        *string    `db:"reason" json:"reason,omitempty"`
	ReviewNote    *string    `db:"review_note" json:"review_note,omitempty"`
	CreatedBy     *uint64    `db:"created_by" json:"created_by,omitempty"`
	ReviewedBy    *uint64    `db:"reviewed_by" json:"reviewed_by,omitempty"`
	ReviewedAt    *time.Time `db:"reviewed_at" json:"reviewed_at,omitempty"`
	CreatedAt     time.Time  `db:"created_at" json:"created_at"`
}

type closeTimeBankReq struct {
	StartDate string  `json:"start_date"`
	EndDate   string  `json:"end_date"`
	Note      *string `json:"note"`
}

type reopenTimeBankReq struct {
	Note *string `json:"note"`
}

type TimeBankClosure struct {
	ID                   uint64     `db:"id" json:"id"`
	TenantID             uint64     `db:"tenant_id" json:"tenant_id"`
	PeriodStart          time.Time  `db:"period_start" json:"period_start"`
	PeriodEnd            time.Time  `db:"period_end" json:"period_end"`
	Status               string     `db:"status" json:"status"`
	Note                 *string    `db:"note" json:"note,omitempty"`
	ClosedAt             *time.Time `db:"closed_at" json:"closed_at,omitempty"`
	ClosedBy             *uint64    `db:"closed_by" json:"closed_by,omitempty"`
	ReopenedAt           *time.Time `db:"reopened_at" json:"reopened_at,omitempty"`
	ReopenedBy           *uint64    `db:"reopened_by" json:"reopened_by,omitempty"`
	CreatedAt            time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt            time.Time  `db:"updated_at" json:"updated_at"`
	EmployeesCount       int64      `db:"employees_count" json:"employees_count"`
	TotalWorkedSeconds   int64      `db:"total_worked_seconds" json:"total_worked_seconds"`
	TotalExpectedSeconds int64      `db:"total_expected_seconds" json:"total_expected_seconds"`
	TotalAdjustSeconds   int64      `db:"total_adjustment_seconds" json:"total_adjustment_seconds"`
	TotalBalanceSeconds  int64      `db:"total_balance_seconds" json:"total_balance_seconds"`
}

func (h *HRHandler) GetTimeBankSettings(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	settings, err := h.loadTimeBankSettings(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, settings)
}

func (h *HRHandler) UpsertTimeBankSettings(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req upsertTimeBankSettingsReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	current, err := h.loadTimeBankSettings(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	next := current
	if req.TargetDailyMinutes != nil {
		if *req.TargetDailyMinutes < 1 || *req.TargetDailyMinutes > maxTimeBankDailyMinutes {
			httpError(w, "target_daily_minutes must be between 1 and 960", http.StatusBadRequest)
			return
		}
		next.TargetDailyMinutes = *req.TargetDailyMinutes
	}
	if req.IncludeSaturday != nil {
		next.IncludeSaturday = *req.IncludeSaturday
	}

	if _, err := h.DB.Exec(`
		INSERT INTO hr_time_bank_settings (tenant_id, target_daily_minutes, include_saturday, updated_by)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			target_daily_minutes=VALUES(target_daily_minutes),
			include_saturday=VALUES(include_saturday),
			updated_by=VALUES(updated_by),
			updated_at=CURRENT_TIMESTAMP
	`, tenantID, next.TargetDailyMinutes, next.IncludeSaturday, userID); err != nil {
		httpError(w, "db update error", http.StatusInternalServerError)
		return
	}

	after, err := h.loadTimeBankSettings(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(h.DB, r, tenantID, userID, "update", "hr_time_bank_settings", 0, current, after)
	writeJSON(w, http.StatusOK, after)
}

func (h *HRHandler) GetTimeBankSummary(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	startDate, endDate, err := parseTimeBankRange(r.URL.Query().Get("start_date"), r.URL.Query().Get("end_date"))
	if err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	settings, err := h.loadTimeBankSettings(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	summary, err := h.buildTimeBankSummary(tenantID, startDate, endDate, settings)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, summary)
}

func (h *HRHandler) ListTimeBankAdjustments(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	limit := defaultTimeBankLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			httpError(w, "limit must be numeric", http.StatusBadRequest)
			return
		}
		if parsed > maxTimeBankLimit {
			parsed = maxTimeBankLimit
		}
		limit = parsed
	}

	startDate, endDate, err := parseTimeBankRange(r.URL.Query().Get("start_date"), r.URL.Query().Get("end_date"))
	if err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	args := []any{tenantID, startDate, endDate}
	query := `
		SELECT a.id, a.tenant_id, a.employee_id, e.name AS employee_name, a.effective_date,
		       a.seconds_delta, a.status, a.reason, a.review_note, a.created_by, a.reviewed_by, a.reviewed_at, a.created_at
		FROM hr_time_bank_adjustments a
		JOIN employees e ON e.tenant_id=a.tenant_id AND e.id=a.employee_id
		WHERE a.tenant_id=? AND a.effective_date>=? AND a.effective_date<=?
	`

	if raw := strings.TrimSpace(r.URL.Query().Get("employee_id")); raw != "" {
		employeeID, parseErr := strconv.ParseUint(raw, 10, 64)
		if parseErr != nil {
			httpError(w, "employee_id must be numeric", http.StatusBadRequest)
			return
		}
		query += " AND a.employee_id=?"
		args = append(args, employeeID)
	}

	if raw := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status"))); raw != "" {
		if !isValidTimeBankStatus(raw) {
			httpError(w, "adjustment status must be pending|approved|rejected", http.StatusBadRequest)
			return
		}
		query += " AND a.status=?"
		args = append(args, raw)
	}

	query += " ORDER BY a.effective_date DESC, a.id DESC LIMIT ?"
	args = append(args, limit)

	items := make([]TimeBankAdjustment, 0, limit)
	if err := h.DB.Select(&items, query, args...); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateTimeBankAdjustment(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTimeBankAdjustmentReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.EmployeeID == 0 {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	effectiveDate, err := parseDate(req.EffectiveDate)
	if err != nil {
		httpError(w, "effective_date must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	delta, err := parseTimeBankDelta(req.SecondsDelta, req.MinutesDelta)
	if err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	closed, err := h.isDateClosedForTimeBank(tenantID, effectiveDate)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if closed {
		httpError(w, "period is closed for this date", http.StatusConflict)
		return
	}

	reason := normalizeOptionalString(req.Reason)

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var exists int
	if err := tx.Get(&exists, `SELECT COUNT(*) FROM employees WHERE tenant_id=? AND id=?`, tenantID, req.EmployeeID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	if exists == 0 {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO hr_time_bank_adjustments (
			tenant_id, employee_id, effective_date, seconds_delta, status, reason, review_note, created_by, reviewed_by, reviewed_at
		)
		VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL)
	`, tenantID, req.EmployeeID, effectiveDate, delta, timeBankStatusPending, reason, userID)
	if err != nil {
		httpError(w, "could not create time bank adjustment", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var created TimeBankAdjustment
	if err := tx.Get(&created, `
		SELECT a.id, a.tenant_id, a.employee_id, e.name AS employee_name, a.effective_date,
		       a.seconds_delta, a.status, a.reason, a.review_note, a.created_by, a.reviewed_by, a.reviewed_at, a.created_at
		FROM hr_time_bank_adjustments a
		JOIN employees e ON e.tenant_id=a.tenant_id AND e.id=a.employee_id
		WHERE a.tenant_id=? AND a.id=?
	`, tenantID, id64); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "hr_time_bank_adjustments", id64, nil, created)
	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, created)
}

func (h *HRHandler) ApproveTimeBankAdjustment(w http.ResponseWriter, r *http.Request) {
	h.decideTimeBankAdjustment(w, r, timeBankStatusApproved)
}

func (h *HRHandler) RejectTimeBankAdjustment(w http.ResponseWriter, r *http.Request) {
	h.decideTimeBankAdjustment(w, r, timeBankStatusRejected)
}

func (h *HRHandler) decideTimeBankAdjustment(w http.ResponseWriter, r *http.Request, targetStatus string) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	adjustmentID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid request id", http.StatusBadRequest)
		return
	}

	var req timeBankDecisionReq
	if r.ContentLength > 0 {
		if err := decodeJSON(r, &req); err != nil {
			httpError(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	note := normalizeOptionalString(req.Note)

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	before, err := h.getTimeBankAdjustmentByID(tx, tenantID, adjustmentID)
	if err == sql.ErrNoRows {
		httpError(w, "time bank adjustment not found", http.StatusNotFound)
		return
	}
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	if before.Status != timeBankStatusPending {
		httpError(w, "invalid status transition", http.StatusBadRequest)
		return
	}

	closed, err := h.isDateClosedForTimeBank(tenantID, before.EffectiveDate)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if closed {
		httpError(w, "period is closed for this date", http.StatusConflict)
		return
	}

	if _, err := tx.Exec(`
		UPDATE hr_time_bank_adjustments
		SET status=?, review_note=?, reviewed_by=?, reviewed_at=UTC_TIMESTAMP
		WHERE tenant_id=? AND id=?
	`, targetStatus, note, userID, tenantID, adjustmentID); err != nil {
		httpError(w, "db update error", http.StatusInternalServerError)
		return
	}

	after, err := h.getTimeBankAdjustmentByID(tx, tenantID, adjustmentID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	action := "approve"
	if targetStatus == timeBankStatusRejected {
		action = "reject"
	}
	_ = insertAudit(tx, r, tenantID, userID, action, "hr_time_bank_adjustments", int64(adjustmentID), before, after)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, after)
}

func (h *HRHandler) CloseTimeBankPeriod(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req closeTimeBankReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.StartDate) == "" {
		httpError(w, "period_start is required", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.EndDate) == "" {
		httpError(w, "period_end is required", http.StatusBadRequest)
		return
	}

	startDate, err := parseDate(req.StartDate)
	if err != nil {
		httpError(w, "period_start must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	endDate, err := parseDate(req.EndDate)
	if err != nil {
		httpError(w, "period_end must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if endDate.Before(startDate) {
		httpError(w, "period_end must be >= period_start", http.StatusBadRequest)
		return
	}

	var ignoreID *uint64
	var samePeriodID uint64
	findErr := h.DB.Get(&samePeriodID, `
		SELECT id
		FROM hr_time_bank_closures
		WHERE tenant_id=? AND period_start=? AND period_end=?
		LIMIT 1
	`, tenantID, startDate, endDate)
	if findErr == nil {
		ignoreID = &samePeriodID
	} else if findErr != sql.ErrNoRows {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	hasOverlap, err := h.hasOverlappingClosedPeriod(tenantID, startDate, endDate, ignoreID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if hasOverlap {
		httpError(w, "another closed period overlaps selected range", http.StatusConflict)
		return
	}

	settings, err := h.loadTimeBankSettings(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	summary, err := h.buildTimeBankSummary(tenantID, startDate, endDate, settings)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	note := normalizeOptionalString(req.Note)
	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var closureID uint64
	getErr := tx.Get(&closureID, `
		SELECT id FROM hr_time_bank_closures
		WHERE tenant_id=? AND period_start=? AND period_end=?
		LIMIT 1
	`, tenantID, startDate, endDate)
	if getErr == sql.ErrNoRows {
		res, execErr := tx.Exec(`
			INSERT INTO hr_time_bank_closures (
				tenant_id, period_start, period_end, status, note, closed_at, closed_by, reopened_at, reopened_by
			) VALUES (?, ?, ?, 'closed', ?, UTC_TIMESTAMP(), ?, NULL, NULL)
		`, tenantID, startDate, endDate, note, userID)
		if execErr != nil {
			httpError(w, "could not close time bank period", http.StatusBadRequest)
			return
		}
		id64, _ := res.LastInsertId()
		closureID = uint64(id64)
	} else if getErr != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	} else {
		if _, execErr := tx.Exec(`
			UPDATE hr_time_bank_closures
			SET status='closed',
			    note=?,
			    closed_at=UTC_TIMESTAMP(),
			    closed_by=?,
			    reopened_at=NULL,
			    reopened_by=NULL,
			    updated_at=CURRENT_TIMESTAMP
			WHERE tenant_id=? AND id=?
		`, note, userID, tenantID, closureID); execErr != nil {
			httpError(w, "could not close time bank period", http.StatusBadRequest)
			return
		}
	}

	if _, err := tx.Exec(`DELETE FROM hr_time_bank_closure_items WHERE tenant_id=? AND closure_id=?`, tenantID, closureID); err != nil {
		httpError(w, "db delete error", http.StatusInternalServerError)
		return
	}

	for _, employee := range summary.Employees {
		if _, err := tx.Exec(`
			INSERT INTO hr_time_bank_closure_items (
				tenant_id, closure_id, employee_id, worked_seconds, expected_seconds, adjustment_seconds, balance_seconds
			) VALUES (?, ?, ?, ?, ?, ?, ?)
		`, tenantID, closureID, employee.EmployeeID, employee.WorkedSeconds, employee.ExpectedSeconds, employee.AdjustmentSeconds, employee.BalanceSeconds); err != nil {
			httpError(w, "db update error", http.StatusInternalServerError)
			return
		}
	}

	closure, err := h.getTimeBankClosureByID(tx, tenantID, closureID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "close", "hr_time_bank_closures", int64(closureID), nil, closure)
	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, closure)
}

func (h *HRHandler) ListTimeBankClosures(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	limit := defaultTimeBankLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			httpError(w, "limit must be numeric", http.StatusBadRequest)
			return
		}
		if parsed > maxTimeBankLimit {
			parsed = maxTimeBankLimit
		}
		limit = parsed
	}

	items := make([]TimeBankClosure, 0, limit)
	if err := h.DB.Select(&items, timeBankClosureSelect+`
		WHERE c.tenant_id=?
		GROUP BY c.id, c.tenant_id, c.period_start, c.period_end, c.status, c.note,
		         c.closed_at, c.closed_by, c.reopened_at, c.reopened_by, c.created_at, c.updated_at
		ORDER BY c.period_end DESC, c.id DESC
		LIMIT ?
	`, tenantID, limit); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) ReopenTimeBankClosure(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid request id", http.StatusBadRequest)
		return
	}

	var req reopenTimeBankReq
	if r.ContentLength > 0 {
		if err := decodeJSON(r, &req); err != nil {
			httpError(w, err.Error(), http.StatusBadRequest)
			return
		}
	}
	note := normalizeOptionalString(req.Note)

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	before, err := h.getTimeBankClosureByID(tx, tenantID, id)
	if err == sql.ErrNoRows {
		httpError(w, "time bank closure not found", http.StatusNotFound)
		return
	}
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec(`
		UPDATE hr_time_bank_closures
		SET status='reopened',
		    note=COALESCE(?, note),
		    reopened_at=UTC_TIMESTAMP(),
		    reopened_by=?,
		    updated_at=CURRENT_TIMESTAMP
		WHERE tenant_id=? AND id=?
	`, note, userID, tenantID, id); err != nil {
		httpError(w, "could not reopen time bank period", http.StatusBadRequest)
		return
	}

	after, err := h.getTimeBankClosureByID(tx, tenantID, id)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "reopen", "hr_time_bank_closures", int64(id), before, after)
	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, after)
}

func (h *HRHandler) loadTimeBankSettings(tenantID uint64) (timeBankSettings, error) {
	var settings timeBankSettings
	err := h.DB.Get(&settings, `
		SELECT target_daily_minutes, include_saturday, updated_at
		FROM hr_time_bank_settings
		WHERE tenant_id=?
	`, tenantID)
	if err == sql.ErrNoRows {
		return timeBankSettings{
			TargetDailyMinutes: defaultTimeBankDailyMinutes,
			IncludeSaturday:    false,
		}, nil
	}
	if err != nil {
		return timeBankSettings{}, err
	}
	return settings, nil
}

func (h *HRHandler) buildTimeBankSummary(tenantID uint64, startDate, endDate time.Time, settings timeBankSettings) (TimeBankSummaryResp, error) {
	employees := make([]timeBankEmployeeRow, 0, 200)
	if err := h.DB.Select(&employees, `
		SELECT id, name, status, hire_date, termination_date
		FROM employees
		WHERE tenant_id=?
		  AND (hire_date IS NULL OR hire_date<=?)
		  AND (termination_date IS NULL OR termination_date>=?)
		ORDER BY name ASC, id ASC
	`, tenantID, endDate, startDate); err != nil {
		return TimeBankSummaryResp{}, err
	}

	workedRows := make([]employeeWorkedSecondsRow, 0, len(employees))
	if err := h.DB.Select(&workedRows, `
		SELECT employee_id,
		       COALESCE(SUM(
		         CASE
		           WHEN is_running=1 THEN GREATEST(TIMESTAMPDIFF(SECOND, start_at, UTC_TIMESTAMP()), 0)
		           ELSE duration_seconds
		         END
		       ), 0) AS worked_seconds
		FROM hr_time_entries
		WHERE tenant_id=? AND employee_id IS NOT NULL AND start_at>=? AND start_at<?
		GROUP BY employee_id
	`, tenantID, startDate, endDate.Add(24*time.Hour)); err != nil {
		return TimeBankSummaryResp{}, err
	}
	workedByEmployee := make(map[uint64]int64, len(workedRows))
	for _, row := range workedRows {
		workedByEmployee[row.EmployeeID] = row.WorkedSeconds
	}

	adjustRows := make([]employeeAdjustmentSecondsRow, 0, len(employees))
	if err := h.DB.Select(&adjustRows, `
		SELECT employee_id, COALESCE(SUM(seconds_delta), 0) AS adjustment_seconds
		FROM hr_time_bank_adjustments
		WHERE tenant_id=? AND status=? AND effective_date>=? AND effective_date<=?
		GROUP BY employee_id
	`, tenantID, timeBankStatusApproved, startDate, endDate); err != nil {
		return TimeBankSummaryResp{}, err
	}
	adjustByEmployee := make(map[uint64]int64, len(adjustRows))
	for _, row := range adjustRows {
		adjustByEmployee[row.EmployeeID] = row.AdjustmentSeconds
	}

	resp := TimeBankSummaryResp{
		StartDate:          startDate.Format("2006-01-02"),
		EndDate:            endDate.Format("2006-01-02"),
		TargetDailyMinutes: settings.TargetDailyMinutes,
		IncludeSaturday:    settings.IncludeSaturday,
		Employees:          make([]TimeBankEmployeeSummary, 0, len(employees)),
	}

	for _, employee := range employees {
		activeStart := startDate
		if employee.HireDate.Valid {
			hireDate := dateOnly(employee.HireDate.Time.UTC())
			if hireDate.After(activeStart) {
				activeStart = hireDate
			}
		}
		activeEnd := endDate
		if employee.TerminationDate.Valid {
			terminationDate := dateOnly(employee.TerminationDate.Time.UTC())
			if terminationDate.Before(activeEnd) {
				activeEnd = terminationDate
			}
		}

		expectedSeconds := int64(0)
		if !activeEnd.Before(activeStart) {
			workDays := countWorkDays(activeStart, activeEnd, settings.IncludeSaturday)
			expectedSeconds = workDays * int64(settings.TargetDailyMinutes) * 60
		}

		workedSeconds := workedByEmployee[employee.ID]
		adjustSeconds := adjustByEmployee[employee.ID]
		balanceSeconds := workedSeconds + adjustSeconds - expectedSeconds

		item := TimeBankEmployeeSummary{
			EmployeeID:        employee.ID,
			Name:              employee.Name,
			Status:            employee.Status,
			HireDate:          nullTimePtr(employee.HireDate),
			TerminationDate:   nullTimePtr(employee.TerminationDate),
			WorkedSeconds:     workedSeconds,
			ExpectedSeconds:   expectedSeconds,
			AdjustmentSeconds: adjustSeconds,
			BalanceSeconds:    balanceSeconds,
		}
		resp.Employees = append(resp.Employees, item)

		resp.Totals.WorkedSeconds += workedSeconds
		resp.Totals.ExpectedSeconds += expectedSeconds
		resp.Totals.AdjustmentSeconds += adjustSeconds
		resp.Totals.BalanceSeconds += balanceSeconds
	}

	return resp, nil
}

func (h *HRHandler) hasOverlappingClosedPeriod(tenantID uint64, startDate, endDate time.Time, ignoreID *uint64) (bool, error) {
	query := `
		SELECT COUNT(*)
		FROM hr_time_bank_closures
		WHERE tenant_id=? AND status='closed' AND NOT (period_end<? OR period_start>?)
	`
	args := []any{tenantID, startDate, endDate}
	if ignoreID != nil {
		query += " AND id<>?"
		args = append(args, *ignoreID)
	}

	var count int64
	if err := h.DB.Get(&count, query, args...); err != nil {
		return false, err
	}
	return count > 0, nil
}

func (h *HRHandler) isDateClosedForTimeBank(tenantID uint64, targetDate time.Time) (bool, error) {
	var count int64
	if err := h.DB.Get(&count, `
		SELECT COUNT(*)
		FROM hr_time_bank_closures
		WHERE tenant_id=? AND status='closed' AND period_start<=? AND period_end>=?
	`, tenantID, targetDate, targetDate); err != nil {
		return false, err
	}
	return count > 0, nil
}

const timeBankClosureSelect = `
	SELECT c.id, c.tenant_id, c.period_start, c.period_end, c.status, c.note,
	       c.closed_at, c.closed_by, c.reopened_at, c.reopened_by, c.created_at, c.updated_at,
	       COALESCE(COUNT(i.id), 0) AS employees_count,
	       COALESCE(SUM(i.worked_seconds), 0) AS total_worked_seconds,
	       COALESCE(SUM(i.expected_seconds), 0) AS total_expected_seconds,
	       COALESCE(SUM(i.adjustment_seconds), 0) AS total_adjustment_seconds,
	       COALESCE(SUM(i.balance_seconds), 0) AS total_balance_seconds
	FROM hr_time_bank_closures c
	LEFT JOIN hr_time_bank_closure_items i
	       ON i.tenant_id=c.tenant_id AND i.closure_id=c.id
`

func (h *HRHandler) getTimeBankClosureByID(exec sqlExecutor, tenantID uint64, id uint64) (TimeBankClosure, error) {
	var closure TimeBankClosure
	if err := exec.Get(&closure, timeBankClosureSelect+`
		WHERE c.tenant_id=? AND c.id=?
		GROUP BY c.id, c.tenant_id, c.period_start, c.period_end, c.status, c.note,
		         c.closed_at, c.closed_by, c.reopened_at, c.reopened_by, c.created_at, c.updated_at
		LIMIT 1
	`, tenantID, id); err != nil {
		return TimeBankClosure{}, err
	}
	return closure, nil
}

func (h *HRHandler) getTimeBankAdjustmentByID(exec sqlExecutor, tenantID, id uint64) (TimeBankAdjustment, error) {
	var item TimeBankAdjustment
	if err := exec.Get(&item, `
		SELECT a.id, a.tenant_id, a.employee_id, e.name AS employee_name, a.effective_date,
		       a.seconds_delta, a.status, a.reason, a.review_note, a.created_by, a.reviewed_by, a.reviewed_at, a.created_at
		FROM hr_time_bank_adjustments a
		JOIN employees e ON e.tenant_id=a.tenant_id AND e.id=a.employee_id
		WHERE a.tenant_id=? AND a.id=?
		LIMIT 1
	`, tenantID, id); err != nil {
		return TimeBankAdjustment{}, err
	}
	return item, nil
}

type sqlExecutor interface {
	Get(dest any, query string, args ...any) error
}

func parseTimeBankRange(startRaw, endRaw string) (time.Time, time.Time, error) {
	now := dateOnly(time.Now().UTC())
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := now
	var err error

	if strings.TrimSpace(startRaw) != "" {
		start, err = parseDate(startRaw)
		if err != nil {
			return time.Time{}, time.Time{}, errString("start_date must be YYYY-MM-DD")
		}
	}
	if strings.TrimSpace(endRaw) != "" {
		end, err = parseDate(endRaw)
		if err != nil {
			return time.Time{}, time.Time{}, errString("end_date must be YYYY-MM-DD")
		}
	}

	if strings.TrimSpace(startRaw) == "" && strings.TrimSpace(endRaw) == "" {
		start = now.AddDate(0, 0, -defaultTimeBankRangeDays)
	}

	if end.Before(start) {
		return time.Time{}, time.Time{}, errString("end_date must be >= start_date")
	}

	return start, end, nil
}

func parseTimeBankDelta(secondsDelta, minutesDelta *int64) (int64, error) {
	if secondsDelta != nil && minutesDelta != nil {
		return 0, errString("seconds_delta and minutes_delta cannot be used together")
	}

	var delta int64
	switch {
	case secondsDelta != nil:
		delta = *secondsDelta
	case minutesDelta != nil:
		delta = *minutesDelta * 60
	default:
		return 0, errString("seconds_delta or minutes_delta is required")
	}

	if delta == 0 {
		return 0, errString("delta must be non-zero")
	}
	return delta, nil
}

func isValidTimeBankStatus(status string) bool {
	switch strings.TrimSpace(strings.ToLower(status)) {
	case timeBankStatusPending, timeBankStatusApproved, timeBankStatusRejected:
		return true
	default:
		return false
	}
}

func countWorkDays(startDate, endDate time.Time, includeSaturday bool) int64 {
	start := dateOnly(startDate.UTC())
	end := dateOnly(endDate.UTC())
	if end.Before(start) {
		return 0
	}

	var total int64
	for cursor := start; !cursor.After(end); cursor = cursor.AddDate(0, 0, 1) {
		weekday := cursor.Weekday()
		if weekday == time.Sunday {
			continue
		}
		if weekday == time.Saturday && !includeSaturday {
			continue
		}
		total++
	}
	return total
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	if len(trimmed) > 255 {
		trimmed = trimmed[:255]
	}
	return &trimmed
}

func nullTimePtr(v sql.NullTime) *time.Time {
	if !v.Valid {
		return nil
	}
	t := dateOnly(v.Time.UTC())
	return &t
}

type errString string

func (e errString) Error() string { return string(e) }
