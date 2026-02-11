package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	mw "saas-api/internal/http/middleware"
)

func withAuthCtx(ctx context.Context, tenantID, userID uint64) context.Context {
	ctx = context.WithValue(ctx, mw.CtxTenantID, tenantID)
	ctx = context.WithValue(ctx, mw.CtxUserID, userID)
	ctx = context.WithValue(ctx, mw.CtxRole, "owner")
	return ctx
}

func TestClockInSuccess(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	h := &HRHandler{DB: sqlxDB}

	tenantID := uint64(1)
	userID := uint64(2)
	employeeID := uint64(3)
	tsStr := "2026-02-11T10:00:00Z"
	ts, _ := time.Parse(time.RFC3339, tsStr)

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT status FROM employees").
		WithArgs(tenantID, employeeID).
		WillReturnRows(sqlmock.NewRows([]string{"status"}).AddRow("active"))
	mock.ExpectQuery("SELECT id FROM time_entries").
		WithArgs(tenantID, employeeID).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectExec("INSERT INTO time_entries").
		WithArgs(tenantID, employeeID, ts, sqlmock.AnyArg(), userID, userID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries").
		WithArgs(tenantID, int64(1)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "employee_id", "clock_in", "clock_out", "note_in", "note_out", "created_at", "updated_at",
		}).AddRow(1, tenantID, employeeID, ts, nil, nil, nil, ts, ts))
	mock.ExpectExec("INSERT INTO audit_logs").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	body := `{"employee_id":3,"timestamp":"` + tsStr + `"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/time-entries/clock-in", bytes.NewBufferString(body))
	req = req.WithContext(withAuthCtx(req.Context(), tenantID, userID))

	rr := httptest.NewRecorder()
	h.ClockIn(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d, body=%s", rr.Code, rr.Body.String())
	}

	var got TimeEntry
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.EmployeeID != employeeID {
		t.Fatalf("employee_id mismatch: want %d got %d", employeeID, got.EmployeeID)
	}
	if !got.ClockIn.Equal(ts) {
		t.Fatalf("clock_in mismatch: want %s got %s", ts, got.ClockIn)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestClockOutSuccess(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	sqlxDB := sqlx.NewDb(db, "sqlmock")
	h := &HRHandler{DB: sqlxDB}

	tenantID := uint64(1)
	userID := uint64(2)
	employeeID := uint64(3)
	clockIn := time.Date(2026, 2, 11, 9, 0, 0, 0, time.UTC)
	clockOut := time.Date(2026, 2, 11, 18, 0, 0, 0, time.UTC)

	mock.ExpectBegin()
	mock.ExpectQuery("FROM time_entries\\s+WHERE tenant_id=\\? AND employee_id=\\? AND clock_out IS NULL").
		WithArgs(tenantID, employeeID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "employee_id", "clock_in", "clock_out", "note_in", "note_out", "created_at", "updated_at",
		}).AddRow(10, tenantID, employeeID, clockIn, nil, nil, nil, clockIn, clockIn))
	mock.ExpectExec("UPDATE time_entries").
		WithArgs(clockOut, nil, userID, tenantID, uint64(10)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries").
		WithArgs(tenantID, uint64(10)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "employee_id", "clock_in", "clock_out", "note_in", "note_out", "created_at", "updated_at",
		}).AddRow(10, tenantID, employeeID, clockIn, clockOut, nil, nil, clockIn, clockOut))
	mock.ExpectExec("INSERT INTO audit_logs").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	body := `{"employee_id":3,"timestamp":"` + clockOut.Format(time.RFC3339) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/time-entries/clock-out", bytes.NewBufferString(body))
	req = req.WithContext(withAuthCtx(req.Context(), tenantID, userID))

	rr := httptest.NewRecorder()
	h.ClockOut(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body=%s", rr.Code, rr.Body.String())
	}

	var got TimeEntry
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.ID != 10 || got.EmployeeID != employeeID {
		t.Fatalf("unexpected entry: %+v", got)
	}
	if got.ClockOut == nil || !got.ClockOut.Equal(clockOut) {
		t.Fatalf("clock_out mismatch: want %s got %v", clockOut, got.ClockOut)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestListTimeEntriesWithFilters(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	sqlxDB := sqlx.NewDb(db, "sqlmock")
	h := &HRHandler{DB: sqlxDB}

	tenantID := uint64(1)
	userID := uint64(2)
	employeeID := uint64(3)
	from := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 2, 28, 0, 0, 0, 0, time.UTC).Add(24 * time.Hour)

	mock.ExpectQuery("SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries").
		WithArgs(tenantID, employeeID, from, to).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "employee_id", "clock_in", "clock_out", "note_in", "note_out", "created_at", "updated_at",
		}).AddRow(1, tenantID, employeeID, from, nil, nil, nil, from, from))

	req := httptest.NewRequest(http.MethodGet, "/v1/time-entries?employee_id=3&from=2026-02-01&to=2026-02-28", nil)
	req = req.WithContext(withAuthCtx(req.Context(), tenantID, userID))

	rr := httptest.NewRecorder()
	h.ListTimeEntries(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d, body=%s", rr.Code, rr.Body.String())
	}

	var items []TimeEntry
	if err := json.NewDecoder(rr.Body).Decode(&items); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(items) != 1 || items[0].EmployeeID != employeeID {
		t.Fatalf("unexpected list: %+v", items)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
