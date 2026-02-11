package config

import (
	"os"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	AppEnv   string `env:"APP_ENV" envDefault:"dev"`
	HTTPAddr string `env:"HTTP_ADDR" envDefault:":8080"`

	DBHost string `env:"DB_HOST" envDefault:"127.0.0.1"`
	DBPort string `env:"DB_PORT" envDefault:"3306"`
	DBUser string `env:"DB_USER" envDefault:"root"`
	DBPass string `env:"DB_PASS" envDefault:"luan"`
	DBName string `env:"DB_NAME" envDefault:"saas"`

	JWTSecret     string `env:"JWT_SECRET,required"`
	JWTIssuer     string `env:"JWT_ISSUER" envDefault:"saas-api"`
	JWTTTLMinutes int    `env:"JWT_TTL_MINUTES" envDefault:"60"`

	FacePHashThreshold int `env:"FACE_PHASH_THRESHOLD" envDefault:"18"`

	RunMigrations bool `env:"RUN_MIGRATIONS" envDefault:"true"`
}

func Load() (Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return cfg, err
	}

	// Railway/Heroku-style PORT fallback
	if port := os.Getenv("PORT"); port != "" && cfg.HTTPAddr == ":8080" {
		cfg.HTTPAddr = ":" + port
	}

	// Railway/MySQL defaults: if explicit DB_* not set, derive from MYSQL* vars
	if cfg.DBHost == "" || cfg.DBHost == "127.0.0.1" {
		if v := os.Getenv("MYSQLHOST"); v != "" {
			cfg.DBHost = v
		}
	}
	if cfg.DBPort == "" || cfg.DBPort == "3306" {
		if v := os.Getenv("MYSQLPORT"); v != "" {
			cfg.DBPort = v
		}
	}
	if cfg.DBUser == "" || cfg.DBUser == "root" {
		if v := os.Getenv("MYSQLUSER"); v != "" {
			cfg.DBUser = v
		}
	}
	if cfg.DBPass == "" || cfg.DBPass == "luan" {
		if v := os.Getenv("MYSQLPASSWORD"); v != "" {
			cfg.DBPass = v
		}
	}
	if cfg.DBName == "" || cfg.DBName == "saas" {
		if v := os.Getenv("MYSQLDATABASE"); v != "" {
			cfg.DBName = v
		}
	}

	return cfg, nil
}
