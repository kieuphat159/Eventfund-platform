locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Layer       = "services"
  }
}

# ─── Helm Releases (Xóa - Phụ thuộc cluster) ─────────────────────────────────
module "helm" {
  source = "../modules/helm"

  cluster_name            = data.terraform_remote_state.cluster.outputs.cluster_name
  region                  = var.region
  vpc_id                  = data.terraform_remote_state.persistent.outputs.vpc_id
  alb_controller_role_arn = data.terraform_remote_state.cluster.outputs.alb_controller_role_arn
  eso_role_arn            = data.terraform_remote_state.cluster.outputs.eso_role_arn
  autoscaler_role_arn     = data.terraform_remote_state.cluster.outputs.autoscaler_role_arn
  argocd_repo_url         = var.argocd_repo_url
}
