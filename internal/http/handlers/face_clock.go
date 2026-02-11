package handlers

import (
	"net/http"
	"strings"
	"time"

	mw "saas-api/internal/http/middleware"
)

type faceClockReq struct {
	EmployeeID uint64 `json:"employee_id"`   // opcional: se 0, identificar
	ImageBase  string `json:"image_base64"`  // obrigatório
	Note       string `json:"note"`
	Action     string `json:"action"` // "in" ou "out" (auto por default)
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
	if strings.TrimSpace(req.ImageBase) == "" {
		http.Error(w, "image_base64 is required", 400)
		return
	}

	empID := req.EmployeeID
	if empID == 0 {
		found, _, err := h.Face.identifyInternal(r.Context(), tenantID, req.ImageBase)
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		empID = found
	} else {
		ok, _, err := h.Face.verifyInternal(r.Context(), tenantID, empID, req.ImageBase)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		if !ok {
			http.Error(w, "face not recognized (distance too high)", 401)
			return
		}
	}

	now := time.Now().UTC().Format(time.RFC3339)
	action := req.Action
	if action == "" {
		// decide automaticamente: se houver batida aberta, faz saída; senão, entrada
		open, err := h.TE.findOpenEntry(r.Context(), tenantID, empID)
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
			"employee_id": empID,
			"clock_in":    now,
			"note_in":     req.Note,
		}
		h.TE.createInternal(w, r, body)
	case "out":
		body := map[string]any{
			"employee_id": empID,
			"clock_out":   now,
			"note_out":    req.Note,
		}
		h.TE.updateOpenInternal(w, r, body)
	default:
		http.Error(w, "action must be in|out", 400)
	}
}
