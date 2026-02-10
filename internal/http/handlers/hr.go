package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"

	mw "saas-api/internal/http/middleware"
)

type HRHandler struct {
	DB *sqlx.DB
}

type Department struct {
	ID        uint64     `db:"id" json:"id"`
	TenantID  uint64     `db:"tenant_id" json:"tenant_id"`
	Name      string     `db:"name" json:"name"`
	Code      *string    `db:"code" json:"code,omitempty"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt time.Time  `db:"updated_at" json:"updated_at"`
}

type Position struct {
	ID           uint64     `db:"id" json:"id"`
	TenantID     uint64     `db:"tenant_id" json:"tenant_id"`
	DepartmentID *uint64    `db:"department_id" json:"department_id,omitempty"`
	Title        string     `db:"title" json:"title"`
	Level        *string    `db:"level" json:"level,omitempty"`
	CreatedAt    time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `db:"updated_at" json:"updated_at"`
}

type Employee struct {
	ID              uint64     `db:"id" json:"id"`
	TenantID        uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeCode    string     `db:"employee_code" json:"employee_code"`
	Name            string     `db:"name" json:"name"`
	Email           *string    `db:"email" json:"email,omitempty"`
	Status          string     `db:"status" json:"status"`
	HireDate        *time.Time `db:"hire_date" json:"hire_date,omitempty"`
	TerminationDate *time.Time `db:"termination_date" json:"termination_date,omitempty"`
	DepartmentID    *uint64    `db:"department_id" json:"department_id,omitempty"`
	PositionID      *uint64    `db:"position_id" json:"position_id,omitempty"`
	SalaryCents     int64      `db:"salary_cents" json:"salary_cents"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type createDepartmentReq struct {
	Name string  `json:"name"`
	Code *string `json:"code"`
}
type createPositionReq struct {
	Title        string  `json:"title"`
	Level        *string `json:"level"`
	DepartmentID *uint64 `json:"department_id"`
}
type createEmployeeReq struct {
	Name         string  `json:"name"`
	Email        *string `json:"email"`
	Status       *string `json:"status"`        // active/inactive/terminated
	HireDate     *string `json:"hire_date"`     // YYYY-MM-DD
	SalaryCents  *int64  `json:"salary_cents"`  // inteiro em centavos
	DepartmentID *uint64 `json:"department_id"`
	PositionID   *uint64 `json:"position_id"`
}

func (h *HRHandler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createDepartmentReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.Code != nil {
		c := strings.TrimSpace(*req.Code)
		if c == "" {
			req.Code = nil
		} else {
			req.Code = &c
		}
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO departments (tenant_id, name, code, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?)`,
		tenantID, req.Name, req.Code, userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create department (name/code may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var dept Department
	if err := tx.Get(&dept, `SELECT id, tenant_id, name, code, created_at, updated_at FROM departments WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "departments", id64, nil, dept)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, dept)
}

func (h *HRHandler) ListDepartments(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var items []Department
	if err := h.DB.Select(&items, `SELECT id, tenant_id, name, code, created_at, updated_at FROM departments WHERE tenant_id=? ORDER BY name ASC`, tenantID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreatePosition(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createPositionReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		http.Error(w, "title is required", http.StatusBadRequest)
		return
	}
	if req.Level != nil {
		l := strings.TrimSpace(*req.Level)
		if l == "" {
			req.Level = nil
		} else {
			req.Level = &l
		}
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO positions (tenant_id, department_id, title, level, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		tenantID, req.DepartmentID, req.Title, req.Level, userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create position (title may exist, or invalid department_id)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var pos Position
	if err := tx.Get(&pos, `SELECT id, tenant_id, department_id, title, level, created_at, updated_at FROM positions WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "positions", id64, nil, pos)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, pos)
}

func (h *HRHandler) ListPositions(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var items []Position
	if err := h.DB.Select(&items, `SELECT id, tenant_id, department_id, title, level, created_at, updated_at FROM positions WHERE tenant_id=? ORDER BY title ASC`, tenantID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createEmployeeReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.Email != nil {
		e := strings.TrimSpace(strings.ToLower(*req.Email))
		if e == "" {
			req.Email = nil
		} else {
			req.Email = &e
		}
	}

	status := "active"
	if req.Status != nil && strings.TrimSpace(*req.Status) != "" {
		status = strings.TrimSpace(strings.ToLower(*req.Status))
	}
	if status != "active" && status != "inactive" && status != "terminated" {
		http.Error(w, "status must be active|inactive|terminated", http.StatusBadRequest)
		return
	}

	var hireDate *time.Time
	if req.HireDate != nil && strings.TrimSpace(*req.HireDate) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.HireDate))
		if err != nil {
			http.Error(w, "hire_date must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		hireDate = &t
	}

	salary := int64(0)
	if req.SalaryCents != nil {
		salary = *req.SalaryCents
		if salary < 0 {
			http.Error(w, "salary_cents must be >= 0", http.StatusBadRequest)
			return
		}
	}

	empCode := genCode("EMP")

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO employees (
			tenant_id, employee_code, name, email, status, hire_date,
			department_id, position_id, salary_cents, created_by, updated_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empCode, req.Name, req.Email, status, hireDate,
		req.DepartmentID, req.PositionID, salary, userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create employee (invalid dept/position?)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var emp Employee
	if err := tx.Get(&emp, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, salary_cents, created_at, updated_at
		FROM employees
		WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		http.Error(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "employees", id64, nil, emp)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, emp)
}

func (h *HRHandler) ListEmployees(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	// filtros simples via querystring
	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status != "" && status != "active" && status != "inactive" && status != "terminated" {
		http.Error(w, "status filter must be active|inactive|terminated", http.StatusBadRequest)
		return
	}

	var items []Employee
	if status == "" {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
			       department_id, position_id, salary_cents, created_at, updated_at
			FROM employees
			WHERE tenant_id=?
			ORDER BY id DESC`, tenantID); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
			       department_id, position_id, salary_cents, created_at, updated_at
			FROM employees
			WHERE tenant_id=? AND status=?
			ORDER BY id DESC`, tenantID, status); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, items)
}

/* ---------------- helpers ---------------- */

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

func genCode(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func insertAudit(exec sqlx.Ext, r *http.Request, tenantID, userID uint64, action, entity string, entityID int64, before any, after any) error {
	var beforeJSON any = nil
	var afterJSON any = nil

	if before != nil {
		b, _ := json.Marshal(before)
		beforeJSON = json.RawMessage(b)
	}
	if after != nil {
		a, _ := json.Marshal(after)
		afterJSON = json.RawMessage(a)
	}

	ip := r.RemoteAddr
	ua := r.UserAgent()

	_, err := exec.Exec(`
		INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, before_json, after_json, ip, user_agent)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, userID, action, entity, entityID,
		nullableJSON(beforeJSON), nullableJSON(afterJSON),
		ip, ua,
	)
	return err
}

func nullableJSON(v any) any {
	if v == nil {
		return sql.NullString{}
	}
	// mysql driver aceita []byte/string/json.RawMessage
	switch vv := v.(type) {
	case json.RawMessage:
		return []byte(vv)
	default:
		b, _ := json.Marshal(vv)
		return b
	}
}
