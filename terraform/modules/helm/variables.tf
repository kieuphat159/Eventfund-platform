variable "cluster_name"            { type = string }
variable "region"                  { type = string }
variable "vpc_id"                  { type = string }
variable "alb_controller_role_arn" { type = string }
variable "eso_role_arn"            { type = string }
variable "autoscaler_role_arn"     { type = string }
variable "argocd_repo_url"         { type = string }
