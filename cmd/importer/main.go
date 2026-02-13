package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type syncRequest struct {
	StartDate string `json:"start_date"`
	EndDate   string `json:"end_date"`
}

type syncResponse struct {
	RangeStart       string `json:"range_start"`
	RangeEnd         string `json:"range_end"`
	EmployeesTotal   int    `json:"employees_total"`
	UsersFound       int    `json:"users_found"`
	EmployeesMapped  int    `json:"employees_mapped"`
	EntriesProcessed int    `json:"entries_processed"`
	EntriesUpserted  int    `json:"entries_upserted"`
	RunningEntries   int    `json:"running_entries"`
	SyncedAt         string `json:"synced_at"`
}

type statusPreview struct {
	EmployeeID uint64 `json:"employee_id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
}

type statusResponse struct {
	Configured               bool            `json:"configured"`
	WorkspaceID              string          `json:"workspace_id"`
	APIKeyMasked             string          `json:"api_key_masked"`
	LastSyncAt               string          `json:"last_sync_at"`
	EntriesTotal             int64           `json:"entries_total"`
	EntriesLast7Days         int64           `json:"entries_last_7_days"`
	EntriesRunning           int64           `json:"entries_running"`
	ActiveEmployees          int64           `json:"active_employees"`
	MappedEmployees          int64           `json:"mapped_employees"`
	ActiveUnmappedEmployees  int64           `json:"active_unmapped_employees"`
	UnmappedEmployeesPreview []statusPreview `json:"unmapped_employees_preview"`
}

func main() {
	var (
		action   string
		baseURL  string
		token    string
		startRaw string
		endRaw   string
		lastDays int
	)

	flag.StringVar(&action, "action", "sync", "Acao: sync ou status")
	flag.StringVar(&baseURL, "base-url", os.Getenv("API_URL"), "Base URL da API (ex: https://api/v1)")
	flag.StringVar(&token, "token", os.Getenv("API_TOKEN"), "Bearer token JWT")
	flag.StringVar(&startRaw, "start-date", "", "Data inicial (YYYY-MM-DD)")
	flag.StringVar(&endRaw, "end-date", "", "Data final (YYYY-MM-DD)")
	flag.IntVar(&lastDays, "last-days", 30, "Janela em dias para sync quando start/end nao informados")
	flag.Parse()

	if baseURL == "" || token == "" {
		fmt.Println("Uso: importer -action sync|status -base-url https://api/v1 -token <JWT>")
		os.Exit(1)
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	switch strings.ToLower(strings.TrimSpace(action)) {
	case "status":
		status, err := getStatus(baseURL, token)
		if err != nil {
			fatalf("erro ao consultar status: %v", err)
		}
		printStatus(status)

	case "sync":
		startDate, endDate, err := resolveDateRange(startRaw, endRaw, lastDays)
		if err != nil {
			fatalf("datas invalidas: %v", err)
		}
		resp, err := runSync(baseURL, token, syncRequest{
			StartDate: startDate,
			EndDate:   endDate,
		})
		if err != nil {
			fatalf("erro ao sincronizar: %v", err)
		}
		fmt.Printf("Sync concluido (%s a %s)\n", resp.RangeStart, resp.RangeEnd)
		fmt.Printf("Usuarios encontrados: %d | Mapeados: %d\n", resp.UsersFound, resp.EmployeesMapped)
		fmt.Printf("Batidas processadas: %d | Gravadas: %d\n", resp.EntriesProcessed, resp.EntriesUpserted)

		status, err := getStatus(baseURL, token)
		if err != nil {
			fatalf("sync ok, mas falhou ao consultar status: %v", err)
		}
		printStatus(status)

	default:
		fatalf("acao invalida: %s (use sync ou status)", action)
	}
}

func resolveDateRange(startRaw, endRaw string, lastDays int) (string, string, error) {
	if lastDays < 1 {
		lastDays = 30
	}

	if strings.TrimSpace(startRaw) == "" && strings.TrimSpace(endRaw) == "" {
		end := time.Now().UTC()
		start := end.AddDate(0, 0, -lastDays)
		return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
	}

	start, err := parseDateArg(startRaw)
	if err != nil {
		return "", "", fmt.Errorf("start-date: %w", err)
	}
	end, err := parseDateArg(endRaw)
	if err != nil {
		return "", "", fmt.Errorf("end-date: %w", err)
	}
	if end.Before(start) {
		return "", "", fmt.Errorf("end-date deve ser >= start-date")
	}
	return start.Format("2006-01-02"), end.Format("2006-01-02"), nil
}

func parseDateArg(raw string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, fmt.Errorf("obrigatorio")
	}
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, err
	}
	return t.UTC(), nil
}

func runSync(baseURL, token string, body syncRequest) (syncResponse, error) {
	var out syncResponse
	if err := doJSON(baseURL+"/integrations/clockify/sync", token, http.MethodPost, body, &out); err != nil {
		return syncResponse{}, err
	}
	return out, nil
}

func getStatus(baseURL, token string) (statusResponse, error) {
	var out statusResponse
	if err := doJSON(baseURL+"/integrations/clockify/status", token, http.MethodGet, nil, &out); err != nil {
		return statusResponse{}, err
	}
	return out, nil
}

func doJSON(url, token, method string, payload any, dst any) error {
	var body io.Reader
	if payload != nil {
		b, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}
	if len(respBody) == 0 || dst == nil {
		return nil
	}
	return json.Unmarshal(respBody, dst)
}

func printStatus(status statusResponse) {
	fmt.Println("----- Clockify Status -----")
	fmt.Printf("Configurado: %t\n", status.Configured)
	if !status.Configured {
		return
	}
	fmt.Printf("Workspace: %s\n", status.WorkspaceID)
	fmt.Printf("API Key: %s\n", status.APIKeyMasked)
	if status.LastSyncAt != "" {
		fmt.Printf("Ultima sincronizacao: %s\n", status.LastSyncAt)
	}
	fmt.Printf("Registros totais: %d\n", status.EntriesTotal)
	fmt.Printf("Registros ultimos 7 dias: %d\n", status.EntriesLast7Days)
	fmt.Printf("Em andamento: %d\n", status.EntriesRunning)
	fmt.Printf("Ativos: %d | Mapeados: %d | Sem mapeamento: %d\n",
		status.ActiveEmployees,
		status.MappedEmployees,
		status.ActiveUnmappedEmployees,
	)

	if len(status.UnmappedEmployeesPreview) > 0 {
		fmt.Println("Preview sem mapeamento:")
		for _, item := range status.UnmappedEmployeesPreview {
			email := item.Email
			if strings.TrimSpace(email) == "" {
				email = "sem email"
			}
			fmt.Printf("- #%d %s (%s)\n", item.EmployeeID, item.Name, email)
		}
	}
}

func fatalf(format string, args ...any) {
	fmt.Fprintf(os.Stderr, format+"\n", args...)
	os.Exit(1)
}
