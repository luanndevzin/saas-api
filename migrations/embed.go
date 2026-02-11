package migrations

import "embed"

// FS holds the embedded SQL migrations so we can run goose without files on disk.
//go:embed *.sql
var FS embed.FS
