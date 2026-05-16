variable "region" {
  type        = string
  description = "AWS region"
}

variable "project_name" {
  type        = string
  description = "Name prefix for all resources"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

# ─── ArgoCD ──────────────────────────────────────────────────────────────────
variable "argocd_repo_url" {
  type        = string
  description = "GitHub repo URL for ArgoCD to sync (both dev and prod applications)"
}
