variable "role_name"         { type = string }
variable "oidc_provider_arn" { type = string }
variable "github_repos"      { type = list(string) }
variable "tags" {
  type    = map(string)
  default = {}
}
