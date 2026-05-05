variable "role_name" {
  description = "IAM role name for GitHub Actions"
  type        = string
  default     = "GitHubActionsRole"
}

variable "oidc_provider_arn" {
  description = "ARN of the GitHub OIDC provider"
  type        = string
}

variable "github_repos" {
  description = "List of GitHub repos allowed to assume this role (format: repo:owner/repo:*)"
  type        = list(string)
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
  default     = {}
}
