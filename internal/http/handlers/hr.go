package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jmoiron/sqlx"

	mw "saas-api/internal/http/middleware"
)

type HRHandler struct {
	DB *sqlx.DB
}

type Department struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Code      *string   `db:"code" json:"code,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type Position struct {
	ID           uint64    `db:"id" json:"id"`
	TenantID     uint64    `db:"tenant_id" json:"tenant_id"`
	DepartmentID *uint64   `db:"department_id" json:"department_id,omitempty"`
	Title        string    `db:"title" json:"title"`
	Level        *string   `db:"level" json:"level,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
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
	ManagerID       *uint64    `db:"manager_id" json:"manager_id,omitempty"`
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
	Status       *string `json:"status"`       // active/inactive/terminated
	HireDate     *string `json:"hire_date"`    // YYYY-MM-DD
	SalaryCents  *int64  `json:"salary_cents"` // inteiro em centavos
	DepartmentID *uint64 `json:"department_id"`
	PositionID   *uint64 `json:"position_id"`
	ManagerID    *uint64 `json:"manager_id"`
}

type updateEmployeeReq struct {
	Name            *string `json:"name"`
	Email           *string `json:"email"`
	Status          *string `json:"status"`
	HireDate        *string `json:"hire_date"`
	TerminationDate *string `json:"termination_date"`
	DepartmentID    *uint64 `json:"department_id"`
	PositionID      *uint64 `json:"position_id"`
	ManagerID       *uint64 `json:"manager_id"`
	SalaryCents     *int64  `json:"salary_cents"`
}

type updateEmployeeStatusReq struct {
	Status          string  `json:"status"`
	TerminationDate *string `json:"termination_date"` // YYYY-MM-DD opcional
}

type EmployeeCompensation struct {
	ID             uint64    `db:"id" json:"id"`
	TenantID       uint64    `db:"tenant_id" json:"tenant_id"`
	EmployeeID     uint64    `db:"employee_id" json:"employee_id"`
	EffectiveAt    time.Time `db:"effective_at" json:"effective_at"`
	SalaryCents    int64     `db:"salary_cents" json:"salary_cents"`
	AdjustmentType *string   `db:"adjustment_type" json:"adjustment_type,omitempty"`
	Note           *string   `db:"note" json:"note,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	CreatedBy      *uint64   `db:"created_by" json:"created_by,omitempty"`
}

type createCompensationReq struct {
	EffectiveAt    string  `json:"effective_at"`              // YYYY-MM-DD
	SalaryCents    int64   `json:"salary_cents"`              // >=0
	AdjustmentType *string `json:"adjustment_type,omitempty"` // promoção, mérito, correção, etc
	Note           *string `json:"note,omitempty"`
}

type Location struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Code      *string   `db:"code" json:"code,omitempty"`
	Kind      *string   `db:"kind" json:"kind,omitempty"`
	Country   *string   `db:"country" json:"country,omitempty"`
	State     *string   `db:"state" json:"state,omitempty"`
	City      *string   `db:"city" json:"city,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type createLocationReq struct {
	Name    string  `json:"name"`
	Code    *string `json:"code"`
	Kind    *string `json:"kind"`    // office, remote, warehouse, etc
	Country *string `json:"country"` // ISO ou texto
	State   *string `json:"state"`
	City    *string `json:"city"`
}

type Team struct {
	ID                uint64    `db:"id" json:"id"`
	TenantID          uint64    `db:"tenant_id" json:"tenant_id"`
	Name              string    `db:"name" json:"name"`
	DepartmentID      *uint64   `db:"department_id" json:"department_id,omitempty"`
	ManagerEmployeeID *uint64   `db:"manager_employee_id" json:"manager_employee_id,omitempty"`
	LocationID        *uint64   `db:"location_id" json:"location_id,omitempty"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}

type createTeamReq struct {
	Name              string  `json:"name"`
	DepartmentID      *uint64 `json:"department_id"`
	ManagerEmployeeID *uint64 `json:"manager_employee_id"`
	LocationID        *uint64 `json:"location_id"`
}

type TimeOffType struct {
	ID               uint64    `db:"id" json:"id"`
	TenantID         uint64    `db:"tenant_id" json:"tenant_id"`
	Name             string    `db:"name" json:"name"`
	Description      *string   `db:"description" json:"description,omitempty"`
	RequiresApproval bool      `db:"requires_approval" json:"requires_approval"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time `db:"updated_at" json:"updated_at"`
}

