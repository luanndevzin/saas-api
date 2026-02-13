package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	mw "saas-api/internal/http/middleware"
)

const (
	clockifyBaseURL         = "https://api.clockify.me/api/v1"
	defaultTimeEntriesLimit = 200
	maxTimeEntriesLimit     = 1000
	clockifyRequestAttempts = 3
	statusUnmappedLimit     = 20
)

const (
	clockifyRetryBaseDelay = 750 * time.Millisecond
	clockifyRetryMaxDelay  = 6 * time.Second
)

var (
	isoDurationRE = regexp.MustCompile(`^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$`)
)

type clockifyConnection struct {
	WorkspaceID string    `db:"workspace_id"`
	APIKey      string    `db:"api_key"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`
}

type upsertClockifyConfigReq struct {
	APIKey      string `json:"api_key"`
	WorkspaceID string `json:"workspace_id"`
}

type clockifyConfigResp struct {
	Configured   bool       `json:"configured"`
	WorkspaceID  string     `json:"workspace_id,omitempty"`
	APIKeyMasked string     `json:"api_key_masked,omitempty"`
	CreatedAt    *time.Time `json:"created_at,omitempty"`
	UpdatedAt    *time.Time `json:"updated_at,omitempty"`
}

type syncClockifyReq struct {
	StartDate         string `json:"start_date"`
	EndDate           string `json:"end_date"`
	AllowClosedPeriod bool   `json:"allow_closed_period"`
}

type clockifySyncResp struct {
	RangeStart           string    `json:"range_start"`
	RangeEnd             string    `json:"range_end"`
	EmployeesTotal       int       `json:"employees_total"`
	UsersFound           int       `json:"users_found"`
	EmployeesMapped      int       `json:"employees_mapped"`
	EntriesProcessed     int       `json:"entries_processed"`
	EntriesUpserted      int       `json:"entries_upserted"`
	EntriesSkippedClosed int       `json:"entries_skipped_closed"`
	RunningEntries       int       `json:"running_entries"`
	SyncedAt             time.Time `json:"synced_at"`
}

type clockifyStatusResp struct {
	Configured               bool                      `json:"configured"`
	WorkspaceID              string                    `json:"workspace_id,omitempty"`
	APIKeyMasked             string                    `json:"api_key_masked,omitempty"`
	LastSyncAt               *time.Time                `json:"last_sync_at,omitempty"`
	LastEntryStartAt         *time.Time                `json:"last_entry_start_at,omitempty"`
	LastEntryEndAt           *time.Time                `json:"last_entry_end_at,omitempty"`
	EntriesTotal             int64                     `json:"entries_total"`
	EntriesLast7Days         int64                     `json:"entries_last_7_days"`
	EntriesRunning           int64                     `json:"entries_running"`
	ActiveEmployees          int64                     `json:"active_employees"`
	MappedEmployees          int64                     `json:"mapped_employees"`
	ActiveUnmappedEmployees  int64                     `json:"active_unmapped_employees"`
	UnmappedEmployeesPreview []clockifyUnmappedPreview `json:"unmapped_employees_preview"`
}

type clockifyUnmappedPreview struct {
	EmployeeID uint64 `db:"employee_id" json:"employee_id"`
	Name       string `db:"name" json:"name"`
	Email      string `db:"email" json:"email"`
}

type clockifyTenantConnection struct {
	TenantID    uint64 `db:"tenant_id"`
	WorkspaceID string `db:"workspace_id"`
	APIKey      string `db:"api_key"`
}

type syncInternalError struct {
	Message string
	Err     error
}

func (e *syncInternalError) Error() string {
	return e.Message
}

func (e *syncInternalError) Unwrap() error {
	return e.Err
}

