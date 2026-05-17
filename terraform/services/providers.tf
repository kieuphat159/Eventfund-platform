terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.25"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket = "eventfund-tfstate"
    key    = "services/terraform.tfstate"
    region = "ap-southeast-1"
  }
}

provider "aws" {
  region = var.region
}

# ─── Data Sources: Lấy outputs từ persistent và cluster states ───────────────
# (Khai báo ở đây để providers có thể dùng)
data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "eventfund-tfstate"
    key    = "persistent/terraform.tfstate"
    region = var.region
  }
}

data "terraform_remote_state" "cluster" {
  backend = "s3"
  config = {
    bucket = "eventfund-tfstate"
    key    = "cluster/terraform.tfstate"
    region = var.region
  }
}

# ─── Kubernetes Provider: Kết nối đến EKS cluster ────────────────────────────
provider "kubernetes" {
  host                   = data.terraform_remote_state.cluster.outputs.cluster_endpoint
  cluster_ca_certificate = base64decode(data.terraform_remote_state.cluster.outputs.cluster_ca)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", data.terraform_remote_state.cluster.outputs.cluster_name, "--region", var.region]
  }
  skip_credentials_validation = true
  skip_metadata_api_check     = true
}

# ─── Helm Provider: Deploy Helm charts ───────────────────────────────────────
provider "helm" {
  kubernetes {
    host                   = data.terraform_remote_state.cluster.outputs.cluster_endpoint
    cluster_ca_certificate = base64decode(data.terraform_remote_state.cluster.outputs.cluster_ca)
    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", data.terraform_remote_state.cluster.outputs.cluster_name, "--region", var.region]
    }
  }
}
