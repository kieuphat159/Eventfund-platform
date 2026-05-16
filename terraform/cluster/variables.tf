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

variable "admin_user_arns" {
  type        = list(string)
  description = "List of IAM user ARNs to grant cluster admin access (for local development)"
  default     = []
}

# ─── SSM ─────────────────────────────────────────────────────────────────────
variable "ssm_prefix" {
  type        = string
  description = "SSM Parameter Store prefix for backend secrets"
}
