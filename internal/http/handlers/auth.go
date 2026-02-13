package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"

	mw "saas-api/internal/http/middleware"
)

type AuthHandler struct {
	DB        *sqlx.DB
	JWTSecret []byte
	JWTIssuer string
	JWTTTL    time.Duration
}

type registerReq struct {
	CompanyName string `json:"company_name"`
	Name        string `json:"name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResp struct {
	AccessToken string `json:"access_token"`
	TenantID    uint64 `json:"tenant_id"`
	UserID      uint64 `json:"user_id"`
	Role        string `json:"role"`
}

var nonSlug = regexp.MustCompile(`[^a-z0-9-]+`)

func slugify(s string) string {
	s = strings.TrimSpace(strings.ToLower(s))
	s = strings.ReplaceAll(s, " ", "-")
	s = nonSlug.ReplaceAllString(s, "")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "empresa"
	}
	return s
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.CompanyName == "" || req.Name == "" || req.Email == "" || len(req.Password) < 8 {
		http.Error(w, "invalid input (password >= 8)", http.StatusBadRequest)
		return
	}

	passHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "password error", http.StatusInternalServerError)
		return
	}

	tx, err := h.DB.Beginx()
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	tenantSlug := slugify(req.CompanyName) + "-" + time.Now().Format("20060102150405")

	res, err := tx.Exec(`INSERT INTO tenants (name, slug) VALUES (?, ?)`, req.CompanyName, tenantSlug)
	if err != nil {
		http.Error(w, "could not create tenant", http.StatusBadRequest)
		return
	}
	tenantID64, _ := res.LastInsertId()
	tenantID := uint64(tenantID64)

	res, err = tx.Exec(`INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)`, req.Email, req.Name, string(passHash))
	if err != nil {
		http.Error(w, "could not create user (email may exist)", http.StatusBadRequest)
		return
	}
	userID64, _ := res.LastInsertId()
	userID := uint64(userID64)

	_, err = tx.Exec(`INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)`, tenantID, userID, "owner")
	if err != nil {
		http.Error(w, "could not create membership", http.StatusBadRequest)
		return
	}

	if err := tx.Commit(); err != nil {
		http.Error(w, "db commit error", http.StatusInternalServerError)
		return
	}

	token, err := h.makeToken(userID, tenantID, "owner")
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusCreated, authResp{
		AccessToken: token,
		TenantID:    tenantID,
		UserID:      userID,
		Role:        "owner",
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Password == "" {
		http.Error(w, "invalid input", http.StatusBadRequest)
		return
	}

	var user struct {
		ID           uint64 `db:"id"`
		PasswordHash string `db:"password_hash"`
	}
	err := h.DB.Get(&user, `SELECT id, password_hash FROM users WHERE email = ?`, req.Email)
	if err == sql.ErrNoRows {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// Pega um tenant padrão do usuário (primeiro). Depois você pode deixar escolher.
	var m struct {
		TenantID uint64 `db:"tenant_id"`
		Role     string `db:"role"`
	}
	err = h.DB.Get(&m, `SELECT tenant_id, role FROM memberships WHERE user_id = ? ORDER BY id ASC LIMIT 1`, user.ID)
	if err != nil {
		http.Error(w, "no tenant membership", http.StatusForbidden)
		return
	}
	m.Role = normalizeRole(m.Role)

	token, err := h.makeToken(user.ID, m.TenantID, m.Role)
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, authResp{
		AccessToken: token,
		TenantID:    m.TenantID,
		UserID:      user.ID,
		Role:        m.Role,
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"user_id":   mw.GetUserID(r.Context()),
		"tenant_id": mw.GetTenantID(r.Context()),
		"role":      normalizeRole(mw.GetRole(r.Context())),
	})
}

func (h *AuthHandler) makeToken(userID, tenantID uint64, role string) (string, error) {
	now := time.Now()
	claims := mw.Claims{
		UserID:   userID,
		TenantID: tenantID,
		Role:     role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    h.JWTIssuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(h.JWTTTL)),
		},
	}
	t := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return t.SignedString(h.JWTSecret)
}
