variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
  default     = "612827970242"
}

variable "iam_role_name" {
  description = "IAM role name for GitHub Actions"
  type        = string
  default     = "GitHubActionsRole"
}

variable "github_repos" {
  description = "List of GitHub repos allowed to assume the IAM role"
  type        = list(string)
  default = [
    "repo:kieuphat159/Eventfund-platform:*",
    "repo:truongtrongdat94/Eventfund-platform:*"
  ]
}

variable "security_reports_bucket" {
  description = "S3 bucket name for security scan reports"
  type        = string
  default     = "eventfund-security-reports"
}

variable "retention_days" {
  description = "Number of days before objects are deleted"
  type        = number
  default     = 15
}

variable "tags" {
  description = "Tags applied to all resources"
  type        = map(string)
  default = {
    Project   = "eventfund-platform"
    ManagedBy = "terraform"
  }
}
