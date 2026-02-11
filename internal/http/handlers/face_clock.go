package handlers

import (
	"net/http"
	"time"

	mw "saas-api/internal/http/middleware"
)

type faceClockReq struct {
	EmployeeID uint64 `json:"employee_id"`
	ImageBase  string `json:"image_base64"`
	Note       string `json:"note"`
	Action     string `json:"action"` // "in" or "out" (optional: auto)
}

// FaceClockHandler reutiliza FaceHandler e TimeEntryHandler para clock-in/out com validação facial.
type FaceClockHandler struct {
	Face *FaceHandler
	TE   *TimeEntryHandler
}

func (h *FaceClockHandler) Clock(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())

	var req faceClockReq
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	if req.EmployeeID == 0 || req.ImageBase == "" {
		http.Error(w, "employee_id and image_base64 are required", 400)
		return
	}

	// primeiro valida face
	ok, _, err := h.Face.verifyInternal(r.Context(), tenantID, req.EmployeeID, req.ImageBase)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	if !ok {
		http.Error(w, "face not recognized (distance too high)", 401)
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	action := req.Action
	if action == "" {
		// decide automaticamente: se houver batida aberta, faz saída; senão, entrada
		open, err := h.TE.findOpenEntry(r.Context(), tenantID, req.EmployeeID)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if open != nil {
			action = "out"
		} else {
			action = "in"
		}
	}

	switch action {
	case "in":
		body := map[string]any{
			"employee_id": req.EmployeeID,
			"clock_in":    now,
			"note_in":     req.Note,
		}
		h.TE.createInternal(w, r, body)
	case "out":
		body := map[string]any{
			"employee_id": req.EmployeeID,
			"clock_out":   now,
			"note_out":    req.Note,
		}
		h.TE.updateOpenInternal(w, r, body)
	default:
		http.Error(w, "action must be in|out", 400)
	}
}
