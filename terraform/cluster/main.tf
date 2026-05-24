locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Layer       = "cluster"
  }
}

# ─── Data Sources: Lấy outputs từ persistent state ───────────────────────────
data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "eventfund-tfstate"
    key    = "persistent/terraform.tfstate"
    region = var.region
  }
}

# ─── EKS Cluster (Xóa - Tốn tiền) ────────────────────────────────────────────
module "eks" {
  source = "../modules/eks"

  cluster_name          = var.project_name
  vpc_id                = data.terraform_remote_state.persistent.outputs.vpc_id
  private_subnet_ids    = data.terraform_remote_state.persistent.outputs.private_subnet_ids
  eks_version           = var.eks_version
  node_instance_types   = var.node_group_instance_types
  node_desired_capacity = var.node_desired_capacity
  node_min_capacity     = var.node_min_capacity
  node_max_capacity     = var.node_max_capacity
  node_capacity_type    = var.node_capacity_type
  node_ami_type         = var.node_ami_type
  node_disk_size        = var.node_disk_size
  node_max_unavailable  = var.node_max_unavailable
  node_repair_enabled   = var.node_repair_enabled

  cluster_endpoint_private_access = var.cluster_endpoint_private_access
  cluster_endpoint_public_access  = var.cluster_endpoint_public_access
  cluster_public_access_cidrs     = var.cluster_public_access_cidrs
  service_ipv4_cidr               = var.service_ipv4_cidr
  cluster_log_types               = var.cluster_log_types
  authentication_mode             = var.authentication_mode
  bootstrap_admin_permissions     = var.bootstrap_admin_permissions
  admin_user_arns                 = var.admin_user_arns
}

# ─── Chờ EKS API server sẵn sàng ─────────────────────────────────────────────
resource "time_sleep" "wait_for_eks" {
  depends_on      = [module.eks]
  create_duration = "120s"
}

# ─── IAM IRSA Roles (Xóa - Phụ thuộc cluster) ────────────────────────────────
module "iam" {
  source = "../modules/iam"

  project_name      = var.project_name
  region            = var.region
  oidc_provider_arn = module.eks.oidc_provider_arn
  oidc_provider_url = module.eks.oidc_provider_url
  ssm_prefix        = var.ssm_prefix

  depends_on = [time_sleep.wait_for_eks]
}
