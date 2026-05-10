output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "ecr_backend_url" {
  description = "ECR repository URL for backend"
  value       = module.ecr.repository_urls[var.ecr_backend_repo]
}

output "frontend_s3_bucket" {
  description = "S3 bucket để upload frontend build"
  value       = module.frontend.s3_bucket_name
}

output "frontend_url" {
  description = "CloudFront URL để truy cập frontend"
  value       = module.frontend.cloudfront_url
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID để invalidate cache"
  value       = module.frontend.cloudfront_distribution_id
}

output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "eso_role_arn" {
  description = "IAM role ARN for External Secrets Operator"
  value       = module.iam.eso_role_arn
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions"
  value       = module.github_actions_role.role_arn
}

output "security_reports_bucket" {
  description = "S3 bucket for security scan reports"
  value       = module.s3_security_reports.bucket_name
}
