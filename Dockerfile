# syntax=docker/dockerfile:1.6
FROM golang:1.24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache build-base
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /app/bin/api ./cmd/api

FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=builder /app/bin/api ./api
COPY swagger ./swagger
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/app/api"]
