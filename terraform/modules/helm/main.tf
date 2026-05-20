# ─── AWS Load Balancer Controller ────────────────────────────────────────────
resource "helm_release" "alb_controller" {
  name             = "aws-load-balancer-controller"
  namespace        = "kube-system"
  repository       = "https://aws.github.io/eks-charts"
  chart            = "aws-load-balancer-controller"
  version          = "1.7.2"
  timeout          = 600
  wait             = true
  cleanup_on_fail  = true

  set {
    name  = "clusterName"
    value = var.cluster_name
  }
  set {
    name  = "serviceAccount.create"
    value = "true"
  }
  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = var.alb_controller_role_arn
  }
  set {
    name  = "region"
    value = var.region
  }
  set {
    name  = "vpcId"
    value = var.vpc_id
  }
}

# ─── External Secrets Operator ───────────────────────────────────────────────
resource "helm_release" "eso" {
  name             = "external-secrets"
  namespace        = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "0.10.5"
  create_namespace = true
  timeout          = 600
  wait             = true
  cleanup_on_fail  = true

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = var.eso_role_arn
  }

  # ALB Controller phải ready trước — webhook của nó validate Service objects
  depends_on = [helm_release.alb_controller]
}

# ─── Metrics Server ───────────────────────────────────────────────────────────
resource "helm_release" "metrics_server" {
  name            = "metrics-server"
  namespace       = "kube-system"
  repository      = "https://kubernetes-sigs.github.io/metrics-server/"
  chart           = "metrics-server"
  version         = "3.12.1"
  timeout         = 300
  wait            = true
  cleanup_on_fail = true

  set {
    name  = "args[0]"
    value = "--kubelet-insecure-tls"
  }
  set {
    name  = "args[1]"
    value = "--kubelet-preferred-address-types=InternalIP"
  }

  depends_on = [helm_release.alb_controller]
}

# ─── Cluster Autoscaler ───────────────────────────────────────────────────────
resource "helm_release" "cluster_autoscaler" {
  name            = "cluster-autoscaler"
  namespace       = "kube-system"
  repository      = "https://kubernetes.github.io/autoscaler"
  chart           = "cluster-autoscaler"
  version         = "9.37.0"
  timeout         = 300
  wait            = true
  cleanup_on_fail = true

  set {
    name  = "autoDiscovery.clusterName"
    value = var.cluster_name
  }
  set {
    name  = "awsRegion"
    value = var.region
  }
  set {
    name  = "rbac.serviceAccount.name"
    value = "cluster-autoscaler"
  }
  set {
    name  = "rbac.serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = var.autoscaler_role_arn
  }
  set {
    name  = "extraArgs.balance-similar-node-groups"
    value = "true"
  }
  set {
    name  = "extraArgs.skip-nodes-with-system-pods"
    value = "false"
  }

  depends_on = [helm_release.alb_controller]
}

# ─── ArgoCD ───────────────────────────────────────────────────────────────────
resource "helm_release" "argocd" {
  name             = "argocd"
  namespace        = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "7.3.4"
  create_namespace = true
  timeout          = 600
  wait             = true
  cleanup_on_fail  = true

  # --insecure: tắt TLS nội bộ, để CloudFront terminate SSL
  set {
    name  = "server.extraArgs[0]"
    value = "--insecure"
  }
  set {
    name  = "server.extraArgs[1]"
    value = "--basehref=/argocd"
  }
  set {
    name  = "server.extraArgs[2]"
    value = "--rootpath=/argocd"
  }

  depends_on = [helm_release.alb_controller, helm_release.eso]
}

# ─── Prometheus + Grafana ─────────────────────────────────────────────────────
# MOVED TO ARGOCD MANAGEMENT via App of Apps pattern
# Prometheus/Grafana được quản lý bởi ArgoCD qua k8s/root/monitoring.yaml
# Không dùng helm_release.prometheus trực tiếp để tránh phình to Terraform state

# ─── Cleanup ALBs trước khi destroy ──────────────────────────────────────────
# Khi terraform destroy:
#   1. Provisioner này chạy TRƯỚC khi alb_controller bị xóa (vì depends_on)
#   2. kubectl xóa Ingress → ALB Controller nhận event → gọi AWS API xóa ALB
#   3. ENIs được release → VPC có thể xóa được
# on_failure = continue: nếu cluster đã xóa rồi thì bỏ qua, không block destroy
resource "null_resource" "cleanup_ingress_on_destroy" {
  triggers = {
    cluster_name = var.cluster_name
    region       = var.region
  }

  provisioner "local-exec" {
    when       = destroy
    on_failure = continue
    command    = <<-EOT
      aws eks update-kubeconfig --region ${self.triggers.region} --name ${self.triggers.cluster_name} 2>/dev/null || exit 0
      kubectl delete ingress --all -A --ignore-not-found=true 2>/dev/null || true
      echo "Waiting 60s for ALB Controller to delete ALBs and Security Groups on AWS..."
      sleep 60
      # Xóa security groups do ALB Controller tạo còn sót
      SG_IDS=$(aws ec2 describe-security-groups \
        --region ${self.triggers.region} \
        --filters "Name=tag-key,Values=elbv2.k8s.aws/cluster" \
        --query "SecurityGroups[*].GroupId" \
        --output text 2>/dev/null || echo "")
      for SG in $SG_IDS; do
        echo "Deleting orphaned SG: $SG"
        aws ec2 delete-security-group --region ${self.triggers.region} --group-id "$SG" 2>/dev/null || true
      done
    EOT
  }

  depends_on = [helm_release.alb_controller]
}

# ─── ArgoCD Root Application (App of Apps Pattern) ───────────────────────────
# Đây là Application GỐC duy nhất được tạo bởi Terraform
# Nó trỏ đến k8s/root/ trên Git, nơi chứa các Child Application YAMLs
# ArgoCD sẽ tự động đọc tất cả YAML files trong k8s/root/ và tạo Applications tương ứng
resource "helm_release" "argocd_root_application" {
  name       = "root-apps"
  namespace  = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argocd-apps"
  version    = "2.0.2"
  timeout    = 300
  wait       = true

  # Root Application config
  set {
    name  = "applications[0].name"
    value = "root-infrastructure"
  }
  set {
    name  = "applications[0].namespace"
    value = "argocd"
  }
  set {
    name  = "applications[0].project"
    value = "default"
  }
  set {
    name  = "applications[0].source.repoURL"
    value = var.argocd_repo_url
  }
  set {
    name  = "applications[0].source.targetRevision"
    value = "master"
  }
  set {
    name  = "applications[0].source.path"
    value = "k8s/root"
  }
  set {
    name  = "applications[0].source.directory.recurse"
    value = "true"
  }
  set {
    name  = "applications[0].destination.server"
    value = "https://kubernetes.default.svc"
  }
  set {
    name  = "applications[0].destination.namespace"
    value = "argocd"
  }
  set {
    name  = "applications[0].syncPolicy.automated.prune"
    value = "true"
  }
  set {
    name  = "applications[0].syncPolicy.automated.selfHeal"
    value = "true"
  }

  depends_on = [helm_release.argocd, helm_release.eso]
}
