package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey string

const (
	CtxUserID   ctxKey = "user_id"
	CtxTenantID ctxKey = "tenant_id"
	CtxRole     ctxKey = "role"
)

type Claims struct {
	UserID   uint64 `json:"uid"`
	TenantID uint64 `json:"tid"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func AuthJWT(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if auth == "" || !strings.HasPrefix(auth, "Bearer ") {
				http.Error(w, "missing bearer token", http.StatusUnauthorized)
				return
			}
			tokenStr := strings.TrimPrefix(auth, "Bearer ")

			token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, errors.New("invalid signing method")
				}
				return secret, nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*Claims)
			if !ok {
				http.Error(w, "invalid token claims", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), CtxUserID, claims.UserID)
			ctx = context.WithValue(ctx, CtxTenantID, claims.TenantID)
			ctx = context.WithValue(ctx, CtxRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) uint64 {
	v, _ := ctx.Value(CtxUserID).(uint64)
	return v
}
func GetTenantID(ctx context.Context) uint64 {
	v, _ := ctx.Value(CtxTenantID).(uint64)
	return v
}
func GetRole(ctx context.Context) string {
	v, _ := ctx.Value(CtxRole).(string)
	return v
}
