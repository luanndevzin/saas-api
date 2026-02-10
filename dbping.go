package main

import (
  "fmt"
  "os"

  "github.com/joho/godotenv"
  "saas-api/internal/config"
  "saas-api/internal/db"
)

func main() {
  _ = godotenv.Load()
  cfg, err := config.Load()
  if err != nil {
    fmt.Println("config error:", err)
    os.Exit(1)
  }
  conn, err := db.NewMySQL(cfg.DBHost, cfg.DBPort, cfg.DBUser, cfg.DBPass, cfg.DBName)
  if err != nil {
    fmt.Println("db connect error:", err)
    os.Exit(1)
  }
  defer conn.Close()
  fmt.Printf("ok: connected to %s:%s/%s as %s\n", cfg.DBHost, cfg.DBPort, cfg.DBName, cfg.DBUser)
}