type HRTimeEntry struct {
	ID              uint64     `db:"id" json:"id"`
	TenantID        uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID      *uint64    `db:"employee_id" json:"employee_id,omitempty"`
	Source          string     `db:"source" json:"source"`
	ExternalEntryID string     `db:"external_entry_id" json:"external_entry_id"`
	ClockifyUserID  string     `db:"clockify_user_id" json:"clockify_user_id"`
	WorkspaceID     string     `db:"workspace_id" json:"workspace_id"`
	ProjectID       *string    `db:"project_id" json:"project_id,omitempty"`
	TaskID          *string    `db:"task_id" json:"task_id,omitempty"`
	Description     *string    `db:"description" json:"description,omitempty"`
	StartAt         time.Time  `db:"start_at" json:"start_at"`
	EndAt           *time.Time `db:"end_at" json:"end_at,omitempty"`
	DurationSeconds int64      `db:"duration_seconds" json:"duration_seconds"`
	IsRunning       bool       `db:"is_running" json:"is_running"`
	Billable        bool       `db:"billable" json:"billable"`
	SyncedAt        time.Time  `db:"synced_at" json:"synced_at"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type employeeIdentity struct {
	ID    uint64         `db:"id"`
	Email sql.NullString `db:"email"`
}

type clockifyUserLink struct {
	EmployeeID     uint64 `db:"employee_id"`
	ClockifyUserID string `db:"clockify_user_id"`
}

type clockifyUser struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type clockifyTimeInterval struct {
	Start    string `json:"start"`
	End      string `json:"end"`
	Duration string `json:"duration"`
}

type clockifyTimeEntry struct {
	ID           string               `json:"id"`
	Description  string               `json:"description"`
	ProjectID    string               `json:"projectId"`
	TaskID       string               `json:"taskId"`
	UserID       string               `json:"userId"`
	Billable     bool                 `json:"billable"`
	TagIDs       []string             `json:"tagIds"`
	TimeInterval clockifyTimeInterval `json:"timeInterval"`
}

type clockifyHTTPError struct {
	StatusCode int
	Message    string
}

func (e *clockifyHTTPError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("clockify status %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("clockify status %d", e.StatusCode)
}

type clockifyClient struct {
	baseURL string
	apiKey  string
	client  *http.Client

	maxAttempts int
	baseDelay   time.Duration
	maxDelay    time.Duration
}

func newClockifyClient(apiKey string) *clockifyClient {
	return &clockifyClient{
		baseURL: clockifyBaseURL,
		apiKey:  apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		maxAttempts: clockifyRequestAttempts,
		baseDelay:   clockifyRetryBaseDelay,
		maxDelay:    clockifyRetryMaxDelay,
	}
}

func (c *clockifyClient) getJSON(ctx context.Context, path string, query url.Values, dst any) error {
	u, err := url.Parse(c.baseURL + path)
	if err != nil {
		return err
	}
	if query != nil {
		u.RawQuery = query.Encode()
	}

	if c.maxAttempts < 1 {
		c.maxAttempts = 1
	}

	var lastErr error
	for attempt := 1; attempt <= c.maxAttempts; attempt++ {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
		if err != nil {
			return err
		}
		req.Header.Set("X-Api-Key", c.apiKey)
		req.Header.Set("Accept", "application/json")

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = err
			if c.shouldRetry(0, err, attempt) {
				delay := c.retryDelay(attempt, "")
				if sleepErr := sleepWithContext(ctx, delay); sleepErr != nil {
					return sleepErr
				}
				continue
			}
			return err
		}

		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
		resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			msg := strings.TrimSpace(string(body))
			if msg == "" {
				msg = http.StatusText(resp.StatusCode)
			}
			lastErr = &clockifyHTTPError{StatusCode: resp.StatusCode, Message: msg}
			if c.shouldRetry(resp.StatusCode, nil, attempt) {
				delay := c.retryDelay(attempt, resp.Header.Get("Retry-After"))
				if sleepErr := sleepWithContext(ctx, delay); sleepErr != nil {
					return sleepErr
				}
				continue
			}
			return lastErr
		}

		if len(body) == 0 {
			return nil
		}
		if err := json.Unmarshal(body, dst); err != nil {
			return err
		}
		return nil
	}

	if lastErr != nil {
		return lastErr
	}
	return fmt.Errorf("clockify request failed")
}

func (c *clockifyClient) shouldRetry(statusCode int, err error, attempt int) bool {
	if attempt >= c.maxAttempts {
		return false
	}
	if err != nil {
		return true
	}
	return statusCode == http.StatusTooManyRequests || statusCode >= http.StatusInternalServerError
}

func (c *clockifyClient) retryDelay(attempt int, retryAfter string) time.Duration {
	if d := parseRetryAfter(retryAfter); d > 0 {
		if c.maxDelay > 0 && d > c.maxDelay {
			return c.maxDelay
		}
		return d
	}

	delay := c.baseDelay
	if delay <= 0 {
		delay = 500 * time.Millisecond
	}
	if attempt > 1 {
		delay = delay * time.Duration(1<<(attempt-1))
	}
	if c.maxDelay > 0 && delay > c.maxDelay {
		return c.maxDelay
	}
	return delay
}

func parseRetryAfter(raw string) time.Duration {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0
	}
	if secs, err := strconv.Atoi(value); err == nil && secs >= 0 {
		return time.Duration(secs) * time.Second
	}
	if t, err := http.ParseTime(value); err == nil {
		if d := time.Until(t); d > 0 {
			return d
		}
	}
	return 0
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func (c *clockifyClient) ListUsers(ctx context.Context, workspaceID string) ([]clockifyUser, error) {
	users := make([]clockifyUser, 0, 256)
	page := 1
	pageSize := 200

	for {
		q := url.Values{}
		q.Set("page", strconv.Itoa(page))
		q.Set("page-size", strconv.Itoa(pageSize))

		var batch []clockifyUser
		if err := c.getJSON(ctx, "/workspaces/"+workspaceID+"/users", q, &batch); err != nil {
			return nil, err
		}
		users = append(users, batch...)
		if len(batch) < pageSize {
			break
		}
		page++
	}
	return users, nil
}

func (c *clockifyClient) ListTimeEntries(ctx context.Context, workspaceID, userID string, start, end time.Time) ([]clockifyTimeEntry, error) {
	entries := make([]clockifyTimeEntry, 0, 512)
	page := 1
	pageSize := 200

	for {
		q := url.Values{}
		q.Set("start", start.Format(time.RFC3339))
		q.Set("end", end.Format(time.RFC3339))
		q.Set("page", strconv.Itoa(page))
		q.Set("page-size", strconv.Itoa(pageSize))
		q.Set("hydrated", "false")

		var batch []clockifyTimeEntry
		path := "/workspaces/" + workspaceID + "/user/" + userID + "/time-entries"
		if err := c.getJSON(ctx, path, q, &batch); err != nil {
			return nil, err
		}
		entries = append(entries, batch...)
		if len(batch) < pageSize {
			break
		}
		page++
	}
	return entries, nil
}

func (h *HRHandler) GetClockifyConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	conn, found, err := h.getClockifyConnection(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if !found {
		writeJSON(w, http.StatusOK, clockifyConfigResp{Configured: false})
		return
	}
	createdAt := conn.CreatedAt
	updatedAt := conn.UpdatedAt
	writeJSON(w, http.StatusOK, clockifyConfigResp{
		Configured:   true,
		WorkspaceID:  conn.WorkspaceID,
		APIKeyMasked: maskSecret(conn.APIKey),
		CreatedAt:    &createdAt,
		UpdatedAt:    &updatedAt,
	})
}

func (h *HRHandler) GetClockifyStatus(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	conn, found, err := h.getClockifyConnection(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if !found {
		writeJSON(w, http.StatusOK, clockifyStatusResp{
			Configured:               false,
			UnmappedEmployeesPreview: []clockifyUnmappedPreview{},
		})
		return
	}

	var agg struct {
		LastSyncAt       sql.NullTime `db:"last_sync_at"`
		LastEntryStartAt sql.NullTime `db:"last_entry_start_at"`
		LastEntryEndAt   sql.NullTime `db:"last_entry_end_at"`
		EntriesTotal     int64        `db:"entries_total"`
		EntriesRunning   int64        `db:"entries_running"`
	}
	if err := h.DB.Get(&agg, `
		SELECT
			MAX(synced_at) AS last_sync_at,
			MAX(start_at) AS last_entry_start_at,
			MAX(end_at) AS last_entry_end_at,
			COUNT(*) AS entries_total,
			COALESCE(SUM(CASE WHEN is_running = 1 THEN 1 ELSE 0 END), 0) AS entries_running
		FROM hr_time_entries
		WHERE tenant_id=?
	`, tenantID); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	windowStart := dateOnly(time.Now().UTC().AddDate(0, 0, -7))
	var entriesLast7Days int64
	if err := h.DB.Get(&entriesLast7Days, `
		SELECT COUNT(*)
		FROM hr_time_entries
		WHERE tenant_id=? AND start_at>=?
	`, tenantID, windowStart); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	var mappedEmployees int64
	if err := h.DB.Get(&mappedEmployees, `
		SELECT COUNT(*)
		FROM hr_clockify_user_links
		WHERE tenant_id=?
	`, tenantID); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	var activeEmployees int64
	if err := h.DB.Get(&activeEmployees, `
		SELECT COUNT(*)
		FROM employees
		WHERE tenant_id=? AND status <> 'terminated'
	`, tenantID); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	var activeUnmappedEmployees int64
	if err := h.DB.Get(&activeUnmappedEmployees, `
		SELECT COUNT(*)
		FROM employees e
		LEFT JOIN hr_clockify_user_links l ON l.tenant_id=e.tenant_id AND l.employee_id=e.id
		WHERE e.tenant_id=? AND e.status <> 'terminated' AND l.employee_id IS NULL
	`, tenantID); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	unmapped := make([]clockifyUnmappedPreview, 0, statusUnmappedLimit)
	if err := h.DB.Select(&unmapped, `
		SELECT
			e.id AS employee_id,
			e.name,
			COALESCE(e.email, '') AS email
		FROM employees e
		LEFT JOIN hr_clockify_user_links l ON l.tenant_id=e.tenant_id AND l.employee_id=e.id
		WHERE e.tenant_id=? AND e.status <> 'terminated' AND l.employee_id IS NULL
		ORDER BY e.name ASC
		LIMIT ?
	`, tenantID, statusUnmappedLimit); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	resp := clockifyStatusResp{
		Configured:               true,
		WorkspaceID:              conn.WorkspaceID,
		APIKeyMasked:             maskSecret(conn.APIKey),
		EntriesTotal:             agg.EntriesTotal,
		EntriesLast7Days:         entriesLast7Days,
		EntriesRunning:           agg.EntriesRunning,
		ActiveEmployees:          activeEmployees,
		MappedEmployees:          mappedEmployees,
		ActiveUnmappedEmployees:  activeUnmappedEmployees,
		UnmappedEmployeesPreview: unmapped,
	}
	if agg.LastSyncAt.Valid {
		t := agg.LastSyncAt.Time
		resp.LastSyncAt = &t
	}
	if agg.LastEntryStartAt.Valid {
		t := agg.LastEntryStartAt.Time
		resp.LastEntryStartAt = &t
	}
	if agg.LastEntryEndAt.Valid {
		t := agg.LastEntryEndAt.Time
		resp.LastEntryEndAt = &t
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *HRHandler) UpsertClockifyConfig(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req upsertClockifyConfigReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	req.APIKey = strings.TrimSpace(req.APIKey)
	req.WorkspaceID = strings.TrimSpace(req.WorkspaceID)

	if req.APIKey == "" {
		httpError(w, "clockify api_key is required", http.StatusBadRequest)
		return
	}
	if req.WorkspaceID == "" {
		httpError(w, "clockify workspace_id is required", http.StatusBadRequest)
		return
	}

	client := newClockifyClient(req.APIKey)
	if _, err := client.ListUsers(r.Context(), req.WorkspaceID); err != nil {
		status := mapClockifyError(err)
		httpError(w, status.Message, status.HTTPStatus)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO hr_clockify_connections (tenant_id, workspace_id, api_key, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			workspace_id=VALUES(workspace_id),
			api_key=VALUES(api_key),
			updated_by=VALUES(updated_by),
			updated_at=CURRENT_TIMESTAMP
	`, tenantID, req.WorkspaceID, req.APIKey, userID, userID)
	if err != nil {
		httpError(w, "db update error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "upsert", "hr_clockify_connections", 0, nil, map[string]any{
		"workspace_id": req.WorkspaceID,
		"configured":   true,
	})

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	conn, found, err := h.getClockifyConnection(tenantID)
	if err != nil || !found {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	createdAt := conn.CreatedAt
	updatedAt := conn.UpdatedAt
	writeJSON(w, http.StatusOK, clockifyConfigResp{
		Configured:   true,
		WorkspaceID:  conn.WorkspaceID,
		APIKeyMasked: maskSecret(conn.APIKey),
		CreatedAt:    &createdAt,
		UpdatedAt:    &updatedAt,
	})
}

