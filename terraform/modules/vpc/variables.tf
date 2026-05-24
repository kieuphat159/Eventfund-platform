variable "project_name" { type = string }
variable "vpc_cidr"      { type = string }
variable "public_subnets_cidr"  { type = list(string) }
variable "private_subnets_cidr" { type = list(string) }
variable "azs" { type = list(string) }
