package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	mw "saas-api/internal/http/middleware"
)

func (h *HRHandler) CreateDepartment(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createDepartmentReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpError(w, "name is required", http.StatusBadRequest)
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
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO departments (tenant_id, name, code, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?)`,
		tenantID, req.Name, req.Code, userID, userID,
	)
	if err != nil {
		httpError(w, "could not create department (name/code may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var dept Department
	if err := tx.Get(&dept, `SELECT id, tenant_id, name, code, created_at, updated_at FROM departments WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "departments", id64, nil, dept)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, dept)
}

func (h *HRHandler) ListDepartments(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var items []Department
	if err := h.DB.Select(&items, `SELECT id, tenant_id, name, code, created_at, updated_at FROM departments WHERE tenant_id=? ORDER BY name ASC`, tenantID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreatePosition(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createPositionReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		httpError(w, "title is required", http.StatusBadRequest)
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
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO positions (tenant_id, department_id, title, level, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?)`,
		tenantID, req.DepartmentID, req.Title, req.Level, userID, userID,
	)
	if err != nil {
		httpError(w, "could not create position (title may exist, or invalid department_id)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var pos Position
	if err := tx.Get(&pos, `SELECT id, tenant_id, department_id, title, level, created_at, updated_at FROM positions WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "positions", id64, nil, pos)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, pos)
}

