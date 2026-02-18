package handlers

import (
	"github.com/jmoiron/sqlx"
	"time"
)

type HRHandler struct {
	DB *sqlx.DB
}

type Department struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Code      *string   `db:"code" json:"code,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type Position struct {
	ID           uint64    `db:"id" json:"id"`
	TenantID     uint64    `db:"tenant_id" json:"tenant_id"`
	DepartmentID *uint64   `db:"department_id" json:"department_id,omitempty"`
	Title        string    `db:"title" json:"title"`
	Level        *string   `db:"level" json:"level,omitempty"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

type Employee struct {
	ID              uint64     `db:"id" json:"id"`
	TenantID        uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeCode    string     `db:"employee_code" json:"employee_code"`
	Name            string     `db:"name" json:"name"`
	Email           *string    `db:"email" json:"email,omitempty"`
	CPF             *string    `db:"cpf" json:"cpf,omitempty"`
	CBO             *string    `db:"cbo" json:"cbo,omitempty"`
	CTPS            *string    `db:"ctps" json:"ctps,omitempty"`
	Status          string     `db:"status" json:"status"`
	HireDate        *time.Time `db:"hire_date" json:"hire_date,omitempty"`
	TerminationDate *time.Time `db:"termination_date" json:"termination_date,omitempty"`
	DepartmentID    *uint64    `db:"department_id" json:"department_id,omitempty"`
	PositionID      *uint64    `db:"position_id" json:"position_id,omitempty"`
	ManagerID       *uint64    `db:"manager_id" json:"manager_id,omitempty"`
	SalaryCents     int64      `db:"salary_cents" json:"salary_cents"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt       time.Time  `db:"updated_at" json:"updated_at"`
}

type createDepartmentReq struct {
	Name string  `json:"name"`
	Code *string `json:"code"`
}
type createPositionReq struct {
	Title        string  `json:"title"`
	Level        *string `json:"level"`
	DepartmentID *uint64 `json:"department_id"`
}
type createEmployeeReq struct {
	Name         string  `json:"name"`
	Email        *string `json:"email"`
	CPF          *string `json:"cpf"`
	CBO          *string `json:"cbo"`
	CTPS         *string `json:"ctps"`
	Status       *string `json:"status"`       // active/inactive/terminated
	HireDate     *string `json:"hire_date"`    // YYYY-MM-DD
	SalaryCents  *int64  `json:"salary_cents"` // inteiro em centavos
	DepartmentID *uint64 `json:"department_id"`
	PositionID   *uint64 `json:"position_id"`
	ManagerID    *uint64 `json:"manager_id"`
}

type updateEmployeeReq struct {
	Name            *string `json:"name"`
	Email           *string `json:"email"`
	CPF             *string `json:"cpf"`
	CBO             *string `json:"cbo"`
	CTPS            *string `json:"ctps"`
	Status          *string `json:"status"`
	HireDate        *string `json:"hire_date"`
	TerminationDate *string `json:"termination_date"`
	DepartmentID    *uint64 `json:"department_id"`
	PositionID      *uint64 `json:"position_id"`
	ManagerID       *uint64 `json:"manager_id"`
	SalaryCents     *int64  `json:"salary_cents"`
}

type updateEmployeeStatusReq struct {
	Status          string  `json:"status"`
	TerminationDate *string `json:"termination_date"` // YYYY-MM-DD opcional
}

type EmployeeCompensation struct {
	ID             uint64    `db:"id" json:"id"`
	TenantID       uint64    `db:"tenant_id" json:"tenant_id"`
	EmployeeID     uint64    `db:"employee_id" json:"employee_id"`
	EffectiveAt    time.Time `db:"effective_at" json:"effective_at"`
	SalaryCents    int64     `db:"salary_cents" json:"salary_cents"`
	AdjustmentType *string   `db:"adjustment_type" json:"adjustment_type,omitempty"`
	Note           *string   `db:"note" json:"note,omitempty"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	CreatedBy      *uint64   `db:"created_by" json:"created_by,omitempty"`
}

type createCompensationReq struct {
	EffectiveAt    string  `json:"effective_at"`              // YYYY-MM-DD
	SalaryCents    int64   `json:"salary_cents"`              // >=0
	AdjustmentType *string `json:"adjustment_type,omitempty"` // promoÃ§Ã£o, mÃ©rito, correÃ§Ã£o, etc
	Note           *string `json:"note,omitempty"`
}

type Location struct {
	ID        uint64    `db:"id" json:"id"`
	TenantID  uint64    `db:"tenant_id" json:"tenant_id"`
	Name      string    `db:"name" json:"name"`
	Code      *string   `db:"code" json:"code,omitempty"`
	Kind      *string   `db:"kind" json:"kind,omitempty"`
	Country   *string   `db:"country" json:"country,omitempty"`
	State     *string   `db:"state" json:"state,omitempty"`
	City      *string   `db:"city" json:"city,omitempty"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type createLocationReq struct {
	Name    string  `json:"name"`
	Code    *string `json:"code"`
	Kind    *string `json:"kind"`    // office, remote, warehouse, etc
	Country *string `json:"country"` // ISO ou texto
	State   *string `json:"state"`
	City    *string `json:"city"`
}

type Team struct {
	ID                uint64    `db:"id" json:"id"`
	TenantID          uint64    `db:"tenant_id" json:"tenant_id"`
	Name              string    `db:"name" json:"name"`
	DepartmentID      *uint64   `db:"department_id" json:"department_id,omitempty"`
	ManagerEmployeeID *uint64   `db:"manager_employee_id" json:"manager_employee_id,omitempty"`
	LocationID        *uint64   `db:"location_id" json:"location_id,omitempty"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}

