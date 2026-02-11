package main

import (
	"flag"
	"log"
	"net/http"
)

func main() {
	addr := flag.String("addr", ":5500", "listen address")
	dir := flag.String("dir", "web", "directory to serve")
	flag.Parse()

	handler := http.FileServer(http.Dir(*dir))

	log.Printf("serving %s on http://localhost%s", *dir, *addr)
	if err := http.ListenAndServe(*addr, handler); err != nil {
		log.Fatal(err)
	}
}
