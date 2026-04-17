variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "eventfund"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro" # Free tier eligible cho account tạo sau 15/7/2025
}

variable "cloudflare_tunnel_token" {
  description = "Cloudflare Tunnel token (lấy từ Cloudflare Zero Trust dashboard)"
  type        = string
  sensitive   = true
}

variable "repo_url" {
  description = "Git repo URL để clone lên EC2"
  type        = string
}

variable "repo_branch" {
  description = "Branch để deploy"
  type        = string
  default     = "main"
}
