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

# ─── VPC ─────────────────────────────────────────────────────────────────────
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
}

variable "public_subnets_cidr" {
  type        = list(string)
  description = "CIDR blocks for public subnets (ALB)"
}

variable "private_subnets_cidr" {
  type        = list(string)
  description = "CIDR blocks for private subnets (EKS nodes)"
}

variable "azs" {
  type        = list(string)
  description = "Availability zones"
}

# ─── ECR ─────────────────────────────────────────────────────────────────────
variable "ecr_backend_repo" {
  type        = string
  description = "ECR repository name for backend"
}

# ─── GitHub Actions ──────────────────────────────────────────────────────────
variable "github_actions_role_name" {
  type        = string
  description = "IAM role name for GitHub Actions OIDC"
}

variable "github_repos" {
  type        = list(string)
  description = "GitHub repos allowed to assume the GitHub Actions IAM role"
}

# ─── S3 Security Reports ─────────────────────────────────────────────────────
variable "security_reports_bucket" {
  type        = string
  description = "S3 bucket name for security scan reports"
}

variable "security_reports_retention_days" {
  type        = number
  description = "Days before security report objects are deleted"
}
