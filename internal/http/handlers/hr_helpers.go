package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
)

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		msg := err.Error()
		switch {
		case strings.Contains(msg, "invalid character"):
			return fmt.Errorf("json invalido no corpo da requisicao")
		case strings.Contains(msg, "cannot unmarshal"):
			return fmt.Errorf("tipo de dado invalido em um ou mais campos")
		case strings.Contains(msg, "unknown field"):
			parts := strings.Split(msg, "\"")
			if len(parts) >= 2 {
				return fmt.Errorf("campo nao permitido: %s", parts[1])
			}
			return fmt.Errorf("campo nao permitido no corpo da requisicao")
		default:
			return fmt.Errorf("json invalido no corpo da requisicao")
		}
	}
	return nil
}

func httpError(w http.ResponseWriter, msg string, statusCode int) {
	http.Error(w, localizeHRMessage(msg), statusCode)
}

func localizeHRMessage(msg string) string {
	switch strings.TrimSpace(msg) {
	case "":
		return "erro interno inesperado"
	case "name is required":
		return "nome e obrigatorio"
	case "title is required":
		return "titulo e obrigatorio"
	case "db error":
		return "erro interno no banco de dados"
	case "db read error":
		return "erro ao consultar dados no banco"
	case "db commit error":
		return "erro ao confirmar operacao no banco"
	case "db update error":
		return "erro ao atualizar dados no banco"
	case "db delete error":
		return "erro ao remover dados no banco"
	case "could not create department (name/code may exist)":
		return "nao foi possivel criar departamento: nome ou codigo ja existe"
	case "could not create position (title may exist, or invalid department_id)":
		return "nao foi possivel criar cargo: titulo duplicado ou departamento invalido"
	case "status must be active|inactive|terminated":
		return "status deve ser active, inactive ou terminated"
	case "hire_date must be YYYY-MM-DD":
		return "hire_date deve estar no formato YYYY-MM-DD"
	case "salary_cents must be >= 0":
		return "salary_cents deve ser maior ou igual a 0"
	case "could not create employee (invalid dept/position?)":
		return "nao foi possivel criar colaborador: departamento, cargo ou gestor invalido"
	case "status filter must be active|inactive|terminated":
		return "filtro status deve ser active, inactive ou terminated"
	case "invalid employee id":
		return "id do colaborador invalido"
	case "employee not found":
		return "colaborador nao encontrado"
	case "name cannot be empty":
		return "nome nao pode ser vazio"
	case "termination_date must be YYYY-MM-DD":
		return "termination_date deve estar no formato YYYY-MM-DD"
	case "effective_at is required":
		return "effective_at e obrigatorio"
	case "effective_at must be YYYY-MM-DD":
		return "effective_at deve estar no formato YYYY-MM-DD"
	case "password must be at least 8 chars":
		return "senha deve ter no minimo 8 caracteres"
	case "could not create compensation":
		return "nao foi possivel criar historico de remuneracao"
	case "could not create location (name/code may exist)":
		return "nao foi possivel criar local: nome ou codigo ja existe"
	case "could not create team (name may exist)":
		return "nao foi possivel criar time: nome ja existe"
	case "could not create time off type (name may exist)":
		return "nao foi possivel criar tipo de folga: nome ja existe"
	case "start_date must be YYYY-MM-DD":
		return "start_date deve estar no formato YYYY-MM-DD"
	case "end_date must be YYYY-MM-DD":
		return "end_date deve estar no formato YYYY-MM-DD"
	case "end_date must be >= start_date":
		return "end_date deve ser maior ou igual a start_date"
	case "time_off_type not found":
		return "tipo de folga nao encontrado"
	case "could not create time off request":
		return "nao foi possivel criar solicitacao de folga"
	case "status filter must be pending|approved|rejected|canceled":
		return "filtro status deve ser pending, approved, rejected ou canceled"
	case "employee_id must be numeric":
		return "employee_id deve ser numerico"
	case "type_id must be numeric":
		return "type_id deve ser numerico"
	case "limit must be numeric":
		return "limit deve ser numerico"
	case "invalid request id":
		return "id da solicitacao invalido"
	case "time off request not found":
		return "solicitacao de folga nao encontrada"
	case "invalid status transition":
		return "transicao de status invalida"
	case "cost_cents must be >= 0":
		return "cost_cents deve ser maior ou igual a 0"
	case "could not create benefit (name may exist)":
		return "nao foi possivel criar beneficio: nome ja existe"
	case "benefit not found":
		return "beneficio nao encontrado"
	case "effective_date must be YYYY-MM-DD":
		return "effective_date deve estar no formato YYYY-MM-DD"
	case "could not assign benefit (maybe already assigned)":
		return "nao foi possivel vincular beneficio: vinculo ja existe ou dados invalidos"
	case "invalid benefit id":
		return "id do beneficio invalido"
	case "relation not found":
		return "vinculo nao encontrado"
	case "doc_type is required":
		return "doc_type e obrigatorio"
	case "file_url is required":
		return "file_url e obrigatorio"
	case "expires_at must be YYYY-MM-DD":
		return "expires_at deve estar no formato YYYY-MM-DD"
	case "could not create document":
		return "nao foi possivel criar documento"
	case "employee profile not linked to user":
		return "usuario autenticado nao esta vinculado a um colaborador"
	case "employee is not active":
		return "colaborador nao esta ativo para bater ponto"
	case "employee is terminated":
		return "colaborador desligado nao pode receber conta de acesso"
	case "employee email is required":
		return "colaborador precisa ter email para criar conta de acesso"
	case "user already has elevated role":
		return "este usuario ja possui perfil administrativo neste tenant"
	case "user already linked to another employee":
		return "este usuario ja esta vinculado a outro colaborador"
	case "could not create user":
		return "nao foi possivel criar usuario para o colaborador"
	case "could not create membership":
		return "nao foi possivel criar permissao de acesso para o colaborador"
	case "could not link employee account":
		return "nao foi possivel vincular usuario ao colaborador"
	case "you already have an open time entry":
		return "ja existe uma batida em aberto para este colaborador"
	case "no open time entry found":
		return "nenhuma batida em aberto foi encontrada"
	case "could not create time entry":
		return "nao foi possivel registrar batida de entrada"
	case "could not close time entry":
		return "nao foi possivel registrar batida de saida"
	case "clockify api_key is required":
		return "api_key do Clockify e obrigatorio"
	case "clockify workspace_id is required":
		return "workspace_id do Clockify e obrigatorio"
	case "clockify is not configured":
		return "integracao Clockify nao configurada"
	case "clockify api key is invalid":
		return "api key do Clockify invalida"
	case "clockify workspace not found":
		return "workspace do Clockify nao encontrado"
	case "clockify rate limit exceeded":
		return "limite de requisicoes do Clockify excedido; tente novamente em instantes"
	case "clockify request failed":
		return "Clockify retornou erro ao processar a requisicao"
	case "clockify connection failed":
		return "nao foi possivel conectar no Clockify"
	case "target_daily_minutes must be between 1 and 960":
		return "target_daily_minutes deve ficar entre 1 e 960 minutos"
	case "seconds_delta or minutes_delta is required":
		return "informe seconds_delta ou minutes_delta"
	case "seconds_delta and minutes_delta cannot be used together":
		return "use apenas seconds_delta ou minutes_delta, nao os dois"
	case "delta must be non-zero":
		return "o ajuste nao pode ser zero"
	case "could not create time bank adjustment":
		return "nao foi possivel criar ajuste de banco de horas"
	case "period is closed for this date":
		return "o periodo desta data esta fechado"
	case "period_start is required":
		return "period_start e obrigatorio"
	case "period_end is required":
		return "period_end e obrigatorio"
	case "period_start must be YYYY-MM-DD":
		return "period_start deve estar no formato YYYY-MM-DD"
	case "period_end must be YYYY-MM-DD":
		return "period_end deve estar no formato YYYY-MM-DD"
	case "period_end must be >= period_start":
		return "period_end deve ser maior ou igual a period_start"
	case "another closed period overlaps selected range":
		return "ja existe periodo fechado que se sobrepoe ao intervalo selecionado"
	case "could not close time bank period":
		return "nao foi possivel fechar o periodo do banco de horas"
	case "time bank closure not found":
		return "fechamento de banco de horas nao encontrado"
	case "could not reopen time bank period":
		return "nao foi possivel reabrir o fechamento do banco de horas"
	case "adjustment status must be pending|approved|rejected":
		return "status do ajuste deve ser pending, approved ou rejected"
	case "time bank adjustment not found":
		return "ajuste de banco de horas nao encontrado"
	case "employee not found in closure":
		return "colaborador nao encontrado neste fechamento"
	case "allow_closed_period only for hr":
		return "somente o RH pode sincronizar ignorando periodo fechado"
	case "there are pending time bank adjustments in selected period":
		return "existem ajustes pendentes de aprovacao no periodo selecionado"
	default:
		return msg
	}
}

func genCode(prefix string) string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return prefix + "-" + hex.EncodeToString(b)
}

func insertAudit(exec sqlx.Ext, r *http.Request, tenantID, userID uint64, action, entity string, entityID int64, before any, after any) error {
	var beforeJSON any = nil
	var afterJSON any = nil

	if before != nil {
		b, _ := json.Marshal(before)
		beforeJSON = json.RawMessage(b)
	}
	if after != nil {
		a, _ := json.Marshal(after)
		afterJSON = json.RawMessage(a)
	}

	ip := r.RemoteAddr
	ua := r.UserAgent()

	_, err := exec.Exec(`
		INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, before_json, after_json, ip, user_agent)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		tenantID, userID, action, entity, entityID,
		nullableJSON(beforeJSON), nullableJSON(afterJSON),
		ip, ua,
	)
	return err
}

func nullableJSON(v any) any {
	if v == nil {
		return sql.NullString{}
	}
	// mysql driver aceita []byte/string/json.RawMessage
	switch vv := v.(type) {
	case json.RawMessage:
		return []byte(vv)
	default:
		b, _ := json.Marshal(vv)
		return b
	}
}

// dateOnly normaliza para meia-noite UTC, evitando horÃ¡rio na coluna DATE.
func dateOnly(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}
