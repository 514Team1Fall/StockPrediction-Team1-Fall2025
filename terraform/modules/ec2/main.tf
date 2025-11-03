# AMI Data Source
data "aws_ami" "amazon_linux_2023" {
  most_recent = true       # Get the latest version of the AMI
  owners      = ["amazon"] # Only accept Amazon-owned AMIs

  filter {
    name   = "name"
    values = ["al2023-ami-2023*"] # Filter for Amazon Linux 2023 AMIs
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"] # Hardware Virtual Machine AMIs only
  }
  filter {
    name   = "root-device-type"
    values = ["ebs"] # EBS-backed instances only
  }
  filter {
    name   = "architecture"
    values = ["x86_64"] # 64-bit x86 architecture only
  }
}

# WordPress EC2 Instance
resource "aws_instance" "stock_ec2" {
  ami                    = data.aws_ami.amazon_linux_2023.id # Use the AMI we filtered above
  instance_type          = "t2.micro"                        # Free tier eligible instance type
  subnet_id              = var.public_subnet_id              # Place in the public subnet
  vpc_security_group_ids = [var.ec2_sg_id]                   # Attach the EC2 security group
  key_name               = var.key_name                      # SSH key name from variable

  user_data = templatefile("api_install.sh", {
    db_username        = var.db_username
    db_password        = var.db_password
    db_name            = var.db_name
    db_endpoint        = var.db_endpoint
    app_url            = var.app_url
    auth_issuer        = var.auth_issuer
    auth_client_id     = var.auth_client_id
    auth_client_secret = var.auth_client_secret
    repo_url           = var.repo_url
  })

  tags = {
    Name = "WordPress EC2 Instance"
  }
}


