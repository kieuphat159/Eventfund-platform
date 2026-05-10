variable "region" {
  type        = string
  description = "AWS region"
}

variable "project_name" {
  type        = string
  description = "Name prefix for all resources"
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

# ─── EKS ─────────────────────────────────────────────────────────────────────
variable "eks_version" {
  type        = string
  description = "Kubernetes version"
}

variable "node_group_instance_types" {
  type        = list(string)
  description = "EC2 instance types for worker nodes"
}

variable "node_desired_capacity" {
  type        = number
  description = "Desired number of worker nodes"
}

variable "node_min_capacity" {
  type        = number
  description = "Minimum number of worker nodes"
}

variable "node_max_capacity" {
  type        = number
  description = "Maximum number of worker nodes (for Cluster Autoscaler)"
}

variable "node_capacity_type" {
  type        = string
  description = "SPOT or ON_DEMAND"
  default     = "SPOT"
}

variable "node_ami_type" {
  type        = string
  description = "AMI type for node group"
  default     = "AL2023_x86_64_STANDARD"
}

variable "node_disk_size" {
  type        = number
  description = "Root EBS disk size in GiB"
  default     = 20
}

variable "node_max_unavailable" {
  type        = number
  description = "Max nodes unavailable during rolling update"
  default     = 1
}

variable "node_repair_enabled" {
  type        = bool
  description = "Auto-replace unhealthy nodes"
  default     = true
}

variable "cluster_endpoint_private_access" {
  type        = bool
  description = "Enable private API server endpoint"
  default     = true
}

variable "cluster_endpoint_public_access" {
  type        = bool
  description = "Enable public API server endpoint"
  default     = true
}

variable "cluster_public_access_cidrs" {
  type        = list(string)
  description = "CIDRs allowed to access public API endpoint"
  default     = ["0.0.0.0/0"]
}

variable "service_ipv4_cidr" {
  type        = string
  description = "CIDR for Kubernetes Service IPs"
  default     = "172.20.0.0/16"
}

variable "cluster_log_types" {
  type        = list(string)
  description = "Control plane log types: api, audit, authenticator, controllerManager, scheduler"
  default     = []
}

variable "authentication_mode" {
  type        = string
  description = "CONFIG_MAP | API | API_AND_CONFIG_MAP"
  default     = "API_AND_CONFIG_MAP"
}

variable "bootstrap_admin_permissions" {
  type        = bool
  description = "Grant cluster creator admin permissions"
  default     = true
}

# ─── ECR ─────────────────────────────────────────────────────────────────────
variable "ecr_backend_repo" {
  type        = string
  description = "ECR repository name for backend"
}

# ─── SSM ─────────────────────────────────────────────────────────────────────
variable "ssm_prefix" {
  type        = string
  description = "SSM Parameter Store prefix for backend secrets"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

variable "github_actions_role_name" {
  type        = string
  description = "IAM role name for GitHub Actions OIDC"
}

variable "github_repos" {
  type        = list(string)
  description = "GitHub repos allowed to assume the GitHub Actions IAM role"
}

variable "security_reports_bucket" {
  type        = string
  description = "S3 bucket name for security scan reports"
}

variable "security_reports_retention_days" {
  type        = number
  description = "Days before security report objects are deleted"
}

# ─── ArgoCD ──────────────────────────────────────────────────────────────────
variable "argocd_repo_url" {
  type        = string
  description = "GitHub repo URL for ArgoCD to sync"
}

variable "argocd_target_revision" {
  type        = string
  description = "Git branch/tag for ArgoCD to sync"
  default     = "main"
}

variable "argocd_app_namespace" {
  type        = string
  description = "Kubernetes namespace to deploy app into"
  default     = "eventfund-dev"
}