func (h *HRHandler) SyncClockifyEntries(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	role := mw.GetRole(r.Context())

	var req syncClockifyReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	startDate, endDate, err := parseDateRange(req.StartDate, req.EndDate)
	if err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	if req.AllowClosedPeriod && role != "hr" {
		httpError(w, "allow_closed_period only for hr", http.StatusForbidden)
		return
	}

	conn, found, err := h.getClockifyConnection(tenantID)
	if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	if !found {
		httpError(w, "clockify is not configured", http.StatusBadRequest)
		return
	}

	summary, err := h.syncClockifyTenant(r.Context(), tenantID, conn, startDate, endDate, req.AllowClosedPeriod)
	if err != nil {
		var internalErr *syncInternalError
		if errors.As(err, &internalErr) {
			httpError(w, internalErr.Message, http.StatusInternalServerError)
			return
		}
		status := mapClockifyError(err)
		httpError(w, status.Message, status.HTTPStatus)
		return
	}

	_ = insertAudit(h.DB, r, tenantID, userID, "sync", "hr_time_entries", 0, nil, map[string]any{
		"provider":               "clockify",
		"range_start":            summary.RangeStart,
		"range_end":              summary.RangeEnd,
		"users_found":            summary.UsersFound,
		"users_mapped":           summary.EmployeesMapped,
		"entries_processed":      summary.EntriesProcessed,
		"entries_upserted":       summary.EntriesUpserted,
		"entries_skipped_closed": summary.EntriesSkippedClosed,
		"allow_closed_period":    req.AllowClosedPeriod,
	})

	writeJSON(w, http.StatusOK, summary)
}

