package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"

	mw "saas-api/internal/http/middleware"
)

type createEmployeeAccountReq struct {
	Name     *string `json:"name"`
	Password *string `json:"password"`
}

type employeeAccountResp struct {
	EmployeeID   uint64 `json:"employee_id"`
	EmployeeName string `json:"employee_name"`
	UserID       uint64 `json:"user_id"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	NewUser      bool   `json:"new_user"`
}

type employeeAccountEmployee struct {
	ID     uint64         `db:"id"`
	Name   string         `db:"name"`
	Email  sql.NullString `db:"email"`
	Status string         `db:"status"`
}

func (h *HRHandler) CreateEmployeeAccount(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	requesterID := mw.GetUserID(r.Context())

	employeeID, err := strconv.ParseUint(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpError(w, "invalid employee id", http.StatusBadRequest)
		return
	}

	var req createEmployeeAccountReq
	if err := decodeJSON(r, &req); err != nil {
		httpError(w, err.Error(), http.StatusBadRequest)
		return
	}

	var emp employeeAccountEmployee
	if err := h.DB.Get(&emp, `
		SELECT id, name, email, status
		FROM employees
		WHERE tenant_id=? AND id=?
	`, tenantID, employeeID); err != nil {
		if err == sql.ErrNoRows {
			httpError(w, "employee not found", http.StatusNotFound)
			return
		}
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	if emp.Status == "terminated" {
		httpError(w, "employee is terminated", http.StatusBadRequest)
		return
	}

	email := strings.ToLower(strings.TrimSpace(emp.Email.String))
	if !emp.Email.Valid || email == "" {
		httpError(w, "employee email is required", http.StatusBadRequest)
		return
	}

	accountName := strings.TrimSpace(emp.Name)
	if req.Name != nil {
		if alt := strings.TrimSpace(*req.Name); alt != "" {
			accountName = alt
		}
	}

	password := ""
	if req.Password != nil {
		password = strings.TrimSpace(*req.Password)
		if password != "" && len(password) < 8 {
			httpError(w, "password must be at least 8 chars", http.StatusBadRequest)
			return
		}
	}

	tx, err := h.DB.BeginTxx(r.Context(), nil)
	if err != nil {
		httpError(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	var userID uint64
	newUser := false
	err = tx.Get(&userID, `SELECT id FROM users WHERE email=?`, email)
	if err != nil {
		if err != sql.ErrNoRows {
			httpError(w, "db read error", http.StatusInternalServerError)
			return
		}
		if len(password) < 8 {
			httpError(w, "password must be at least 8 chars", http.StatusBadRequest)
			return
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			httpError(w, "db error", http.StatusInternalServerError)
			return
		}
		res, err := tx.Exec(`INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`, email, accountName, string(hash))
		if err != nil {
			httpError(w, "could not create user", http.StatusBadRequest)
			return
		}
		id64, _ := res.LastInsertId()
		userID = uint64(id64)
		newUser = true
	} else {
		var currentRole string
		roleErr := tx.Get(&currentRole, `SELECT role FROM memberships WHERE tenant_id=? AND user_id=?`, tenantID, userID)
		if roleErr == nil {
			currentRole = normalizeRole(currentRole)
			if currentRole == roleOwner || currentRole == roleHR || currentRole == roleFinance {
				httpError(w, "user already has elevated role", http.StatusBadRequest)
				return
			}
		} else if roleErr != sql.ErrNoRows {
			httpError(w, "db read error", http.StatusInternalServerError)
			return
		}

		if accountName != "" {
			if _, err := tx.Exec(`UPDATE users SET name=? WHERE id=?`, accountName, userID); err != nil {
				httpError(w, "db update error", http.StatusInternalServerError)
				return
			}
		}
		if password != "" {
			hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
			if err != nil {
				httpError(w, "db error", http.StatusInternalServerError)
				return
			}
			if _, err := tx.Exec(`UPDATE users SET password_hash=? WHERE id=?`, string(hash), userID); err != nil {
				httpError(w, "db update error", http.StatusInternalServerError)
				return
			}
		}
	}

	var linkedEmployeeID uint64
	if err := tx.Get(&linkedEmployeeID, `SELECT employee_id FROM hr_employee_user_links WHERE tenant_id=? AND user_id=?`, tenantID, userID); err == nil {
		if linkedEmployeeID != employeeID {
			httpError(w, "user already linked to another employee", http.StatusBadRequest)
			return
		}
	} else if err != sql.ErrNoRows {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	}

	var membershipRole string
	err = tx.Get(&membershipRole, `SELECT role FROM memberships WHERE tenant_id=? AND user_id=?`, tenantID, userID)
	if err == sql.ErrNoRows {
		if _, err := tx.Exec(`INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)`, tenantID, userID, roleCollaborator); err != nil {
			httpError(w, "could not create membership", http.StatusBadRequest)
			return
		}
		membershipRole = roleCollaborator
	} else if err != nil {
		httpError(w, "db read error", http.StatusInternalServerError)
		return
	} else {
		membershipRole = normalizeRole(membershipRole)
		if membershipRole != roleCollaborator {
			if membershipRole == roleOwner || membershipRole == roleHR || membershipRole == roleFinance {
				httpError(w, "user already has elevated role", http.StatusBadRequest)
				return
			}
			if _, err := tx.Exec(`UPDATE memberships SET role=? WHERE tenant_id=? AND user_id=?`, roleCollaborator, tenantID, userID); err != nil {
				httpError(w, "db update error", http.StatusInternalServerError)
				return
			}
			membershipRole = roleCollaborator
		}
	}

	if _, err := tx.Exec(`
		INSERT INTO hr_employee_user_links (tenant_id, employee_id, user_id, linked_by)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), linked_by=VALUES(linked_by)
	`, tenantID, employeeID, userID, requesterID); err != nil {
		httpError(w, "could not link employee account", http.StatusBadRequest)
		return
	}

	if err := tx.Commit(); err != nil {
		httpError(w, "db commit error", http.StatusInternalServerError)
		return
	}

	resp := employeeAccountResp{
		EmployeeID:   emp.ID,
		EmployeeName: emp.Name,
		UserID:       userID,
		Email:        email,
		Role:         roleCollaborator,
		NewUser:      newUser,
	}
	_ = insertAudit(h.DB, r, tenantID, requesterID, "link_account", "employees", int64(emp.ID), nil, resp)
	writeJSON(w, http.StatusCreated, resp)
}
