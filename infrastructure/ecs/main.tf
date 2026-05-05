# ─── GitHub Actions OIDC Provider ───────────────────────────────────────────
module "oidc" {
  source = "./modules/oidc"

  tags = var.tags
}

# ─── IAM Role for GitHub Actions ────────────────────────────────────────────
module "github_actions_role" {
  source = "./modules/github_actions_role"

  role_name         = var.iam_role_name
  oidc_provider_arn = module.oidc.oidc_provider_arn
  github_repos      = var.github_repos
  tags              = var.tags
}

# ─── S3 Bucket: Security Scan Reports ───────────────────────────────────────
module "s3_security_reports" {
  source = "./modules/s3_security_reports"

  bucket_name    = var.security_reports_bucket
  retention_days = var.retention_days
  tags           = var.tags
}
