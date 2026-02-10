package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	mw "saas-api/internal/http/middleware"

	"github.com/jmoiron/sqlx"
)

type DashboardHandler struct {
	DB *sqlx.DB
}

type financeSummary struct {
	NowUTC string `json:"now_utc"`

	NetPaidCents         int64 `json:"net_paid_cents"`
	OpenPayablesCents    int64 `json:"open_payables_cents"`
	OpenReceivablesCents int64 `json:"open_receivables_cents"`

	Payables struct {
		Draft      int64 `json:"draft"`
		DraftCount int64 `json:"draft_count"`

		PendingApproval      int64 `json:"pending_approval"`
		PendingApprovalCount int64 `json:"pending_approval_count"`

		Approved      int64 `json:"approved"`
		ApprovedCount int64 `json:"approved_count"`

		Paid      int64 `json:"paid"`
		PaidCount int64 `json:"paid_count"`

		OverdueOpen      int64 `json:"overdue_open"`
		OverdueOpenCount int64 `json:"overdue_open_count"`
	} `json:"payables"`

	Receivables struct {
		Draft      int64 `json:"draft"`
		DraftCount int64 `json:"draft_count"`

		Issued      int64 `json:"issued"`
		IssuedCount int64 `json:"issued_count"`

		Paid      int64 `json:"paid"`
		PaidCount int64 `json:"paid_count"`

		OverdueOpen      int64 `json:"overdue_open"`
		OverdueOpenCount int64 `json:"overdue_open_count"`
	} `json:"receivables"`
}

type agg struct {
	Sum   int64 `db:"sum"`
	Count int64 `db:"count"`
}

func ccClause(ccParam string) (string, []any, error) {
	ccParam = strings.TrimSpace(ccParam)
	if ccParam == "" {
		return "", nil, nil // sem filtro
	}
	if ccParam == "0" {
		return " AND cost_center_id IS NULL", nil, nil // sem centro de custo
	}
	ccID, err := strconv.ParseUint(ccParam, 10, 64)
	if err != nil || ccID == 0 {
		return "", nil, fmt.Errorf("invalid cost_center_id")
	}
	return " AND cost_center_id = ?", []any{ccID}, nil
}

func (h *DashboardHandler) FinanceSummary(w http.ResponseWriter, r *http.Request) {
	tenantID := mw.GetTenantID(r.Context())
	now := time.Now().UTC()
	today := now.Format("2006-01-02")

	ccParam := r.URL.Query().Get("cost_center_id")
	clause, args, err := ccClause(ccParam)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	var out financeSummary
	out.NowUTC = now.Format(time.RFC3339)

	// helper pra montar params: tenantID + args...
	withTenant := func() []any { return append([]any{tenantID}, args...) }
	withTenantToday := func() []any { return append([]any{tenantID, today}, args...) }

	// -------------------------
	// Payables por status (SUM + COUNT)
	// -------------------------
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM payables
			 WHERE tenant_id=? AND status='draft'`+clause,
			withTenant()...,
		)
		out.Payables.Draft = a.Sum
		out.Payables.DraftCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM payables
			 WHERE tenant_id=? AND status='pending_approval'`+clause,
			withTenant()...,
		)
		out.Payables.PendingApproval = a.Sum
		out.Payables.PendingApprovalCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM payables
			 WHERE tenant_id=? AND status='approved'`+clause,
			withTenant()...,
		)
		out.Payables.Approved = a.Sum
		out.Payables.ApprovedCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM payables
			 WHERE tenant_id=? AND status='paid'`+clause,
			withTenant()...,
		)
		out.Payables.Paid = a.Sum
		out.Payables.PaidCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM payables
			 WHERE tenant_id=? AND status IN ('draft','pending_approval','approved') AND due_date < ?`+clause,
			withTenantToday()...,
		)
		out.Payables.OverdueOpen = a.Sum
		out.Payables.OverdueOpenCount = a.Count
	}

	// -------------------------
	// Receivables por status (SUM + COUNT)
	// -------------------------
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM receivables
			 WHERE tenant_id=? AND status='draft'`+clause,
			withTenant()...,
		)
		out.Receivables.Draft = a.Sum
		out.Receivables.DraftCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM receivables
			 WHERE tenant_id=? AND status='issued'`+clause,
			withTenant()...,
		)
		out.Receivables.Issued = a.Sum
		out.Receivables.IssuedCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM receivables
			 WHERE tenant_id=? AND status='paid'`+clause,
			withTenant()...,
		)
		out.Receivables.Paid = a.Sum
		out.Receivables.PaidCount = a.Count
	}
	{
		var a agg
		_ = h.DB.Get(&a,
			`SELECT COALESCE(SUM(amount_cents),0) AS sum, COUNT(*) AS count
			 FROM receivables
			 WHERE tenant_id=? AND status IN ('draft','issued') AND due_date < ?`+clause,
			withTenantToday()...,
		)
		out.Receivables.OverdueOpen = a.Sum
		out.Receivables.OverdueOpenCount = a.Count
	}

	out.OpenPayablesCents = out.Payables.Draft + out.Payables.PendingApproval + out.Payables.Approved
	out.OpenReceivablesCents = out.Receivables.Draft + out.Receivables.Issued
	out.NetPaidCents = out.Receivables.Paid - out.Payables.Paid

	writeJSON(w, 200, out)
}
