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
resource "helm_release" "prometheus" {
  name             = "prometheus"
  namespace        = "monitoring"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = "58.2.0"
  create_namespace = true
  timeout          = 600
  wait             = true
  cleanup_on_fail  = true

  set {
    name  = "prometheus.prometheusSpec.retention"
    value = "7d"
  }

  # Grafana subpath — cần thiết khi serve từ /grafana qua CloudFront
  set {
    name  = "grafana.grafana\\.ini.server.root_url"
    value = "%(protocol)s://%(domain)s/grafana"
  }
  set {
    name  = "grafana.grafana\\.ini.server.serve_from_sub_path"
    value = "true"
  }

  depends_on = [helm_release.alb_controller]
}

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

# ─── ArgoCD Application ───────────────────────────────────────────────────────
# Dùng null_resource + kubectl thay vì kubernetes_manifest
# Lý do: kubernetes_manifest yêu cầu cluster alive khi destroy
# → fail với "no client config" nếu cluster đã bị xóa trước
resource "null_resource" "argocd_app" {
  triggers = {
    cluster_name    = var.cluster_name
    region          = var.region
    repo_url        = var.argocd_repo_url
    target_revision = var.argocd_target_revision
    app_namespace   = var.argocd_app_namespace
  }

  provisioner "local-exec" {
    on_failure = continue
    command    = <<-EOT
      aws eks update-kubeconfig --region ${var.region} --name ${var.cluster_name}
      kubectl apply -f - <<'MANIFEST'
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: eventfund-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${var.argocd_repo_url}
    targetRevision: ${var.argocd_target_revision}
    path: k8s/base
  destination:
    server: https://kubernetes.default.svc
    namespace: ${var.argocd_app_namespace}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
MANIFEST
    EOT
  }

  provisioner "local-exec" {
    when       = destroy
    on_failure = continue
    command    = <<-EOT
      aws eks update-kubeconfig --region ${self.triggers.region} --name ${self.triggers.cluster_name} 2>/dev/null || exit 0
      kubectl delete application eventfund-dev -n argocd --ignore-not-found=true 2>/dev/null || true
    EOT
  }

  depends_on = [helm_release.argocd, helm_release.eso]
}
