package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/clickmaster4285/nexus_infrastructure/backend/core/internal/api"
	"github.com/clickmaster4285/nexus_infrastructure/backend/core/internal/db"
	"github.com/joho/godotenv"
)

func main() {
	// loads repo-root .env when you run from backend/core or repo root
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":5000"
	}

	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, api.NewRouter(pool)); err != nil {
		log.Fatal(err)
	}
}