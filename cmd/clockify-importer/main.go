package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type clockifyInterval struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type clockifyEntry struct {
	ID           string           `json:"id"`
	UserID       string           `json:"userId"`
	TimeInterval clockifyInterval `json:"timeInterval"`
	Description  string           `json:"description"`
}

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
		ws        string
		apiKey    string
		baseURL   string
		token     string
		from      string
		to        string
		mapInline string
		mapFile   string
		pageSize  int
	)

	flag.StringVar(&ws, "workspace", os.Getenv("CLOCKIFY_WORKSPACE"), "Clockify workspace ID")
	flag.StringVar(&apiKey, "api-key", os.Getenv("CLOCKIFY_API_KEY"), "Clockify API key")
	flag.StringVar(&baseURL, "base-url", os.Getenv("API_URL"), "SaaS API base (ex: https://api/v1)")
	flag.StringVar(&token, "token", os.Getenv("API_TOKEN"), "Bearer JWT owner/hr")
	flag.StringVar(&from, "from", "", "Start ISO (ex: 2026-02-10T00:00:00Z)")
	flag.StringVar(&to, "to", "", "End ISO")
	flag.StringVar(&mapInline, "map", os.Getenv("CLOCKIFY_MAP"), "userId=EMP-001,user2=EMP-002")
	flag.StringVar(&mapFile, "map-file", "", "JSON file {\"clockifyUserId\":\"EMP-001\"}")
	flag.IntVar(&pageSize, "page-size", 200, "Clockify page size")
	flag.Parse()

	if ws == "" || apiKey == "" || baseURL == "" || token == "" || from == "" || to == "" {
		fmt.Println("Uso: clockify-importer -workspace <id> -api-key <key> -base-url https://api/v1 -token <JWT> -from <ISO> -to <ISO> [-map user=EMP-001] [-map-file map.json]")
		os.Exit(1)
	}
	baseURL = strings.TrimSuffix(baseURL, "/")

	mapping := make(map[string]string)
	if mapInline != "" {
		pairs := strings.Split(mapInline, ",")
		for _, p := range pairs {
			kv := strings.SplitN(p, "=", 2)
			if len(kv) == 2 {
				mapping[strings.TrimSpace(kv[0])] = strings.TrimSpace(kv[1])
			}
		}
	}
	if mapFile != "" {
		b, err := os.ReadFile(mapFile)
		if err != nil {
			fmt.Fprintf(os.Stderr, "erro lendo map-file: %v\n", err)
			os.Exit(1)
		}
		var m map[string]string
		if err := json.Unmarshal(b, &m); err != nil {
			fmt.Fprintf(os.Stderr, "erro parse map-file: %v\n", err)
			os.Exit(1)
		}
		for k, v := range m {
			mapping[k] = v
		}
	}

	empMap, err := loadEmployees(baseURL, token)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro carregando employees: %v\n", err)
		os.Exit(1)
	}

	entries, err := fetchClockify(ws, apiKey, from, to, pageSize)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro buscando clockify: %v\n", err)
		os.Exit(1)
	}

	imported := 0
	for _, e := range entries {
		code, ok := mapping[e.UserID]
		if !ok {
			fmt.Fprintf(os.Stderr, "skip user %s: sem mapping (use -map ou -map-file)\n", e.UserID)
			continue
		}
		empID, ok := empMap[strings.TrimSpace(code)]
		if !ok {
			fmt.Fprintf(os.Stderr, "skip user %s: employee_code %s não encontrado no SaaS\n", e.UserID, code)
			continue
		}
		body := timeEntryReq{EmployeeID: empID, ClockIn: e.TimeInterval.Start}
		if e.TimeInterval.End != "" {
			body.ClockOut = &e.TimeInterval.End
		}
		if err := postTimeEntry(baseURL, token, body); err != nil {
			fmt.Fprintf(os.Stderr, "falha enviar entry %s: %v\n", e.ID, err)
			continue
		}
		imported++
	}
	fmt.Printf("Importados %d registros\n", imported)
}

func fetchClockify(ws, apiKey, from, to string, pageSize int) ([]clockifyEntry, error) {
	client := &http.Client{Timeout: 20 * time.Second}
	page := 1
	all := []clockifyEntry{}
	for {
		url := fmt.Sprintf("https://api.clockify.me/api/v1/workspaces/%s/time-entries?start=%s&end=%s&page=%d&page-size=%d", ws, from, to, page, pageSize)
		req, _ := http.NewRequest(http.MethodGet, url, nil)
		req.Header.Set("X-Api-Key", apiKey)
		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("clockify status %d: %s", resp.StatusCode, string(b))
		}
		var items []clockifyEntry
		if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()
		if len(items) == 0 {
			break
		}
		all = append(all, items...)
		if len(items) < pageSize {
			break
		}
		page++
	}
	return all, nil
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
	var emps []employee
	if err := json.NewDecoder(resp.Body).Decode(&emps); err != nil {
		return nil, err
	}
	out := make(map[string]uint64, len(emps))
	for _, e := range emps {
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
