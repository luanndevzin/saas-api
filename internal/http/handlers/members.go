package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	mw "saas-api/internal/http/middleware"

	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"
)

type MembersHandler struct {
	DB *sqlx.DB
}

type memberRow struct {
	UserID    uint64 `db:"user_id" json:"user_id"`
	Email     string `db:"email" json:"email"`
	Name      string `db:"name" json:"name"`
	Role      string `db:"role" json:"role"`
	CreatedAt string `db:"created_at" json:"created_at"`
}

type createMemberReq struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"` // obrigatório se o user ainda não existir
	Role     string `json:"role"`     // owner/hr/finance/member (default member)
}

type updateRoleReq struct {
	Role string `json:"role"`
}

func (h *MembersHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var items []memberRow
	if err := h.DB.Select(&items, `
		SELECT u.id AS user_id, u.email, u.name, m.role, DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
		FROM memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.tenant_id=?
		ORDER BY u.email ASC
	`, tenantID); err != nil {
		http.Error(w, "failed to list members", 500)
		return
	}

	writeJSON(w, 200, items)
}

func (h *MembersHandler) CreateMember(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	requesterID := mw.GetUserID(r.Context())

	var req createMemberReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", 400)
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Name = strings.TrimSpace(req.Name)
	req.Role = strings.TrimSpace(strings.ToLower(req.Role))

	if req.Email == "" {
		http.Error(w, "email is required", 400)
		return
	}

	if req.Role == "" {
		req.Role = "member"
	}
	if !isValidRole(req.Role) {
		http.Error(w, "invalid role", 400)
		return
	}

	tx, err := h.DB.BeginTxx(r.Context(), nil)
	if err != nil {
		http.Error(w, "tx begin failed", 500)
		return
	}
	defer tx.Rollback()

	var userID uint64
	err = tx.Get(&userID, `SELECT id FROM users WHERE email=?`, req.Email)
	if err != nil {
		if err != sql.ErrNoRows {
			http.Error(w, "failed to lookup user", 500)
			return
		}
		// não existe: precisa criar
		if req.Name == "" {
			http.Error(w, "name is required for new user", 400)
			return
		}
		if len(req.Password) < 8 {
			http.Error(w, "password must be at least 8 chars", 400)
			return
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "failed to hash password", 500)
			return
		}

		res, err := tx.Exec(`INSERT INTO users (email, name, password_hash) VALUES (?,?,?)`, req.Email, req.Name, string(hash))
		if err != nil {
			http.Error(w, "failed to create user", 500)
			return
		}
		id64, _ := res.LastInsertId()
		userID = uint64(id64)
	} else {
		// existe: se mandou name, atualiza
		if req.Name != "" {
			_, _ = tx.Exec(`UPDATE users SET name=? WHERE id=?`, req.Name, userID)
		}
	}

	// não deixa owner criar membership pra si mesmo com role diferente (evita se quebrar)
	if userID == requesterID && req.Role != "owner" {
		http.Error(w, "cannot change your own role here", 400)
		return
	}

	// cria/atualiza membership
	_, err = tx.Exec(`
		INSERT INTO memberships (tenant_id, user_id, role)
		VALUES (?,?,?)
		ON DUPLICATE KEY UPDATE role=VALUES(role)
	`, tenantID, userID, req.Role)
	if err != nil {
		http.Error(w, "failed to upsert membership", 500)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "tx commit failed", 500)
		return
	}

	// retorna o registro
	var out memberRow
	_ = h.DB.Get(&out, `
		SELECT u.id AS user_id, u.email, u.name, m.role, DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at
		FROM memberships m
		JOIN users u ON u.id = m.user_id
		WHERE m.tenant_id=? AND m.user_id=?
	`, tenantID, userID)

	writeJSON(w, 201, out)
}

func (h *MembersHandler) UpdateMemberRole(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	requesterID := mw.GetUserID(r.Context())

	userID, err := parseUintParam(r, "user_id")
	if err != nil {
		http.Error(w, "invalid user_id", 400)
		return
	}
	if userID == requesterID {
		http.Error(w, "cannot change your own role", 400)
		return
	}

	var req updateRoleReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", 400)
		return
	}
	req.Role = strings.TrimSpace(strings.ToLower(req.Role))
	if !isValidRole(req.Role) {
		http.Error(w, "invalid role", 400)
		return
	}

	tx, err := h.DB.BeginTxx(r.Context(), nil)
	if err != nil {
		http.Error(w, "tx begin failed", 500)
		return
	}
	defer tx.Rollback()

	var currentRole string
	if err := tx.Get(&currentRole, `SELECT role FROM memberships WHERE tenant_id=? AND user_id=?`, tenantID, userID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "member not found", 404)
			return
		}
		http.Error(w, "failed to load membership", 500)
		return
	}

	// evita remover o último owner
	if currentRole == "owner" && req.Role != "owner" {
		var owners int64
		_ = tx.Get(&owners, `SELECT COUNT(*) FROM memberships WHERE tenant_id=? AND role='owner'`, tenantID)
		if owners <= 1 {
			http.Error(w, "cannot demote the last owner", 400)
			return
		}
	}

	if _, err := tx.Exec(`UPDATE memberships SET role=? WHERE tenant_id=? AND user_id=?`, req.Role, tenantID, userID); err != nil {
		http.Error(w, "failed to update role", 500)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "tx commit failed", 500)
		return
	}

	w.WriteHeader(204)
}

func (h *MembersHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	requesterID := mw.GetUserID(r.Context())

	userID, err := parseUintParam(r, "user_id")
	if err != nil {
		http.Error(w, "invalid user_id", 400)
		return
	}
	if userID == requesterID {
		http.Error(w, "cannot remove yourself", 400)
		return
	}

	tx, err := h.DB.BeginTxx(r.Context(), nil)
	if err != nil {
		http.Error(w, "tx begin failed", 500)
		return
	}
	defer tx.Rollback()

	var currentRole string
	if err := tx.Get(&currentRole, `SELECT role FROM memberships WHERE tenant_id=? AND user_id=?`, tenantID, userID); err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "member not found", 404)
			return
		}
		http.Error(w, "failed to load membership", 500)
		return
	}

	// evita remover o último owner
	if currentRole == "owner" {
		var owners int64
		_ = tx.Get(&owners, `SELECT COUNT(*) FROM memberships WHERE tenant_id=? AND role='owner'`, tenantID)
		if owners <= 1 {
			http.Error(w, "cannot remove the last owner", 400)
			return
		}
	}

	if _, err := tx.Exec(`DELETE FROM memberships WHERE tenant_id=? AND user_id=?`, tenantID, userID); err != nil {
		http.Error(w, "failed to remove member", 500)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "tx commit failed", 500)
		return
	}

	w.WriteHeader(204)
}

func isValidRole(role string) bool {
	switch role {
	case "owner", "hr", "finance", "member":
		return true
	default:
		return false
	}
}

func parseUintParam(r *http.Request, name string) (uint64, error) {
	// chi usa URLParam
	// import do chi aqui evita acoplamento no topo; se preferir, mova pro topo
	// (mantive simples)
	v := strings.TrimSpace(chiURLParam(r, name))
	return strconv.ParseUint(v, 10, 64)
}

// pequeno wrapper pra não importar chi no topo do arquivo se você não quiser.
// Se preferir, apague isso e use chi.URLParam direto com import.
func chiURLParam(r *http.Request, name string) string {
	// você já usa chi em outros handlers? então pode trocar por chi.URLParam.
	// aqui é apenas pra compilar sem depender da ordem mental.
	return r.PathValue(name)
}
