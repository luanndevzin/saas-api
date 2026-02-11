package main

import (
	"encoding/csv"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type employee struct {
	ID           uint64  `json:"id"`
	EmployeeCode string  `json:"employee_code"`
	Name         string  `json:"name"`
	Email        *string `json:"email"`
}

type timeEntryReq struct {
	EmployeeID uint64  `json:"employee_id"`
	ClockIn    string  `json:"clock_in"`
	ClockOut   *string `json:"clock_out,omitempty"`
	NoteIn     *string `json:"note_in,omitempty"`
	NoteOut    *string `json:"note_out,omitempty"`
}

func main() {
	var (
		csvPath string
		baseURL string
		token   string
	)
	flag.StringVar(&csvPath, "file", "", "CSV com colunas: employee_code,clock_in,clock_out,note_in,note_out")
	flag.StringVar(&baseURL, "base-url", os.Getenv("API_URL"), "Base URL da API (ex: https://api/v1)")
	flag.StringVar(&token, "token", os.Getenv("API_TOKEN"), "Bearer token JWT")
	flag.Parse()

	if csvPath == "" || baseURL == "" || token == "" {
		fmt.Println("Uso: importer -file registros.csv -base-url https://api/v1 -token <JWT>")
		os.Exit(1)
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	empMap, err := loadEmployees(baseURL, token)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao carregar employees: %v\n", err)
		os.Exit(1)
	}

	file, err := os.Open(csvPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro ao abrir CSV: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	r := csv.NewReader(file)
	r.FieldsPerRecord = -1
	header, err := r.Read()
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro lendo header: %v\n", err)
		os.Exit(1)
	}
	idx := colIndex(header)
	rowNum := 1
	imported := 0
	for {
		row, err := r.Read()
		if err == io.EOF {
			break
		}
		rowNum++
		if err != nil {
			fmt.Fprintf(os.Stderr, "linha %d: %v\n", rowNum, err)
			continue
		}
		rec := recordFromRow(row, idx)
		empID, ok := empMap[rec.EmployeeCode]
		if !ok {
			fmt.Fprintf(os.Stderr, "linha %d: employee_code %s não encontrado\n", rowNum, rec.EmployeeCode)
			continue
		}

		body := timeEntryReq{
			EmployeeID: empID,
			ClockIn:    rec.ClockIn,
			ClockOut:   opt(rec.ClockOut),
			NoteIn:     opt(rec.NoteIn),
			NoteOut:    opt(rec.NoteOut),
		}
		if err := postTimeEntry(baseURL, token, body); err != nil {
			fmt.Fprintf(os.Stderr, "linha %d: erro ao enviar: %v\n", rowNum, err)
			continue
		}
		imported++
	}
	fmt.Printf("Importação concluída. Registros inseridos: %d\n", imported)
}

type rowData struct {
	EmployeeCode string
	ClockIn      string
	ClockOut     string
	NoteIn       string
	NoteOut      string
}

func colIndex(header []string) map[string]int {
	m := map[string]int{}
	for i, h := range header {
		key := strings.ToLower(strings.TrimSpace(h))
		m[key] = i
	}
	return m
}

func recordFromRow(row []string, idx map[string]int) rowData {
	get := func(name string) string {
		if i, ok := idx[name]; ok && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	return rowData{
		EmployeeCode: get("employee_code"),
		ClockIn:      normalizeDate(get("clock_in")),
		ClockOut:     normalizeDate(get("clock_out")),
		NoteIn:       get("note_in"),
		NoteOut:      get("note_out"),
	}
}

func normalizeDate(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	// tenta converter formatos comuns (ex: 2026-02-11 10:00)
	layouts := []string{"2006-01-02 15:04", "2006-01-02"}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC().Format(time.RFC3339)
		}
	}
	return s // assume já está em RFC3339
}

func opt(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

func loadEmployees(baseURL, token string) (map[string]uint64, error) {
	req, _ := http.NewRequest(http.MethodGet, baseURL+"/employees", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GET /employees status %d", resp.StatusCode)
	}
	var employees []employee
	if err := json.NewDecoder(resp.Body).Decode(&employees); err != nil {
		return nil, err
	}
	out := make(map[string]uint64, len(employees))
	for _, e := range employees {
		code := strings.TrimSpace(e.EmployeeCode)
		if code != "" {
			out[code] = e.ID
		}
	}
	return out, nil
}

func postTimeEntry(baseURL, token string, body timeEntryReq) error {
	b, _ := json.Marshal(body)
	req, _ := http.NewRequest(http.MethodPost, baseURL+"/time-entries", strings.NewReader(string(b)))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		msg, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("status %d: %s", resp.StatusCode, string(msg))
	}
	return nil
}