func (h *HRHandler) ListTimeEntries(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	limit := defaultTimeEntriesLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			httpError(w, "limit must be numeric", http.StatusBadRequest)
			return
		}
		if parsed > maxTimeEntriesLimit {
			parsed = maxTimeEntriesLimit
		}
		limit = parsed
	}

	var employeeID *uint64
	if raw := strings.TrimSpace(r.URL.Query().Get("employee_id")); raw != "" {
		id, err := strconv.ParseUint(raw, 10, 64)
		if err != nil {
			httpError(w, "employee_id must be numeric", http.StatusBadRequest)
			return
		}
		employeeID = &id
	}

	var startDate *time.Time
	if raw := strings.TrimSpace(r.URL.Query().Get("start_date")); raw != "" {
		parsed, err := parseDate(raw)
		if err != nil {
			httpError(w, "start_date must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		startDate = &parsed
	}

	var endDate *time.Time
	if raw := strings.TrimSpace(r.URL.Query().Get("end_date")); raw != "" {
		parsed, err := parseDate(raw)
		if err != nil {
			httpError(w, "end_date must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		endDate = &parsed
	}

	query := `
		SELECT id, tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
		       project_id, task_id, description, start_at, end_at, duration_seconds, is_running, billable,
		       synced_at, created_at, updated_at
		FROM hr_time_entries
		WHERE tenant_id=?
	`
	args := make([]any, 0, 6)
	args = append(args, tenantID)

	if employeeID != nil {
		query += " AND employee_id=?"
		args = append(args, *employeeID)
	}
	if startDate != nil {
		query += " AND start_at>=?"
		args = append(args, *startDate)
	}
	if endDate != nil {
		query += " AND start_at<?"
		args = append(args, endDate.Add(24*time.Hour))
	}
	query += " ORDER BY start_at DESC, id DESC LIMIT ?"
	args = append(args, limit)

	items := make([]HRTimeEntry, 0, limit)
	if err := h.DB.Select(&items, query, args...); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) RunClockifyAutoSync(ctx context.Context, lookbackDays int) {
	if lookbackDays < 1 {
		lookbackDays = 1
	}

	connections := make([]clockifyTenantConnection, 0, 64)
	if err := h.DB.Select(&connections, `
		SELECT tenant_id, workspace_id, api_key
		FROM hr_clockify_connections
		ORDER BY tenant_id ASC
	`); err != nil {
		log.Error().Err(err).Msg("clockify auto sync: could not load configured tenants")
		return
	}

	if len(connections) == 0 {
		log.Info().Msg("clockify auto sync: no configured tenants")
		return
	}

	now := time.Now().UTC()
	endDate := dateOnly(now)
	startDate := endDate.AddDate(0, 0, -lookbackDays)
	successCount := 0

	for _, item := range connections {
		summary, err := h.syncClockifyTenant(ctx, item.TenantID, clockifyConnection{
			WorkspaceID: item.WorkspaceID,
			APIKey:      item.APIKey,
		}, startDate, endDate, false)
		if err != nil {
			log.Error().
				Err(err).
				Uint64("tenant_id", item.TenantID).
				Msg("clockify auto sync: tenant sync failed")
			continue
		}

		successCount++
		log.Info().
			Uint64("tenant_id", item.TenantID).
			Int("entries_upserted", summary.EntriesUpserted).
			Int("entries_processed", summary.EntriesProcessed).
			Msg("clockify auto sync: tenant synchronized")

		_ = h.insertSystemSyncAudit(item.TenantID, summary, "sync_auto")
	}

	log.Info().
		Int("tenants_total", len(connections)).
		Int("tenants_success", successCount).
		Msg("clockify auto sync finished")
}

func StartClockifyAutoSyncScheduler(ctx context.Context, h *HRHandler, hourUTC, lookbackDays int) {
	if hourUTC < 0 || hourUTC > 23 {
		hourUTC = 3
	}
	if lookbackDays < 1 {
		lookbackDays = 1
	}

	h.RunClockifyAutoSync(ctx, lookbackDays)

	for {
		nextRun := nextRunAtUTCHour(time.Now().UTC(), hourUTC)
		wait := time.Until(nextRun)
		timer := time.NewTimer(wait)
		log.Info().
			Time("next_run_utc", nextRun).
			Msg("clockify auto sync scheduler waiting")

		select {
		case <-ctx.Done():
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			log.Info().Msg("clockify auto sync scheduler stopped")
			return
		case <-timer.C:
			h.RunClockifyAutoSync(ctx, lookbackDays)
		}
	}
}

func nextRunAtUTCHour(now time.Time, hourUTC int) time.Time {
	run := time.Date(now.Year(), now.Month(), now.Day(), hourUTC, 0, 0, 0, time.UTC)
	if !run.After(now) {
		run = run.Add(24 * time.Hour)
	}
	return run
}

func (h *HRHandler) insertSystemSyncAudit(tenantID uint64, summary clockifySyncResp, action string) error {
	after := map[string]any{
		"provider":               "clockify",
		"range_start":            summary.RangeStart,
		"range_end":              summary.RangeEnd,
		"users_found":            summary.UsersFound,
		"users_mapped":           summary.EmployeesMapped,
		"entries_processed":      summary.EntriesProcessed,
		"entries_upserted":       summary.EntriesUpserted,
		"entries_skipped_closed": summary.EntriesSkippedClosed,
	}

	_, err := h.DB.Exec(`
		INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, before_json, after_json, ip, user_agent)
		VALUES (?, NULL, ?, 'hr_time_entries', '0', NULL, ?, 'system', 'clockify-auto-sync')
	`, tenantID, action, nullableJSON(after))
	return err
}

func (h *HRHandler) syncClockifyTenant(
	ctx context.Context,
	tenantID uint64,
	conn clockifyConnection,
	startDate, endDate time.Time,
	allowClosedPeriod bool,
) (clockifySyncResp, error) {
	client := newClockifyClient(conn.APIKey)
	users, err := client.ListUsers(ctx, conn.WorkspaceID)
	if err != nil {
		return clockifySyncResp{}, err
	}

	employees := make([]employeeIdentity, 0, 256)
	if err := h.DB.Select(&employees, `
		SELECT id, email
		FROM employees
		WHERE tenant_id=? AND status <> 'terminated'
	`, tenantID); err != nil {
		return clockifySyncResp{}, &syncInternalError{Message: "db read error", Err: err}
	}

	links := make([]clockifyUserLink, 0, 256)
	if err := h.DB.Select(&links, `
		SELECT employee_id, clockify_user_id
		FROM hr_clockify_user_links
		WHERE tenant_id=?
	`, tenantID); err != nil {
		return clockifySyncResp{}, &syncInternalError{Message: "db read error", Err: err}
	}

	employeeByEmail := make(map[string]uint64, len(employees))
	for _, emp := range employees {
		if !emp.Email.Valid {
			continue
		}
		email := normalizeEmail(emp.Email.String)
		if email != "" {
			employeeByEmail[email] = emp.ID
		}
	}

	linkedByClockifyUser := make(map[string]uint64, len(links))
	for _, link := range links {
		linkedByClockifyUser[link.ClockifyUserID] = link.EmployeeID
	}

	now := time.Now().UTC()
	mappedUserIDs := make([]string, 0, len(users))
	mappedByUser := make(map[string]uint64, len(users))
	mappedEmployees := make(map[uint64]struct{})

	for _, user := range users {
		clockifyUserID := strings.TrimSpace(user.ID)
		if clockifyUserID == "" {
			continue
		}
		employeeID, ok := linkedByClockifyUser[clockifyUserID]
		if !ok {
			email := normalizeEmail(user.Email)
			if email == "" {
				continue
			}
			var byEmail bool
			employeeID, byEmail = employeeByEmail[email]
			if !byEmail {
				continue
			}
		}

		_, err := h.DB.Exec(`
			INSERT INTO hr_clockify_user_links (
				tenant_id, employee_id, clockify_user_id, clockify_user_name, clockify_user_email, last_synced_at
			) VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				employee_id=VALUES(employee_id),
				clockify_user_name=VALUES(clockify_user_name),
				clockify_user_email=VALUES(clockify_user_email),
				last_synced_at=VALUES(last_synced_at),
				updated_at=CURRENT_TIMESTAMP
		`, tenantID, employeeID, clockifyUserID, nullableTrimmed(user.Name), nullableTrimmed(user.Email), now)
		if err != nil {
			return clockifySyncResp{}, &syncInternalError{Message: "db update error", Err: err}
		}

		mappedUserIDs = append(mappedUserIDs, clockifyUserID)
		mappedByUser[clockifyUserID] = employeeID
		mappedEmployees[employeeID] = struct{}{}
	}

	apiStart := startDate
	apiEnd := endDate.Add(24 * time.Hour)
	entriesProcessed := 0
	entriesUpserted := 0
	entriesSkippedClosed := 0
	runningEntries := 0

	for _, clockifyUserID := range mappedUserIDs {
		employeeID := mappedByUser[clockifyUserID]
		entries, err := client.ListTimeEntries(ctx, conn.WorkspaceID, clockifyUserID, apiStart, apiEnd)
		if err != nil {
			return clockifySyncResp{}, err
		}

		for _, entry := range entries {
			entriesProcessed++
			if strings.TrimSpace(entry.ID) == "" {
				continue
			}

			startAt, err := parseClockifyTimestamp(entry.TimeInterval.Start)
			if err != nil {
				continue
			}
			if !allowClosedPeriod {
				closedDate := dateOnly(startAt.UTC())
				isClosed, closeErr := h.isDateClosedForTimeBank(tenantID, closedDate)
				if closeErr != nil {
					return clockifySyncResp{}, &syncInternalError{Message: "db read error", Err: closeErr}
				}
				if isClosed {
					entriesSkippedClosed++
					continue
				}
			}

			endAt, err := parseClockifyOptionalTimestamp(entry.TimeInterval.End)
			if err != nil {
				continue
			}
			isRunning := endAt == nil
			if isRunning {
				runningEntries++
			}

			durationSeconds := calcDurationSeconds(startAt, endAt, entry.TimeInterval.Duration, now)
			rawJSON, _ := json.Marshal(entry)
			tagJSON, _ := json.Marshal(entry.TagIDs)

			_, err = h.DB.Exec(`
				INSERT INTO hr_time_entries (
					tenant_id, employee_id, source, external_entry_id, clockify_user_id, workspace_id,
					project_id, task_id, description, tag_ids_json, start_at, end_at, duration_seconds,
					is_running, billable, raw_json, synced_at
				) VALUES (
					?, ?, 'clockify', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
				)
				ON DUPLICATE KEY UPDATE
					employee_id=VALUES(employee_id),
					project_id=VALUES(project_id),
					task_id=VALUES(task_id),
					description=VALUES(description),
					tag_ids_json=VALUES(tag_ids_json),
					start_at=VALUES(start_at),
					end_at=VALUES(end_at),
					duration_seconds=VALUES(duration_seconds),
					is_running=VALUES(is_running),
					billable=VALUES(billable),
					raw_json=VALUES(raw_json),
					synced_at=VALUES(synced_at),
					updated_at=CURRENT_TIMESTAMP
			`,
				tenantID,
				employeeID,
				entry.ID,
				entry.UserID,
				conn.WorkspaceID,
				nullableTrimmed(entry.ProjectID),
				nullableTrimmed(entry.TaskID),
				nullableTrimmed(entry.Description),
				tagJSON,
				startAt,
				endAt,
				durationSeconds,
				isRunning,
				entry.Billable,
				rawJSON,
				now,
			)
			if err != nil {
				return clockifySyncResp{}, &syncInternalError{Message: "db update error", Err: err}
			}
			entriesUpserted++
		}
	}

	return clockifySyncResp{
		RangeStart:           startDate.Format("2006-01-02"),
		RangeEnd:             endDate.Format("2006-01-02"),
		EmployeesTotal:       len(employees),
		UsersFound:           len(users),
		EmployeesMapped:      len(mappedEmployees),
		EntriesProcessed:     entriesProcessed,
		EntriesUpserted:      entriesUpserted,
		EntriesSkippedClosed: entriesSkippedClosed,
		RunningEntries:       runningEntries,
		SyncedAt:             now,
	}, nil
}

func (h *HRHandler) getClockifyConnection(tenantID uint64) (clockifyConnection, bool, error) {
	var conn clockifyConnection
	if err := h.DB.Get(&conn, `
		SELECT workspace_id, api_key, created_at, updated_at
		FROM hr_clockify_connections
		WHERE tenant_id=?
	`, tenantID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return clockifyConnection{}, false, nil
		}
		return clockifyConnection{}, false, err
	}
	return conn, true, nil
}

func parseDateRange(startRaw, endRaw string) (time.Time, time.Time, error) {
	var (
		start time.Time
		end   time.Time
		err   error
	)

	if strings.TrimSpace(startRaw) == "" {
		start = dateOnly(time.Now().UTC().AddDate(0, 0, -7))
	} else {
		start, err = parseDate(startRaw)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("start_date must be YYYY-MM-DD")
		}
	}

	if strings.TrimSpace(endRaw) == "" {
		end = dateOnly(time.Now().UTC())
	} else {
		end, err = parseDate(endRaw)
		if err != nil {
			return time.Time{}, time.Time{}, fmt.Errorf("end_date must be YYYY-MM-DD")
		}
	}

	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("end_date must be >= start_date")
	}
	return start, end, nil
}

