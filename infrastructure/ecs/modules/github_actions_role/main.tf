# ─── IAM Role for GitHub Actions ────────────────────────────────────────────
# Role này được GitHub Actions assume thông qua OIDC
# Trust Policy kiểm soát repo nào được phép dùng role này

resource "aws_iam_role" "this" {
  name = var.role_name

  # Trust Policy: Ai được phép assume role này
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = var.oidc_provider_arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          # Chỉ các repo trong list này mới được assume role
          StringLike = {
            "token.actions.githubusercontent.com:sub" = var.github_repos
          }
        }
      }
    ]
  })

  tags = var.tags
}

# ─── Attach Managed Policies ─────────────────────────────────────────────────

# ECR: Build + push Docker images
resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
}

# SSM: Deploy lên EC2 qua SSM Session Manager
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMFullAccess"
}

# EC2: Read-only để check instance status
resource "aws_iam_role_policy_attachment" "ec2_read" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ReadOnlyAccess"
}

# S3: Upload security reports + deploy artifacts
resource "aws_iam_role_policy_attachment" "s3" {
  role       = aws_iam_role.this.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}
