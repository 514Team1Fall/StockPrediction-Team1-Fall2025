variable "db_username" {
  description = "Database admin username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "Database admin password"
  type        = string
  sensitive   = true
}

variable "aws_access_key" {
  description = "AWS Access Key"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS Secret Access Key"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "db_name" {
  description = "Name of the WordPress database"
  type        = string
  default     = "stockdb"
}

variable "key_name" {
  description = "SSH key name for EC2"
  type        = string
  sensitive   = true
}

variable "repo_url" {
  description = "Git repository URL for the application code"
  type        = string
}

variable "alphavantage_api_key" {
  description = "Alpha Vantage API key"
  type        = string
  sensitive   = true
}

