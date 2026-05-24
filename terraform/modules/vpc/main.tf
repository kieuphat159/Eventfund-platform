data "aws_availability_zones" "available" {}

# ─── VPC ─────────────────────────────────────────────────────────────────────
resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# ─── Internet Gateway ────────────────────────────────────────────────────────
resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.project_name}-igw" }
}

# ─── Public Subnets (ALB) ────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count  = length(var.public_subnets_cidr)
  vpc_id = aws_vpc.this.id

  cidr_block              = var.public_subnets_cidr[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name                                        = "${var.project_name}-public-${count.index + 1}"
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${var.project_name}" = "shared"
  }
}

# ─── Private Subnets (EKS nodes) ─────────────────────────────────────────────
resource "aws_subnet" "private" {
  count  = length(var.private_subnets_cidr)
  vpc_id = aws_vpc.this.id

  cidr_block              = var.private_subnets_cidr[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name                                        = "${var.project_name}-private-${count.index + 1}"
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${var.project_name}" = "shared"
  }
}

# ─── NAT Gateway (1 cái, đủ cho đồ án) ──────────────────────────────────────
resource "aws_eip" "nat" {
  domain     = "vpc"
  depends_on = [aws_internet_gateway.this]
  tags       = { Name = "${var.project_name}-nat-eip" }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.this]
  tags          = { Name = "${var.project_name}-nat" }
}

# ─── Route Tables ────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.project_name}-public-rt" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnets_cidr)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count  = length(var.private_subnets_cidr)
  vpc_id = aws_vpc.this.id
  tags   = { Name = "${var.project_name}-private-rt-${count.index + 1}" }
}

resource "aws_route" "private_nat" {
  count                  = length(var.private_subnets_cidr)
  route_table_id         = aws_route_table.private[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this.id
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnets_cidr)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
