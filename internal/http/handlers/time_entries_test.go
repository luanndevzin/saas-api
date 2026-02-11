package handlers

import (
	"bytes"
	"context"
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

func TestTimeEntryCreate(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	sqlxDB := sqlx.NewDb(db, "sqlmock")
	h := &TimeEntryHandler{DB: sqlxDB}

	tenantID := uint64(1)
	userID := uint64(2)
	employeeID := uint64(3)
	tsStr := "2026-02-11T10:00:00Z"
	ts, _ := time.Parse(time.RFC3339, tsStr)

	mock.ExpectQuery("SELECT 1 FROM employees").
		WithArgs(tenantID, employeeID).
		WillReturnRows(sqlmock.NewRows([]string{"1"}).AddRow(1))
	mock.ExpectExec("INSERT INTO time_entries").
		WithArgs(tenantID, employeeID, ts, nil, nil, nil, userID, userID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries").
		WithArgs(tenantID, int64(1)).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "employee_id", "clock_in", "clock_out", "note_in", "note_out", "created_at", "updated_at",
		}).AddRow(1, tenantID, employeeID, ts, nil, nil, nil, ts, ts))

	body := `{"employee_id":3,"clock_in":"` + tsStr + `"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/time-entries", bytes.NewBufferString(body))
	req = req.WithContext(withAuthCtx(req.Context(), tenantID, userID))

	rr := httptest.NewRecorder()
	h.Create(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d, body=%s", rr.Code, rr.Body.String())
	}

	var got TimeEntry
	if err := json.NewDecoder(rr.Body).Decode(&got); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if got.EmployeeID != employeeID || !got.ClockIn.Equal(ts) {
		t.Fatalf("unexpected entry: %+v", got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestTimeEntryListWithFilters(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()
	sqlxDB := sqlx.NewDb(db, "sqlmock")
	h := &TimeEntryHandler{DB: sqlxDB}

	tenantID := uint64(1)
	userID := uint64(2)
	employeeID := uint64(3)
	from := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 2, 28, 0, 0, 0, 0, time.UTC)

	mock.ExpectQuery("SELECT id, tenant_id, employee_id, clock_in, clock_out, note_in, note_out, created_at, updated_at FROM time_entries").
		WithArgs(tenantID, employeeID, from, to).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "tenant_id", "employee_id", "clock_in", "clock_out", "note_in", "note_out", "created_at", "updated_at",
		}).AddRow(1, tenantID, employeeID, from, nil, nil, nil, from, from))

	req := httptest.NewRequest(http.MethodGet, "/v1/time-entries?employee_id=3&from=2026-02-01&to=2026-02-28", nil)
	req = req.WithContext(withAuthCtx(req.Context(), tenantID, userID))

	rr := httptest.NewRecorder()
	h.List(rr, req)

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
