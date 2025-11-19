# Provider Configuration
# Specifies the AWS provider and region for Terraform to manage resources in.
terraform {
  backend "s3" {
    bucket  = "rit-514-team1-2025" # CHANGE UPON YOUR DEPLOYMENT
    key     = "deployment/terraform.tfstate"
    encrypt = true
    region  = "us-east-1"
  }
}

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

// cloudfront with aws_eip on /api and s3 on /
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_eip.ec2_eip.public_dns
    origin_id   = "ec2-origin"

    custom_origin_config {
      http_port              = 5000
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  origin {
    domain_name = module.s3.website_url
    origin_id   = "s3-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "ec2-origin"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    forwarded_values {
      query_string = true
      headers      = ["Host", "Origin", "Authorization", "Content-Type", "X-Forwarded-Proto", "X-Forwarded-Host"]
      cookies {
        forward = "all"
      }
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN for Stock Predictor App"
  default_root_object = "index.html"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_sns_topic" "stock_alerts" {
  name = "stock-alerts-topic"
}

module "s3" {
  source      = "./modules/s3"
  bucket_name = "swen-514-stock-predictor-app-${random_id.suffix.hex}"
  build_dir   = "${path.root}/../frontend"
}

resource "random_id" "suffix" {
  byte_length = 4
}

module "cognito" {
  source                = "./modules/cognito"
  cognito_domain_prefix = "swen-514-stock-predictor-app-${random_id.suffix.hex}"
  redirect_base_url     = "https://${aws_cloudfront_distribution.cdn.domain_name}"
}


# EC2
module "ec2" {
  source                = "./modules/ec2"
  db_endpoint           = module.rds.db_endpoint
  public_subnet_id      = module.vpc.public_subnet_id
  db_username           = var.db_username
  db_password           = var.db_password
  db_name               = var.db_name
  key_name              = var.key_name
  ec2_sg_id             = module.security.ec2_sg_id
  app_url               = "https://${aws_cloudfront_distribution.cdn.domain_name}"
  auth_issuer           = module.cognito.issuer
  auth_client_id        = module.cognito.client_id
  auth_client_secret    = module.cognito.client_secret
  repo_url              = var.repo_url
  aws_access_key        = var.aws_access_key
  aws_secret_access_key = var.aws_secret_access_key
  aws_region            = var.aws_region
  sns_topic_arn         = aws_sns_topic.stock_alerts.arn
}

module "lambda_news" {
  source               = "./modules/lambda_news"
  function_name        = "news-ingestor"
  api_base_url         = "https://${aws_cloudfront_distribution.cdn.domain_name}/api"
  alphavantage_api_key = var.alphavantage_api_key
  source_dir           = "${path.root}/../lambda/news_ingestor"
  schedule_expression  = "rate(5 minutes)"
}

resource "aws_eip_association" "ec2_eip_assoc" {
  instance_id   = module.ec2.instance_id
  allocation_id = aws_eip.ec2_eip.id
}


# Outputs
# Outputs the public IP of the EC2 instance and the RDS endpoint.

output "app_url" {
  value = "https://${aws_cloudfront_distribution.cdn.domain_name}"
}


