variable "bucket_name" {
  description = "S3 bucket name for security scan reports"
  type        = string
}

variable "retention_days" {
  description = "Number of days before objects are deleted"
  type        = number
  default     = 15
}

variable "tags" {
  description = "Tags for resources"
  type        = map(string)
  default     = {}
}
