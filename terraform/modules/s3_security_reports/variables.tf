variable "bucket_name"     { type = string }
variable "retention_days"  { type = number }
variable "tags" {
  type    = map(string)
  default = {}
}
