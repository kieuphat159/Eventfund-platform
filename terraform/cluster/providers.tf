terraform {
  required_version = ">= 1.3"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
  }

  backend "s3" {
    bucket = "eventfund-tfstate"
    key    = "cluster/terraform.tfstate"
    region = "ap-southeast-1"
  }
}

provider "aws" {
  region = var.region
}
