variable "cluster_name"         { type = string }
variable "vpc_id"                { type = string }
variable "private_subnet_ids"    { type = list(string) }
variable "eks_version"           { type = string }
variable "node_instance_types"   { type = list(string) }
variable "node_desired_capacity" { type = number }
variable "node_min_capacity"     { type = number }
variable "node_max_capacity"     { type = number }

variable "node_capacity_type" {
  type        = string
  description = "SPOT | ON_DEMAND | CAPACITY_BLOCK"
  default     = "SPOT"
}

variable "node_ami_type" {
  type        = string
  description = "AMI type: AL2023_x86_64_STANDARD | AL2_x86_64 | BOTTLEROCKET_x86_64 | ..."
  default     = "AL2023_x86_64_STANDARD"
}

variable "node_disk_size" {
  type        = number
  description = "Root EBS disk size in GiB (default 20 for Linux, 50 for Windows)"
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
  description = "CIDR for Kubernetes Service IPs (must not overlap VPC CIDR)"
  default     = "172.20.0.0/16"
}

variable "cluster_log_types" {
  type        = list(string)
  description = "Control plane log types to export: api, audit, authenticator, controllerManager, scheduler"
  default     = []
}

variable "cluster_support_type" {
  type        = string
  description = "STANDARD (free) or EXTENDED (paid after standard EOL)"
  default     = "STANDARD"
}

variable "authentication_mode" {
  type        = string
  description = "CONFIG_MAP | API | API_AND_CONFIG_MAP"
  default     = "API_AND_CONFIG_MAP"
}

variable "bootstrap_admin_permissions" {
  type        = bool
  description = "Grant cluster creator admin permissions via access entry"
  default     = true
}

variable "admin_user_arns" {
  type        = list(string)
  description = "List of IAM user ARNs to grant cluster admin access (for local development)"
  default     = []
}
