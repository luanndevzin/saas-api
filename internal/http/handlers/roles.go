package handlers

import "strings"

const (
	roleOwner        = "owner"
	roleHR           = "hr"
	roleFinance      = "finance"
	roleCollaborator = "colaborador"
	roleLegacyMember = "member"
)

func normalizeRole(role string) string {
	normalized := strings.TrimSpace(strings.ToLower(role))
	if normalized == roleLegacyMember {
		return roleCollaborator
	}
	return normalized
}

func isValidRole(role string) bool {
	switch normalizeRole(role) {
	case roleOwner, roleHR, roleFinance, roleCollaborator:
		return true
	default:
		return false
	}
}
