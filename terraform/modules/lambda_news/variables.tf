variable "function_name" {
  type        = string
  description = "Lambda function name"
}

variable "api_base_url" {
  type        = string
  description = "Base URL for existing API (e.g., https://xxx.cloudfront.net/api)"
}

variable "alphavantage_api_key" {
  type        = string
  description = "Alpha Vantage API key"
  sensitive   = true
}

variable "source_dir" {
  type        = string
  description = "Path to Lambda source directory"
}

variable "schedule_expression" {
  type        = string
  description = "EventBridge schedule expression"
  default     = "rate(1 hour)"
}


