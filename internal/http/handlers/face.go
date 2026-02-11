package handlers

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"strings"
	"time"

	"github.com/corona10/goimagehash"
	"github.com/jmoiron/sqlx"

	mw "saas-api/internal/http/middleware"
)

type faceTemplate struct {
	ID         uint64    `db:"id" json:"id"`
	TenantID   uint64    `db:"tenant_id" json:"tenant_id"`
	EmployeeID uint64    `db:"employee_id" json:"employee_id"`
	Phash      int64     `db:"phash" json:"phash"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time `db:"updated_at" json:"updated_at"`
}

type FaceHandler struct {
	DB *sqlx.DB
}

type faceRegisterReq struct {
	EmployeeID uint64 `json:"employee_id"`
	ImageBase  string `json:"image_base64"`
}

type faceVerifyReq struct {
	EmployeeID uint64 `json:"employee_id"`
	ImageBase  string `json:"image_base64"`
}

type faceVerifyResp struct {
	Match    bool `json:"match"`
	Distance int  `json:"distance"`
}

func decodeImageFromBase64(b64 string) (image.Image, error) {
	parts := strings.SplitN(b64, ",", 2)
	if len(parts) == 2 {
		b64 = parts[1] // remove data:image/... prefix
	}
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("decode base64: %w", err)
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}
	return img, nil
}

func (h *FaceHandler) Register(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	userID := mw.GetUserID(r.Context())

	var req faceRegisterReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.EmployeeID == 0 || strings.TrimSpace(req.ImageBase) == "" {
		http.Error(w, "employee_id and image_base64 are required", 400)
		return
	}

	img, err := decodeImageFromBase64(req.ImageBase)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	hash, err := goimagehash.PerceptionHash(img)
	if err != nil {
		http.Error(w, "hash error", 500)
		return
	}

	// ensure employee exists in tenant
	var tmp int
	if err := h.DB.Get(&tmp, `SELECT 1 FROM employees WHERE tenant_id=? AND id=?`, tenantID, req.EmployeeID); err != nil {
		http.Error(w, "employee not found", 400)
		return
	}

	_, err = h.DB.Exec(`
        INSERT INTO face_templates (tenant_id, employee_id, phash, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE phash=VALUES(phash), updated_at=NOW(), updated_by=VALUES(updated_by)
    `, tenantID, req.EmployeeID, int64(hash.GetHash()), userID, userID)
	if err != nil {
		http.Error(w, "db error", 500)
		return
	}

	writeJSON(w, 201, map[string]any{"phash": hash.GetHash()})
}

func (h *FaceHandler) Verify(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var req faceVerifyReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.EmployeeID == 0 || strings.TrimSpace(req.ImageBase) == "" {
		http.Error(w, "employee_id and image_base64 are required", 400)
		return
	}

	var stored faceTemplate
	if err := h.DB.Get(&stored, `SELECT id, tenant_id, employee_id, phash, created_at, updated_at FROM face_templates WHERE tenant_id=? AND employee_id=?`, tenantID, req.EmployeeID); err != nil {
		http.Error(w, "face template not found", 404)
		return
	}

	img, err := decodeImageFromBase64(req.ImageBase)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	hash, err := goimagehash.PerceptionHash(img)
	if err != nil {
		http.Error(w, "hash error", 500)
		return
	}

	storedHash := goimagehash.NewImageHash(uint64(stored.Phash), goimagehash.PHash)
	dist, err := storedHash.Distance(hash)
	if err != nil {
		http.Error(w, "distance error", 500)
		return
	}

	match := dist <= 12 // tolerance
	writeJSON(w, 200, faceVerifyResp{Match: match, Distance: dist})
}
