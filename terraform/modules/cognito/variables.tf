variable "cognito_domain_prefix" { type = string }
variable "redirect_base_url" { type = string }
variable "callback_path" {
  type    = string
  default = "/api/auth/callback/"
}
variable "aws_region" {
  type    = string
  default = "us-east-1"
}
