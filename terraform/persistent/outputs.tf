output "vpc_id" {
  description = "VPC ID for cluster state"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for cluster state"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs for cluster state"
  value       = module.vpc.private_subnet_ids
}

output "ecr_backend_url" {
  description = "ECR repository URL for backend"
  value       = module.ecr.repository_urls[var.ecr_backend_repo]
}

# ─── Frontend Dev ────────────────────────────────────────────────────────────
output "frontend_dev_s3_bucket" {
  description = "S3 bucket để upload frontend build (dev)"
  value       = module.frontend_dev.s3_bucket_name
}

output "frontend_dev_url" {
  description = "CloudFront URL để truy cập frontend (dev)"
  value       = module.frontend_dev.cloudfront_url
}

output "cloudfront_dev_distribution_id" {
  description = "CloudFront distribution ID để invalidate cache (dev)"
  value       = module.frontend_dev.cloudfront_distribution_id
}

# ─── Frontend Prod ───────────────────────────────────────────────────────────
output "frontend_prod_s3_bucket" {
  description = "S3 bucket để upload frontend build (prod)"
  value       = module.frontend_prod.s3_bucket_name
}

output "frontend_prod_url" {
  description = "CloudFront URL để truy cập frontend (prod)"
  value       = module.frontend_prod.cloudfront_url
}

output "cloudfront_prod_distribution_id" {
  description = "CloudFront distribution ID để invalidate cache (prod)"
  value       = module.frontend_prod.cloudfront_distribution_id
}

# ─── Backward compatibility (deprecated) ─────────────────────────────────────
output "frontend_s3_bucket" {
  description = "[DEPRECATED] Use frontend_dev_s3_bucket instead"
  value       = module.frontend_dev.s3_bucket_name
}

output "frontend_url" {
  description = "[DEPRECATED] Use frontend_dev_url instead"
  value       = module.frontend_dev.cloudfront_url
}

output "cloudfront_distribution_id" {
  description = "[DEPRECATED] Use cloudfront_dev_distribution_id instead"
  value       = module.frontend_dev.cloudfront_distribution_id
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions"
  value       = module.github_actions_role.role_arn
}

output "security_reports_bucket" {
  description = "S3 bucket for security scan reports"
  value       = module.s3_security_reports.bucket_name
}