type createTimeOffTypeReq struct {
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	RequiresApproval *bool   `json:"requires_approval"`
}

type TimeOffRequest struct {
	ID         uint64     `db:"id" json:"id"`
	TenantID   uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID uint64     `db:"employee_id" json:"employee_id"`
	TypeID     uint64     `db:"type_id" json:"type_id"`
	Status     string     `db:"status" json:"status"`
	StartDate  time.Time  `db:"start_date" json:"start_date"`
	EndDate    time.Time  `db:"end_date" json:"end_date"`
	Reason     *string    `db:"reason" json:"reason,omitempty"`
	Decision   *string    `db:"decision_note" json:"decision_note,omitempty"`
	ApproverID *uint64    `db:"approver_id" json:"approver_id,omitempty"`
	ReviewedAt *time.Time `db:"reviewed_at" json:"reviewed_at,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
}

type createTimeOffRequestReq struct {
	EmployeeID uint64  `json:"employee_id"`
	TypeID     uint64  `json:"type_id"`
	StartDate  string  `json:"start_date"` // YYYY-MM-DD
	EndDate    string  `json:"end_date"`   // YYYY-MM-DD
	Reason     *string `json:"reason"`
}

type decisionReq struct {
	Note *string `json:"note"`
}

type Benefit struct {
	ID            uint64    `db:"id" json:"id"`
	TenantID      uint64    `db:"tenant_id" json:"tenant_id"`
	Name          string    `db:"name" json:"name"`
	Provider      *string   `db:"provider" json:"provider,omitempty"`
	CostCents     int64     `db:"cost_cents" json:"cost_cents"`
	CoverageLevel *string   `db:"coverage_level" json:"coverage_level,omitempty"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type createBenefitReq struct {
	Name          string  `json:"name"`
	Provider      *string `json:"provider"`
	CostCents     *int64  `json:"cost_cents"`
	CoverageLevel *string `json:"coverage_level"`
}

type employeeBenefitReq struct {
	BenefitID     uint64  `json:"benefit_id"`
	EffectiveDate *string `json:"effective_date"` // opcional
}

type EmployeeBenefit struct {
	BenefitID     uint64     `db:"benefit_id" json:"benefit_id"`
	EmployeeID    uint64     `db:"employee_id" json:"employee_id"`
	EffectiveDate *time.Time `db:"effective_date" json:"effective_date,omitempty"`
	Name          string     `db:"name" json:"name"`
	Provider      *string    `db:"provider" json:"provider,omitempty"`
	CoverageLevel *string    `db:"coverage_level" json:"coverage_level,omitempty"`
	CostCents     int64      `db:"cost_cents" json:"cost_cents"`
}

type EmployeeDocument struct {
	ID         uint64     `db:"id" json:"id"`
	TenantID   uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID uint64     `db:"employee_id" json:"employee_id"`
	DocType    string     `db:"doc_type" json:"doc_type"`
	FileName   *string    `db:"file_name" json:"file_name,omitempty"`
	FileURL    string     `db:"file_url" json:"file_url"`
	ExpiresAt  *time.Time `db:"expires_at" json:"expires_at,omitempty"`
	Note       *string    `db:"note" json:"note,omitempty"`
	UploadedBy *uint64    `db:"uploaded_by" json:"uploaded_by,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}

type createEmployeeDocumentReq struct {
	DocType   string  `json:"doc_type"`
	FileName  *string `json:"file_name"`
	FileURL   string  `json:"file_url"`
	ExpiresAt *string `json:"expires_at"` // YYYY-MM-DD
	Note      *string `json:"note"`
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

	managerID := req.ManagerID

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
			department_id, position_id, manager_id, salary_cents, created_by, updated_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empCode, req.Name, req.Email, status, hireDate,
		req.DepartmentID, req.PositionID, managerID, salary, userID, userID,
	)
	if err != nil {
		http.Error(w, "could not create employee (invalid dept/position?)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var emp Employee
	if err := tx.Get(&emp, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
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
			       department_id, position_id, manager_id, salary_cents, created_at, updated_at
			FROM employees
			WHERE tenant_id=?
			ORDER BY id DESC`, tenantID); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
			       department_id, position_id, manager_id, salary_cents, created_at, updated_at
			FROM employees
			WHERE tenant_id=? AND status=?
			ORDER BY id DESC`, tenantID, status); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) GetEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var emp Employee
	if err := h.DB.Get(&emp, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees
		WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, emp)
}

func (h *HRHandler) UpdateEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req updateEmployeeReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before Employee
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}

	after := before

	if req.Name != nil {
		after.Name = strings.TrimSpace(*req.Name)
		if after.Name == "" {
			http.Error(w, "name cannot be empty", http.StatusBadRequest)
			return
		}
	}
	if req.Email != nil {
		after.Email = cleanPtrLower(req.Email)
	}
	if req.HireDate != nil {
		if strings.TrimSpace(*req.HireDate) == "" {
			after.HireDate = nil
		} else {
			t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.HireDate))
			if err != nil {
				http.Error(w, "hire_date must be YYYY-MM-DD", http.StatusBadRequest)
				return
			}
			after.HireDate = &t
		}
	}
	if req.TerminationDate != nil {
		if strings.TrimSpace(*req.TerminationDate) == "" {
			after.TerminationDate = nil
		} else {
			t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.TerminationDate))
			if err != nil {
				http.Error(w, "termination_date must be YYYY-MM-DD", http.StatusBadRequest)
				return
			}
			after.TerminationDate = &t
		}
	}
	if req.Status != nil {
		s := strings.TrimSpace(strings.ToLower(*req.Status))
		if s != "active" && s != "inactive" && s != "terminated" {
			http.Error(w, "status must be active|inactive|terminated", http.StatusBadRequest)
			return
		}
		after.Status = s
		if s != "terminated" {
			after.TerminationDate = nil
		} else if after.TerminationDate == nil {
			td := dateOnly(time.Now().UTC())
			after.TerminationDate = &td
		}
	}
	if req.DepartmentID != nil {
		after.DepartmentID = req.DepartmentID
	}
	if req.PositionID != nil {
		after.PositionID = req.PositionID
	}
	if req.ManagerID != nil {
		after.ManagerID = req.ManagerID
	}
	if req.SalaryCents != nil {
		if *req.SalaryCents < 0 {
			http.Error(w, "salary_cents must be >= 0", http.StatusBadRequest)
			return
		}
		after.SalaryCents = *req.SalaryCents
	}

	if _, err := tx.Exec(`
		UPDATE employees
		SET name=?, email=?, status=?, hire_date=?, termination_date=?,
		    department_id=?, position_id=?, manager_id=?, salary_cents=?, updated_by=?
		WHERE tenant_id=? AND id=?`,
		after.Name, after.Email, after.Status, after.HireDate, after.TerminationDate,
		after.DepartmentID, after.PositionID, after.ManagerID, after.SalaryCents, userID,
		tenantID, id,
	); err != nil {
		http.Error(w, "db update error", http.StatusInternalServerError)
		return
	}

	var persisted Employee
	_ = tx.Get(&persisted, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "employees", int64(id), before, persisted)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, persisted)
}

func (h *HRHandler) UpdateEmployeeStatus(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	idStr := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req updateEmployeeStatusReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Status = strings.TrimSpace(strings.ToLower(req.Status))
	if req.Status != "active" && req.Status != "inactive" && req.Status != "terminated" {
		http.Error(w, "status must be active|inactive|terminated", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before Employee
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}

	var terminationDate *time.Time
	if req.Status == "terminated" {
		if req.TerminationDate != nil && strings.TrimSpace(*req.TerminationDate) != "" {
			t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.TerminationDate))
			if err != nil {
				http.Error(w, "termination_date must be YYYY-MM-DD", http.StatusBadRequest)
				return
			}
			terminationDate = &t
		} else {
			td := dateOnly(time.Now().UTC())
			terminationDate = &td
		}
	}

	if _, err := tx.Exec(`
		UPDATE employees SET status=?, termination_date=?, updated_by=? WHERE tenant_id=? AND id=?`,
		req.Status, terminationDate, userID, tenantID, id); err != nil {
		http.Error(w, "db update error", http.StatusInternalServerError)
		return
	}

	var after Employee
	_ = tx.Get(&after, `
		SELECT id, tenant_id, employee_code, name, email, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "employees", int64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, after)
}

