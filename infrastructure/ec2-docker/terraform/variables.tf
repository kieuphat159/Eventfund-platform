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
  default     = "t3.micro"
}

variable "ngrok_authtoken" {
  description = "ngrok authtoken"
  type        = string
  sensitive   = true
}

variable "ngrok_domain" {
  description = "ngrok static domain (e.g. xxxx.ngrok-free.app)"
  type        = string
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

variable "key_pair_name" {
  description = "EC2 Key Pair name (optional)"
  type        = string
  default     = ""
}
