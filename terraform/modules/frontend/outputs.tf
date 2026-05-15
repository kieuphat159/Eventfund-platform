output "s3_bucket_name" {
  description = "S3 bucket name để CI/CD upload build artifacts"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_url" {
  description = "CloudFront URL để truy cập frontend"
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID để invalidate cache sau deploy"
  value       = aws_cloudfront_distribution.frontend.id
}