func parseDate(raw string) (time.Time, error) {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, err
	}
	return dateOnly(t.UTC()), nil
}

func parseClockifyTimestamp(raw string) (time.Time, error) {
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(raw))
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}

func parseClockifyOptionalTimestamp(raw string) (*time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, nil
	}
	t, err := parseClockifyTimestamp(value)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func calcDurationSeconds(start time.Time, end *time.Time, isoDuration string, now time.Time) int64 {
	if end != nil {
		diff := end.Sub(start)
		if diff > 0 {
			return int64(diff.Seconds())
		}
		return 0
	}

	if fromISO := parseISODurationSeconds(isoDuration); fromISO > 0 {
		return fromISO
	}

	diff := now.Sub(start)
	if diff > 0 {
		return int64(diff.Seconds())
	}
	return 0
}

func parseISODurationSeconds(raw string) int64 {
	match := isoDurationRE.FindStringSubmatch(strings.TrimSpace(raw))
	if len(match) == 0 {
		return 0
	}
	var total int64
	if match[1] != "" {
		hours, _ := strconv.ParseInt(match[1], 10, 64)
		total += hours * 3600
	}
	if match[2] != "" {
		minutes, _ := strconv.ParseInt(match[2], 10, 64)
		total += minutes * 60
	}
	if match[3] != "" {
		seconds, _ := strconv.ParseInt(match[3], 10, 64)
		total += seconds
	}
	return total
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func nullableTrimmed(v string) any {
	trimmed := strings.TrimSpace(v)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func maskSecret(value string) string {
	if value == "" {
		return ""
	}
	if len(value) <= 8 {
		return strings.Repeat("*", len(value))
	}
	return value[:4] + strings.Repeat("*", len(value)-8) + value[len(value)-4:]
}

type mappedClockifyErr struct {
	HTTPStatus int
	Message    string
}

func mapClockifyError(err error) mappedClockifyErr {
	var reqErr *clockifyHTTPError
	if errors.As(err, &reqErr) {
		switch reqErr.StatusCode {
		case http.StatusUnauthorized, http.StatusForbidden:
			return mappedClockifyErr{
				HTTPStatus: http.StatusBadRequest,
				Message:    "clockify api key is invalid",
			}
		case http.StatusNotFound:
			return mappedClockifyErr{
				HTTPStatus: http.StatusBadRequest,
				Message:    "clockify workspace not found",
			}
		case http.StatusTooManyRequests:
			return mappedClockifyErr{
				HTTPStatus: http.StatusTooManyRequests,
				Message:    "clockify rate limit exceeded",
			}
		default:
			return mappedClockifyErr{
				HTTPStatus: http.StatusBadGateway,
				Message:    "clockify request failed",
			}
		}
	}
	return mappedClockifyErr{
		HTTPStatus: http.StatusBadGateway,
		Message:    "clockify connection failed",
	}
}
