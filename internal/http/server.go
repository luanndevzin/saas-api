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

			// -------------------
			// RH: owner + hr
			// -------------------
			pr.Group(func(r chi.Router) {
				r.Use(mw.RequireRoles("owner", "hr"))

				hr := &handlers.HRHandler{DB: db}
				r.Post("/departments", hr.CreateDepartment)
				r.Get("/departments", hr.ListDepartments)

				r.Post("/positions", hr.CreatePosition)
				r.Get("/positions", hr.ListPositions)

				r.Post("/employees", hr.CreateEmployee)
				r.Get("/employees", hr.ListEmployees)

				r.Post("/time-entries/clock-in", hr.ClockIn)
				r.Post("/time-entries/clock-out", hr.ClockOut)
				r.Get("/time-entries", hr.ListTimeEntries)
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
