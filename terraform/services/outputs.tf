output "helm_releases" {
  description = "Deployed Helm releases"
  value = {
    alb_controller     = "aws-load-balancer-controller"
    external_secrets   = "external-secrets"
    metrics_server     = "metrics-server"
    cluster_autoscaler = "cluster-autoscaler"
    argocd             = "argocd"
    prometheus         = "prometheus"
  }
}
