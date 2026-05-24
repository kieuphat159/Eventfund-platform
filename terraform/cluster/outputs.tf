output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_ca" {
  description = "EKS cluster CA certificate"
  value       = module.eks.cluster_ca
}

output "oidc_provider_arn" {
  description = "EKS OIDC provider ARN for services state"
  value       = module.eks.oidc_provider_arn
}

output "oidc_provider_url" {
  description = "EKS OIDC provider URL for services state"
  value       = module.eks.oidc_provider_url
}

output "alb_controller_role_arn" {
  description = "IAM role ARN for ALB Controller"
  value       = module.iam.alb_controller_role_arn
}

output "eso_role_arn" {
  description = "IAM role ARN for External Secrets Operator"
  value       = module.iam.eso_role_arn
}

output "autoscaler_role_arn" {
  description = "IAM role ARN for Cluster Autoscaler"
  value       = module.iam.autoscaler_role_arn
}

output "configure_kubectl" {
  description = "Command to configure kubectl"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}