type createTeamReq struct {
	Name              string  `json:"name"`
	DepartmentID      *uint64 `json:"department_id"`
	ManagerEmployeeID *uint64 `json:"manager_employee_id"`
	LocationID        *uint64 `json:"location_id"`
}

type TimeOffType struct {
	ID               uint64    `db:"id" json:"id"`
	TenantID         uint64    `db:"tenant_id" json:"tenant_id"`
	Name             string    `db:"name" json:"name"`
	Description      *string   `db:"description" json:"description,omitempty"`
	RequiresApproval bool      `db:"requires_approval" json:"requires_approval"`
	CreatedAt        time.Time `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time `db:"updated_at" json:"updated_at"`
}

type createTimeOffTypeReq struct {
	Name             string  `json:"name"`
	Description      *string `json:"description"`
	RequiresApproval *bool   `json:"requires_approval"`
}

type TimeOffRequest struct {
	ID         uint64     `db:"id" json:"id"`
	TenantID   uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID uint64     `db:"employee_id" json:"employee_id"`
	TypeID     uint64     `db:"type_id" json:"type_id"`
	Status     string     `db:"status" json:"status"`
	StartDate  time.Time  `db:"start_date" json:"start_date"`
	EndDate    time.Time  `db:"end_date" json:"end_date"`
	Reason     *string    `db:"reason" json:"reason,omitempty"`
	Decision   *string    `db:"decision_note" json:"decision_note,omitempty"`
	ApproverID *uint64    `db:"approver_id" json:"approver_id,omitempty"`
	ReviewedAt *time.Time `db:"reviewed_at" json:"reviewed_at,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
}

type createTimeOffRequestReq struct {
	EmployeeID uint64  `json:"employee_id"`
	TypeID     uint64  `json:"type_id"`
	StartDate  string  `json:"start_date"` // YYYY-MM-DD
	EndDate    string  `json:"end_date"`   // YYYY-MM-DD
	Reason     *string `json:"reason"`
}

type decisionReq struct {
	Note *string `json:"note"`
}

type Benefit struct {
	ID            uint64    `db:"id" json:"id"`
	TenantID      uint64    `db:"tenant_id" json:"tenant_id"`
	Name          string    `db:"name" json:"name"`
	Provider      *string   `db:"provider" json:"provider,omitempty"`
	CostCents     int64     `db:"cost_cents" json:"cost_cents"`
	CoverageLevel *string   `db:"coverage_level" json:"coverage_level,omitempty"`
	CreatedAt     time.Time `db:"created_at" json:"created_at"`
	UpdatedAt     time.Time `db:"updated_at" json:"updated_at"`
}

type createBenefitReq struct {
	Name          string  `json:"name"`
	Provider      *string `json:"provider"`
	CostCents     *int64  `json:"cost_cents"`
	CoverageLevel *string `json:"coverage_level"`
}

type employeeBenefitReq struct {
	BenefitID     uint64  `json:"benefit_id"`
	EffectiveDate *string `json:"effective_date"` // opcional
}

type EmployeeBenefit struct {
	BenefitID     uint64     `db:"benefit_id" json:"benefit_id"`
	EmployeeID    uint64     `db:"employee_id" json:"employee_id"`
	EffectiveDate *time.Time `db:"effective_date" json:"effective_date,omitempty"`
	Name          string     `db:"name" json:"name"`
	Provider      *string    `db:"provider" json:"provider,omitempty"`
	CoverageLevel *string    `db:"coverage_level" json:"coverage_level,omitempty"`
	CostCents     int64      `db:"cost_cents" json:"cost_cents"`
}

type EmployeeDocument struct {
	ID         uint64     `db:"id" json:"id"`
	TenantID   uint64     `db:"tenant_id" json:"tenant_id"`
	EmployeeID uint64     `db:"employee_id" json:"employee_id"`
	DocType    string     `db:"doc_type" json:"doc_type"`
	FileName   *string    `db:"file_name" json:"file_name,omitempty"`
	FileURL    string     `db:"file_url" json:"file_url"`
	ExpiresAt  *time.Time `db:"expires_at" json:"expires_at,omitempty"`
	Note       *string    `db:"note" json:"note,omitempty"`
	UploadedBy *uint64    `db:"uploaded_by" json:"uploaded_by,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}

type createEmployeeDocumentReq struct {
	DocType   string  `json:"doc_type"`
	FileName  *string `json:"file_name"`
	FileURL   string  `json:"file_url"`
	ExpiresAt *string `json:"expires_at"` // YYYY-MM-DD
	Note      *string `json:"note"`
}
