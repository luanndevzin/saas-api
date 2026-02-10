package main

import (
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"saas-api/internal/config"
	"saas-api/internal/db"
	httpserver "saas-api/internal/http"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})

	_ = godotenv.Load()
	
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("config load failed")
	}

	database, err := db.NewMySQL(cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPass, cfg.DBName)
	if err != nil {
		log.Fatal().Err(err).Msg("db connection failed")
	}
	defer database.Close()

	router := httpserver.NewRouter(database, log.Logger, []byte(cfg.JWTSecret), cfg.JWTIssuer, cfg.JWTTTLMinutes)

	log.Info().Str("addr", cfg.HTTPAddr).Msg("api listening")
	if err := http.ListenAndServe(cfg.HTTPAddr, router); err != nil {
		log.Fatal().Err(err).Msg("server failed")
	}
}
