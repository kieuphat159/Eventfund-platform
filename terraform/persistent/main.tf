locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Layer       = "persistent"
  }
}

# ─── VPC (Giữ lại - Không tốn tiền) ──────────────────────────────────────────
module "vpc" {
  source = "../modules/vpc"

  project_name         = var.project_name
  vpc_cidr             = var.vpc_cidr
  public_subnets_cidr  = var.public_subnets_cidr
  private_subnets_cidr = var.private_subnets_cidr
  azs                  = var.azs
}

# ─── ECR (Giữ lại - Lưu Docker images) ───────────────────────────────────────
module "ecr" {
  source = "../modules/ecr"

  repository_names = [var.ecr_backend_repo]
}

# ─── Frontend (Giữ lại - S3 + CloudFront) ────────────────────────────────────
# Create frontend resources for both dev and prod environments
module "frontend_dev" {
  source = "../modules/frontend"

  project_name = var.project_name
  environment  = "dev"
}

module "frontend_prod" {
  source = "../modules/frontend"

  project_name = var.project_name
  environment  = "prod"
}

# ─── GitHub Actions OIDC (Giữ lại - CI/CD) ───────────────────────────────────
module "github_oidc" {
  source = "../modules/oidc"
  tags   = local.common_tags
}

module "github_actions_role" {
  source = "../modules/github_actions_role"

  role_name         = var.github_actions_role_name
  oidc_provider_arn = module.github_oidc.oidc_provider_arn
  github_repos      = var.github_repos
  tags              = local.common_tags
}

# ─── S3 Security Reports (Giữ lại) ───────────────────────────────────────────
module "s3_security_reports" {
  source = "../modules/s3_security_reports"

  bucket_name    = var.security_reports_bucket
  retention_days = var.security_reports_retention_days
  tags           = local.common_tags
}
