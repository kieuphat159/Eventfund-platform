# ─── S3 Bucket: Security Scan Reports ───────────────────────────────────────
# Lưu trữ output của các security scans (OWASP, SonarQube, Trivy)
# Cấu trúc: s3://bucket/{tool}/YYYY/MM/DD/{scan-id}/

resource "aws_s3_bucket" "this" {
  bucket        = var.bucket_name
  force_destroy = true
  tags          = var.tags
}

# Block tất cả public access
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning: Có thể restore nếu xóa nhầm
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle: Tự động xóa reports cũ để tiết kiệm chi phí
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "delete-old-reports"
    status = "Enabled"

    filter {}

    # Xóa object sau 15 ngày không có access
    expiration {
      days = var.retention_days
    }

    # Xóa các version cũ sau 15 ngày
    noncurrent_version_expiration {
      noncurrent_days = var.retention_days
    }
  }
}

# Encryption: Mã hóa dữ liệu at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
