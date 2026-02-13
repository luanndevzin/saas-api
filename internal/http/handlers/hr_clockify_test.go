package handlers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestClockifyClientRetriesOn429(t *testing.T) {
	var attempts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := atomic.AddInt32(&attempts, 1)
		if n <= 2 {
			w.Header().Set("Retry-After", "0")
			http.Error(w, "rate limit", http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[{"id":"u1","name":"Ana","email":"ana@example.com"}]`))
	}))
	defer srv.Close()

	client := &clockifyClient{
		baseURL:     srv.URL,
		apiKey:      "test-key",
		client:      srv.Client(),
		maxAttempts: 3,
		baseDelay:   time.Millisecond,
		maxDelay:    5 * time.Millisecond,
	}

	users, err := client.ListUsers(context.Background(), "ws-1")
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if len(users) != 1 {
		t.Fatalf("expected 1 user, got %d", len(users))
	}
	if got := atomic.LoadInt32(&attempts); got != 3 {
		t.Fatalf("expected 3 attempts, got %d", got)
	}
}

func TestClockifyClientDoesNotRetryOn400(t *testing.T) {
	var attempts int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&attempts, 1)
		http.Error(w, "bad request", http.StatusBadRequest)
	}))
	defer srv.Close()

	client := &clockifyClient{
		baseURL:     srv.URL,
		apiKey:      "test-key",
		client:      srv.Client(),
		maxAttempts: 3,
		baseDelay:   time.Millisecond,
		maxDelay:    5 * time.Millisecond,
	}

	_, err := client.ListUsers(context.Background(), "ws-1")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	var reqErr *clockifyHTTPError
	if !errors.As(err, &reqErr) {
		t.Fatalf("expected clockifyHTTPError, got %T", err)
	}
	if reqErr.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", reqErr.StatusCode)
	}
	if got := atomic.LoadInt32(&attempts); got != 1 {
		t.Fatalf("expected 1 attempt, got %d", got)
	}
}

func TestParseISODurationSeconds(t *testing.T) {
	tests := []struct {
		in   string
		want int64
	}{
		{in: "PT1H", want: 3600},
		{in: "PT2H30M", want: 9000},
		{in: "PT45M15S", want: 2715},
		{in: "PT0S", want: 0},
		{in: "invalid", want: 0},
	}

	for _, tc := range tests {
		got := parseISODurationSeconds(tc.in)
		if got != tc.want {
			t.Fatalf("parseISODurationSeconds(%q): got %d want %d", tc.in, got, tc.want)
		}
	}
}

func TestNextRunAtUTCHour(t *testing.T) {
	now := time.Date(2026, 2, 13, 10, 0, 0, 0, time.UTC)
	got := nextRunAtUTCHour(now, 9)
	want := time.Date(2026, 2, 14, 9, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("expected %s, got %s", want, got)
	}

	got = nextRunAtUTCHour(now, 15)
	want = time.Date(2026, 2, 13, 15, 0, 0, 0, time.UTC)
	if !got.Equal(want) {
		t.Fatalf("expected %s, got %s", want, got)
	}
}
