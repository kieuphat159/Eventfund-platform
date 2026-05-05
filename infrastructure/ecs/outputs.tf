output "oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider"
  value       = module.oidc.oidc_provider_arn
}

output "github_actions_role_arn" {
  description = "ARN of the GitHub Actions IAM role"
  value       = module.github_actions_role.role_arn
}

output "github_actions_role_name" {
  description = "Name of the GitHub Actions IAM role"
  value       = module.github_actions_role.role_name
}

output "security_reports_bucket" {
  description = "S3 bucket name for security reports"
  value       = module.s3_security_reports.bucket_name
}

output "security_reports_bucket_arn" {
  description = "S3 bucket ARN for security reports"
  value       = module.s3_security_reports.bucket_arn
}

# GitHub Secrets cần set trên repo
output "github_secrets_to_set" {
  description = "Secrets cần add vào GitHub repo Settings → Secrets"
  value = {
    AWS_ACCOUNT_ID = var.aws_account_id
  }
}