func (h *HRHandler) CreateCompensation(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	idStr := chi.URLParam(r, "id")
	empID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req createCompensationReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.EffectiveAt = strings.TrimSpace(req.EffectiveAt)
	if req.EffectiveAt == "" {
		http.Error(w, "effective_at is required", http.StatusBadRequest)
		return
	}
	eff, err := time.Parse("2006-01-02", req.EffectiveAt)
	if err != nil {
		http.Error(w, "effective_at must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if req.SalaryCents < 0 {
		http.Error(w, "salary_cents must be >= 0", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var empExists int
	if err := tx.Get(&empExists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, empID); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO employee_compensations (tenant_id, employee_id, effective_at, salary_cents, adjustment_type, note, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empID, eff, req.SalaryCents, cleanPtr(req.AdjustmentType), cleanPtr(req.Note), userID)
	if err != nil {
		http.Error(w, "could not create compensation", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var comp EmployeeCompensation
	_ = tx.Get(&comp, `
		SELECT id, tenant_id, employee_id, effective_at, salary_cents, adjustment_type, note, created_at, created_by
		FROM employee_compensations
		WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "employee_compensations", id64, nil, comp)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, comp)
}

func (h *HRHandler) ListCompensations(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	idStr := chi.URLParam(r, "id")
	empID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	items := make([]EmployeeCompensation, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, employee_id, effective_at, salary_cents, adjustment_type, note, created_at, created_by
		FROM employee_compensations
		WHERE tenant_id=? AND employee_id=?
		ORDER BY effective_at ASC, id ASC`, tenantID, empID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateLocation(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createLocationReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO locations (tenant_id, name, code, kind, country, state, city, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Code), cleanPtr(req.Kind), cleanPtr(req.Country),
		cleanPtr(req.State), cleanPtr(req.City), userID, userID)
	if err != nil {
		http.Error(w, "could not create location (name/code may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var loc Location
	_ = tx.Get(&loc, `
		SELECT id, tenant_id, name, code, kind, country, state, city, created_at, updated_at
		FROM locations WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "locations", id64, nil, loc)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, loc)
}

func (h *HRHandler) ListLocations(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	items := make([]Location, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, name, code, kind, country, state, city, created_at, updated_at
		FROM locations
		WHERE tenant_id=?
		ORDER BY name ASC`, tenantID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTeamReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO teams (tenant_id, name, department_id, manager_employee_id, location_id, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, req.DepartmentID, req.ManagerEmployeeID, req.LocationID, userID, userID)
	if err != nil {
		http.Error(w, "could not create team (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var team Team
	_ = tx.Get(&team, `
		SELECT id, tenant_id, name, department_id, manager_employee_id, location_id, created_at, updated_at
		FROM teams WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "teams", id64, nil, team)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, team)
}

func (h *HRHandler) ListTeams(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	items := make([]Team, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, name, department_id, manager_employee_id, location_id, created_at, updated_at
		FROM teams WHERE tenant_id=?
		ORDER BY name ASC`, tenantID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateTimeOffType(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTimeOffTypeReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	requires := true
	if req.RequiresApproval != nil {
		requires = *req.RequiresApproval
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO time_off_types (tenant_id, name, description, requires_approval, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Description), requires, userID, userID)
	if err != nil {
		http.Error(w, "could not create time off type (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var item TimeOffType
	_ = tx.Get(&item, `
		SELECT id, tenant_id, name, description, requires_approval, created_at, updated_at
		FROM time_off_types WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "time_off_types", id64, nil, item)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
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
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateTimeOffRequest(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTimeOffRequestReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	start, err := time.Parse("2006-01-02", strings.TrimSpace(req.StartDate))
	if err != nil {
		http.Error(w, "start_date must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	end, err := time.Parse("2006-01-02", strings.TrimSpace(req.EndDate))
	if err != nil {
		http.Error(w, "end_date must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if end.Before(start) {
		http.Error(w, "end_date must be >= start_date", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var empExists int
	if err := tx.Get(&empExists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, req.EmployeeID); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	var typeExists int
	if err := tx.Get(&typeExists, `SELECT 1 FROM time_off_types WHERE tenant_id=? AND id=?`, tenantID, req.TypeID); err != nil {
		http.Error(w, "time_off_type not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO time_off_requests (tenant_id, employee_id, type_id, status, start_date, end_date, reason, created_by, updated_by)
		VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
		tenantID, req.EmployeeID, req.TypeID, start, end, cleanPtr(req.Reason), userID, userID)
	if err != nil {
		http.Error(w, "could not create time off request", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var item TimeOffRequest
	_ = tx.Get(&item, `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "time_off_requests", id64, nil, item)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusCreated, item)
}

func (h *HRHandler) ListTimeOffRequests(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status != "" && status != "pending" && status != "approved" && status != "rejected" && status != "canceled" {
		http.Error(w, "status filter must be pending|approved|rejected|canceled", http.StatusBadRequest)
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
			http.Error(w, "employee_id must be numeric", http.StatusBadRequest)
			return
		}
		query += " AND employee_id=?"
		args = append(args, empID)
	}

	typeIDStr := strings.TrimSpace(r.URL.Query().Get("type_id"))
	if typeIDStr != "" {
		tid, err := strconv.ParseUint(typeIDStr, 10, 64)
		if err != nil {
			http.Error(w, "type_id must be numeric", http.StatusBadRequest)
			return
		}
		query += " AND type_id=?"
		args = append(args, tid)
	}

	query += " ORDER BY created_at DESC, id DESC"

	items := make([]TimeOffRequest, 0)
	if err := h.DB.Select(&items, query, args...); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
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
		http.Error(w, "invalid request id", http.StatusBadRequest)
		return
	}

	var req decisionReq
	_ = json.NewDecoder(r.Body).Decode(&req)

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before TimeOffRequest
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		http.Error(w, "time off request not found", http.StatusNotFound)
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
		http.Error(w, "invalid status transition", http.StatusBadRequest)
		return
	}

	now := time.Now().UTC()
	if _, err := tx.Exec(`
		UPDATE time_off_requests
		SET status=?, decision_note=?, approver_id=?, reviewed_at=?, updated_by=?
		WHERE tenant_id=? AND id=?`,
		to, cleanPtr(req.Note), userID, now, userID, tenantID, id); err != nil {
		http.Error(w, "db update error", http.StatusInternalServerError)
		return
	}

	var after TimeOffRequest
	_ = tx.Get(&after, `
		SELECT id, tenant_id, employee_id, type_id, status, start_date, end_date, reason, decision_note, approver_id, reviewed_at, created_at, updated_at
		FROM time_off_requests WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "time_off_requests", int64(id), before, after)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, after)
}

func (h *HRHandler) CreateBenefit(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createBenefitReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	cost := int64(0)
	if req.CostCents != nil {
		if *req.CostCents < 0 {
			http.Error(w, "cost_cents must be >= 0", http.StatusBadRequest)
			return
		}
		cost = *req.CostCents
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO benefits (tenant_id, name, provider, cost_cents, coverage_level, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Provider), cost, cleanPtr(req.CoverageLevel), userID, userID)
	if err != nil {
		http.Error(w, "could not create benefit (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var b Benefit
	_ = tx.Get(&b, `
		SELECT id, tenant_id, name, provider, cost_cents, coverage_level, created_at, updated_at
		FROM benefits WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "benefits", id64, nil, b)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
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
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) AssignBenefitToEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req employeeBenefitReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var effDate *time.Time
	if req.EffectiveDate != nil && strings.TrimSpace(*req.EffectiveDate) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.EffectiveDate))
		if err != nil {
			http.Error(w, "effective_date must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		effDate = &t
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// ensure employee and benefit exist
	var exists int
	if err := tx.Get(&exists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, empID); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}
	if err := tx.Get(&exists, `SELECT 1 FROM benefits WHERE tenant_id=? AND id=?`, tenantID, req.BenefitID); err != nil {
		http.Error(w, "benefit not found", http.StatusNotFound)
		return
	}

	if _, err := tx.Exec(`
		INSERT INTO employee_benefits (tenant_id, employee_id, benefit_id, effective_date, created_by)
		VALUES (?, ?, ?, ?, ?)`,
		tenantID, empID, req.BenefitID, effDate, userID); err != nil {
		http.Error(w, "could not assign benefit (maybe already assigned)", http.StatusBadRequest)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "employee_benefits", 0, nil, map[string]any{
		"employee_id": empID,
		"benefit_id":  req.BenefitID,
		"effective":   effDate,
	})

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *HRHandler) RemoveBenefitFromEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}
	benefitID, err := strconv.ParseUint(chi.URLParam(r, "benefit_id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid benefit id", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		DELETE FROM employee_benefits WHERE tenant_id=? AND employee_id=? AND benefit_id=?`,
		tenantID, empID, benefitID)
	if err != nil {
		http.Error(w, "db delete error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "relation not found", http.StatusNotFound)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "delete", "employee_benefits", 0, map[string]any{
		"employee_id": empID,
		"benefit_id":  benefitID,
	}, nil)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *HRHandler) ListEmployeeBenefits(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
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
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateEmployeeDocument(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req createEmployeeDocumentReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.DocType = strings.TrimSpace(req.DocType)
	if req.DocType == "" {
		http.Error(w, "doc_type is required", http.StatusBadRequest)
		return
	}
	req.FileURL = strings.TrimSpace(req.FileURL)
	if req.FileURL == "" {
		http.Error(w, "file_url is required", http.StatusBadRequest)
		return
	}

	var expiresAt *time.Time
	if req.ExpiresAt != nil && strings.TrimSpace(*req.ExpiresAt) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.ExpiresAt))
		if err != nil {
			http.Error(w, "expires_at must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		expiresAt = &t
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var exists int
	if err := tx.Get(&exists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, empID); err != nil {
		http.Error(w, "employee not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO employee_documents (tenant_id, employee_id, doc_type, file_name, file_url, expires_at, note, uploaded_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empID, req.DocType, cleanPtr(req.FileName), req.FileURL, expiresAt, cleanPtr(req.Note), userID)
	if err != nil {
		http.Error(w, "could not create document", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var doc EmployeeDocument
	_ = tx.Get(&doc, `
		SELECT id, tenant_id, employee_id, doc_type, file_name, file_url, expires_at, note, uploaded_by, created_at
		FROM employee_documents WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "employee_documents", id64, nil, doc)

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, doc)
}

func (h *HRHandler) ListEmployeeDocuments(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	empID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	items := make([]EmployeeDocument, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, employee_id, doc_type, file_name, file_url, expires_at, note, uploaded_by, created_at
		FROM employee_documents
		WHERE tenant_id=? AND employee_id=?
		ORDER BY created_at DESC, id DESC`, tenantID, empID); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
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

// dateOnly normaliza para meia-noite UTC, evitando horário na coluna DATE.
func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
