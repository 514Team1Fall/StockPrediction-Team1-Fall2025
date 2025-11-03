# Provider Configuration
# Specifies the AWS provider and region for Terraform to manage resources in.
provider "aws" {
  region = "us-east-1"
}


module "vpc" {
  source = "./modules/vpc"
}


# Security
module "security" {
  source = "./modules/security"
  vpc_id = module.vpc.vpc_id
}

# Database Subnet Group
module "subnet_group" {
  source            = "./modules/subnet_group"
  public_subnet_id  = module.vpc.public_subnet_id
  private_subnet_id = module.vpc.private_subnet_id
}

# RDS
module "rds" {
  source               = "./modules/rds"
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  rds_sg_id            = module.security.rds_sg_id
  db_subnet_group_name = module.subnet_group.subnet_group_name
}


resource "aws_eip" "ec2_eip" {
  domain = "vpc"
}

module "s3" {
  source      = "./modules/s3"
  api_url     = "https://${aws_eip.ec2_eip.public_dns}"
  bucket_name = "swen-514-stock-predictor-app-${random_id.suffix.hex}"
  build_dir   = "${path.root}/../frontend"
}

resource "random_id" "suffix" {
  byte_length = 4
}

module "cognito" {
  source                = "./modules/cognito"
  cognito_domain_prefix = "swen-514-stock-predictor-app-${random_id.suffix.hex}"
  redirect_base_url     = "https://${aws_eip.ec2_eip.public_dns}"
}


# EC2
module "ec2" {
  source             = "./modules/ec2"
  db_endpoint        = module.rds.db_endpoint
  public_subnet_id   = module.vpc.public_subnet_id
  db_username        = var.db_username
  db_password        = var.db_password
  db_name            = var.db_name
  key_name           = var.key_name
  ec2_sg_id          = module.security.ec2_sg_id
  api_url            = "https://${aws_eip.ec2_eip.public_dns}"
  app_url            = "http://${module.s3.website_url}"
  auth_issuer        = module.cognito.issuer
  auth_client_id     = module.cognito.client_id
  auth_client_secret = module.cognito.client_secret
  repo_url           = var.repo_url
  public_dns         = aws_eip.ec2_eip.public_dns
}

resource "aws_eip_association" "ec2_eip_assoc" {
  instance_id   = module.ec2.instance_id
  allocation_id = aws_eip.ec2_eip.id
}


# Outputs
# Outputs the public IP of the EC2 instance and the RDS endpoint.
output "api_url" {
  value = "http://${aws_eip.ec2_eip.public_dns}"
}

output "app_url" {
  value = "http://${module.s3.website_url}"
}