func (h *HRHandler) ListPositions(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var items []Position
	if err := h.DB.Select(&items, `SELECT id, tenant_id, department_id, title, level, created_at, updated_at FROM positions WHERE tenant_id=? ORDER BY title ASC`, tenantID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createEmployeeReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpError(w, "name is required", http.StatusBadRequest)
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
	req.CPF = cleanPtr(req.CPF)
	req.CBO = cleanPtr(req.CBO)
	req.CTPS = cleanPtr(req.CTPS)

	status := "active"
	if req.Status != nil && strings.TrimSpace(*req.Status) != "" {
		status = strings.TrimSpace(strings.ToLower(*req.Status))
	}
	if status != "active" && status != "inactive" && status != "terminated" {
		httpError(w, "status must be active|inactive|terminated", http.StatusBadRequest)
		return
	}

	var hireDate *time.Time
	if req.HireDate != nil && strings.TrimSpace(*req.HireDate) != "" {
		t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.HireDate))
		if err != nil {
			httpError(w, "hire_date must be YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		hireDate = &t
	}

	salary := int64(0)
	if req.SalaryCents != nil {
		salary = *req.SalaryCents
		if salary < 0 {
			httpError(w, "salary_cents must be >= 0", http.StatusBadRequest)
			return
		}
	}

	managerID := req.ManagerID

	empCode := genCode("EMP")

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO employees (
			tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date,
			department_id, position_id, manager_id, salary_cents, created_by, updated_by
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empCode, req.Name, req.Email, req.CPF, req.CBO, req.CTPS, status, hireDate,
		req.DepartmentID, req.PositionID, managerID, salary, userID, userID,
	)
	if err != nil {
		httpError(w, "could not create employee (invalid dept/position?)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var emp Employee
	if err := tx.Get(&emp, `
		SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees
		WHERE tenant_id=? AND id=?`, tenantID, id64); err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	_ = insertAudit(tx, r, tenantID, userID, "create", "employees", id64, nil, emp)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, emp)
}

func (h *HRHandler) ListEmployees(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	// filtros simples via querystring
	status := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("status")))
	if status != "" && status != "active" && status != "inactive" && status != "terminated" {
		httpError(w, "status filter must be active|inactive|terminated", http.StatusBadRequest)
		return
	}

	var items []Employee
	if status == "" {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
			       department_id, position_id, manager_id, salary_cents, created_at, updated_at
			FROM employees
			WHERE tenant_id=?
			ORDER BY id DESC`, tenantID); err != nil {
			httpError(w, "db error", http.StatusInternalServerError)
			return
		}
	} else {
		if err := h.DB.Select(&items, `
			SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
			       department_id, position_id, manager_id, salary_cents, created_at, updated_at
			FROM employees
			WHERE tenant_id=? AND status=?
			ORDER BY id DESC`, tenantID, status); err != nil {
			httpError(w, "db error", http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) GetEmployee(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	id, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var emp Employee
	if err := h.DB.Get(&emp, `
		SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees
		WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
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
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req updateEmployeeReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before Employee
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}

	after := before

	if req.Name != nil {
		after.Name = strings.TrimSpace(*req.Name)
		if after.Name == "" {
			httpError(w, "name cannot be empty", http.StatusBadRequest)
			return
		}
	}
	if req.Email != nil {
		after.Email = cleanPtrLower(req.Email)
	}
	if req.CPF != nil {
		after.CPF = cleanPtr(req.CPF)
	}
	if req.CBO != nil {
		after.CBO = cleanPtr(req.CBO)
	}
	if req.CTPS != nil {
		after.CTPS = cleanPtr(req.CTPS)
	}
	if req.HireDate != nil {
		if strings.TrimSpace(*req.HireDate) == "" {
			after.HireDate = nil
		} else {
			t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.HireDate))
			if err != nil {
				httpError(w, "hire_date must be YYYY-MM-DD", http.StatusBadRequest)
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
				httpError(w, "termination_date must be YYYY-MM-DD", http.StatusBadRequest)
				return
			}
			after.TerminationDate = &t
		}
	}
	if req.Status != nil {
		s := strings.TrimSpace(strings.ToLower(*req.Status))
		if s != "active" && s != "inactive" && s != "terminated" {
			httpError(w, "status must be active|inactive|terminated", http.StatusBadRequest)
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
			httpError(w, "salary_cents must be >= 0", http.StatusBadRequest)
			return
		}
		after.SalaryCents = *req.SalaryCents
	}

	if _, err := tx.Exec(`
		UPDATE employees
		SET name=?, email=?, status=?, hire_date=?, termination_date=?,
		    cpf=?, cbo=?, ctps=?, department_id=?, position_id=?, manager_id=?, salary_cents=?, updated_by=?
		WHERE tenant_id=? AND id=?`,
		after.Name, after.Email, after.Status, after.HireDate, after.TerminationDate,
		after.CPF, after.CBO, after.CTPS, after.DepartmentID, after.PositionID, after.ManagerID, after.SalaryCents, userID,
		tenantID, id,
	); err != nil {
		httpError(w, "db update error", http.StatusInternalServerError)
		return
	}

	var persisted Employee
	_ = tx.Get(&persisted, `
		SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "employees", int64(id), before, persisted)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
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
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req updateEmployeeStatusReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Status = strings.TrimSpace(strings.ToLower(req.Status))
	if req.Status != "active" && req.Status != "inactive" && req.Status != "terminated" {
		httpError(w, "status must be active|inactive|terminated", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var before Employee
	if err := tx.Get(&before, `
		SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}

	var terminationDate *time.Time
	if req.Status == "terminated" {
		if req.TerminationDate != nil && strings.TrimSpace(*req.TerminationDate) != "" {
			t, err := time.Parse("2006-01-02", strings.TrimSpace(*req.TerminationDate))
			if err != nil {
				httpError(w, "termination_date must be YYYY-MM-DD", http.StatusBadRequest)
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
		httpError(w, "db update error", http.StatusInternalServerError)
		return
	}

	var after Employee
	_ = tx.Get(&after, `
		SELECT id, tenant_id, employee_code, name, email, cpf, cbo, ctps, status, hire_date, termination_date,
		       department_id, position_id, manager_id, salary_cents, created_at, updated_at
		FROM employees WHERE tenant_id=? AND id=?`, tenantID, id)

	_ = insertAudit(tx, r, tenantID, userID, "update", "employees", int64(id), before, after)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
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
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req createCompensationReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.EffectiveAt = strings.TrimSpace(req.EffectiveAt)
	if req.EffectiveAt == "" {
		httpError(w, "effective_at is required", http.StatusBadRequest)
		return
	}
	eff, err := time.Parse("2006-01-02", req.EffectiveAt)
	if err != nil {
		httpError(w, "effective_at must be YYYY-MM-DD", http.StatusBadRequest)
		return
	}
	if req.SalaryCents < 0 {
		httpError(w, "salary_cents must be >= 0", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var empExists int
	if err := tx.Get(&empExists, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, empID); err != nil {
		httpError(w, "employee not found", http.StatusNotFound)
		return
	}

	res, err := tx.Exec(`
		INSERT INTO employee_compensations (tenant_id, employee_id, effective_at, salary_cents, adjustment_type, note, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, empID, eff, req.SalaryCents, cleanPtr(req.AdjustmentType), cleanPtr(req.Note), userID)
	if err != nil {
		httpError(w, "could not create compensation", http.StatusBadRequest)
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
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, comp)
}

func (h *HRHandler) ListCompensations(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	idStr := chi.URLParam(r, "id")
	empID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	items := make([]EmployeeCompensation, 0)
	if err := h.DB.Select(&items, `
		SELECT id, tenant_id, employee_id, effective_at, salary_cents, adjustment_type, note, created_at, created_by
		FROM employee_compensations
		WHERE tenant_id=? AND employee_id=?
		ORDER BY effective_at ASC, id ASC`, tenantID, empID); err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateLocation(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createLocationReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpError(w, "name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO locations (tenant_id, name, code, kind, country, state, city, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, cleanPtr(req.Code), cleanPtr(req.Kind), cleanPtr(req.Country),
		cleanPtr(req.State), cleanPtr(req.City), userID, userID)
	if err != nil {
		httpError(w, "could not create location (name/code may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var loc Location
	_ = tx.Get(&loc, `
		SELECT id, tenant_id, name, code, kind, country, state, city, created_at, updated_at
		FROM locations WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "locations", id64, nil, loc)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
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
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}

func (h *HRHandler) CreateTeam(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req createTeamReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		httpError(w, "name is required", http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`
		INSERT INTO teams (tenant_id, name, department_id, manager_employee_id, location_id, created_by, updated_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		tenantID, req.Name, req.DepartmentID, req.ManagerEmployeeID, req.LocationID, userID, userID)
	if err != nil {
		httpError(w, "could not create team (name may exist)", http.StatusBadRequest)
		return
	}
	id64, _ := res.LastInsertId()

	var team Team
	_ = tx.Get(&team, `
		SELECT id, tenant_id, name, department_id, manager_employee_id, location_id, created_at, updated_at
		FROM teams WHERE tenant_id=? AND id=?`, tenantID, id64)

	_ = insertAudit(tx, r, tenantID, userID, "create", "teams", id64, nil, team)

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
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
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, items)
}
