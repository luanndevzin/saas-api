package httpserver

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/jmoiron/sqlx"
	"github.com/rs/zerolog"

	"saas-api/internal/http/handlers"
	mw "saas-api/internal/http/middleware"
)

func NewRouter(db *sqlx.DB, log zerolog.Logger, jwtSecret []byte, jwtIssuer string, jwtTTLMinutes int) http.Handler {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
	// Responde preflight para qualquer rota
	r.Options("/*", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	// Swagger UI estatico em /swagger
	r.Route("/swagger", func(sw chi.Router) {
		fs := http.FileServer(http.Dir("swagger"))
		// FileServer ja cuida de /swagger -> /swagger/ (301) e serve index.html
		sw.Handle("/*", http.StripPrefix("/swagger", fs))
	})

	r.Route("/v1", func(v1 chi.Router) {
		v1.Get("/health", handlers.Health)

		authH := &handlers.AuthHandler{
			DB:        db,
			JWTSecret: jwtSecret,
			JWTIssuer: jwtIssuer,
			JWTTTL:    time.Duration(jwtTTLMinutes) * time.Minute,
		}

		// auth publicas
		v1.Post("/auth/register", authH.Register)
		v1.Post("/auth/login", authH.Login)

		// protegidas
		v1.Group(func(pr chi.Router) {
			pr.Use(mw.AuthJWT(jwtSecret))

			// qualquer usuario autenticado
			pr.Get("/me", authH.Me)
			hr := &handlers.HRHandler{DB: db}
			pr.Get("/time-entries/me", hr.GetMyTimeEntries)
			pr.Post("/time-entries/clock-in", hr.ClockIn)
			pr.Post("/time-entries/clock-out", hr.ClockOut)

			// -------------------
			// RH: owner + hr
			// -------------------
			pr.Group(func(r chi.Router) {
				r.Use(mw.RequireRoles("owner", "hr"))

				r.Post("/departments", hr.CreateDepartment)
				r.Get("/departments", hr.ListDepartments)

				r.Post("/positions", hr.CreatePosition)
				r.Get("/positions", hr.ListPositions)

				r.Post("/employees", hr.CreateEmployee)
				r.Get("/employees", hr.ListEmployees)
				r.Get("/employees/{id}", hr.GetEmployee)
				r.Patch("/employees/{id}", hr.UpdateEmployee)
				r.Patch("/employees/{id}/status", hr.UpdateEmployeeStatus)
				r.Post("/employees/{id}/compensations", hr.CreateCompensation)
				r.Get("/employees/{id}/compensations", hr.ListCompensations)
				r.Post("/employees/{id}/benefits", hr.AssignBenefitToEmployee)
				r.Get("/employees/{id}/benefits", hr.ListEmployeeBenefits)
				r.Delete("/employees/{id}/benefits/{benefit_id}", hr.RemoveBenefitFromEmployee)
				r.Post("/employees/{id}/documents", hr.CreateEmployeeDocument)
				r.Get("/employees/{id}/documents", hr.ListEmployeeDocuments)

				r.Post("/locations", hr.CreateLocation)
				r.Get("/locations", hr.ListLocations)

				r.Post("/teams", hr.CreateTeam)
				r.Get("/teams", hr.ListTeams)

				r.Post("/time-off-types", hr.CreateTimeOffType)
				r.Get("/time-off-types", hr.ListTimeOffTypes)
				r.Post("/time-off-requests", hr.CreateTimeOffRequest)
				r.Get("/time-off-requests", hr.ListTimeOffRequests)
				r.Patch("/time-off-requests/{id}/approve", hr.ApproveTimeOff)
				r.Patch("/time-off-requests/{id}/reject", hr.RejectTimeOff)
				r.Patch("/time-off-requests/{id}/cancel", hr.CancelTimeOff)

				r.Post("/benefits", hr.CreateBenefit)
				r.Get("/benefits", hr.ListBenefits)

				r.Get("/integrations/clockify", hr.GetClockifyConfig)
				r.Get("/integrations/clockify/status", hr.GetClockifyStatus)
				r.Post("/integrations/clockify", hr.UpsertClockifyConfig)
				r.Post("/integrations/clockify/sync", hr.SyncClockifyEntries)
				r.Get("/time-entries", hr.ListTimeEntries)

				r.Get("/time-bank/settings", hr.GetTimeBankSettings)
				r.Put("/time-bank/settings", hr.UpsertTimeBankSettings)
				r.Get("/time-bank/summary", hr.GetTimeBankSummary)
				r.Get("/time-bank/adjustments", hr.ListTimeBankAdjustments)
				r.Post("/time-bank/adjustments", hr.CreateTimeBankAdjustment)
				r.Post("/time-bank/adjustments/{id}/approve", hr.ApproveTimeBankAdjustment)
				r.Post("/time-bank/adjustments/{id}/reject", hr.RejectTimeBankAdjustment)
				r.Get("/time-bank/closures", hr.ListTimeBankClosures)
				r.Get("/time-bank/closures/{id}/export.csv", hr.ExportTimeBankClosureCSV)
				r.Get("/time-bank/closures/{id}/employees", hr.ListTimeBankClosureEmployees)
				r.Get("/time-bank/closures/{id}/employees/{employee_id}/card.csv", hr.ExportTimeBankEmployeeCardCSV)
				r.Post("/time-bank/closures/close", hr.CloseTimeBankPeriod)
				r.Post("/time-bank/closures/{id}/reopen", hr.ReopenTimeBankClosure)
			})

			// RH-only: provisionar conta de colaborador vinculada ao cadastro de funcionario
			pr.Group(func(r chi.Router) {
				r.Use(mw.RequireRoles("hr"))
				r.Post("/employees/{id}/account", hr.CreateEmployeeAccount)
			})

			// -------------------
			// FINANCEIRO: owner + finance
			// -------------------
			pr.Group(func(r chi.Router) {
				r.Use(mw.RequireRoles("owner", "finance"))

				// AP
				fin := &handlers.FinanceAPHandler{DB: db}
				r.Post("/vendors", fin.CreateVendor)
				r.Get("/vendors", fin.ListVendors)

				r.Post("/payables", fin.CreatePayable)
				r.Get("/payables", fin.ListPayables)
				r.Patch("/payables/{id}", fin.UpdatePayable)

				r.Post("/payables/{id}/submit", fin.SubmitPayable)
				r.Post("/payables/{id}/approve", fin.ApprovePayable)
				r.Post("/payables/{id}/reject", fin.RejectPayable)
				r.Post("/payables/{id}/mark-paid", fin.MarkPaid)
				r.Get("/payables/{id}/events", fin.ListPayableEvents)

				// AR
				ar := &handlers.FinanceARHandler{DB: db}
				r.Post("/customers", ar.CreateCustomer)
				r.Get("/customers", ar.ListCustomers)

				r.Post("/receivables", ar.CreateReceivable)
				r.Get("/receivables", ar.ListReceivables)
				r.Patch("/receivables/{id}", ar.UpdateReceivable)

				r.Post("/receivables/{id}/issue", ar.IssueReceivable)
				r.Post("/receivables/{id}/cancel", ar.CancelReceivable)
				r.Post("/receivables/{id}/mark-received", ar.MarkReceived)
				r.Get("/receivables/{id}/events", ar.ListReceivableEvents)

				// Cost centers + dashboard (finance)
				cc := &handlers.CostCenterHandler{DB: db}
				r.Post("/cost-centers", cc.Create)
				r.Get("/cost-centers", cc.List)

				dash := &handlers.DashboardHandler{DB: db}
				r.Get("/dashboard/finance/summary", dash.FinanceSummary)
			})

			// owner-only: gerenciar membros do tenant
			pr.Group(func(r chi.Router) {
				r.Use(mw.RequireRoles("owner"))

				mem := &handlers.MembersHandler{DB: db}
				r.Get("/members", mem.ListMembers)
				r.Post("/members", mem.CreateMember)
				r.Patch("/members/{user_id}", mem.UpdateMemberRole)
				r.Delete("/members/{user_id}", mem.RemoveMember)
			})

		})
	})

	return r
}
