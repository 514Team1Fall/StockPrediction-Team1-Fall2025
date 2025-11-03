# --- Outputs ---
output "website_url" {
  value = aws_s3_bucket_website_configuration.frontend_website.website_endpoint
}

output "bucket_name" {
  value = aws_s3_bucket.frontend.bucket
}
