# ─── GitHub Actions OIDC Provider ───────────────────────────────────────────
# Cho phép GitHub Actions xác thực với AWS mà không cần Access Key
# 1 AWS account chỉ cần 1 OIDC provider duy nhất cho toàn bộ GitHub
# Repo nào được phép → cấu hình trong Trust Policy của IAM Role

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  # AWS yêu cầu khai báo audience
  client_id_list = ["sts.amazonaws.com"]

  # Thumbprint của GitHub OIDC certificate
  # Ref: https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = var.tags
}
