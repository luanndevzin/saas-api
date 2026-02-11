package db

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/pressly/goose/v3"

	"saas-api/migrations"
)

// Migrate applies all up migrations using the embedded files.
func Migrate(ctx context.Context, db *sqlx.DB) error {
	goose.SetBaseFS(migrations.FS)
	goose.SetDialect("mysql")

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	return goose.UpContext(ctx, db.DB, ".")
}
