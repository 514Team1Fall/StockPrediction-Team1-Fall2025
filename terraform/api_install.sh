#!/bin/bash

exec > >(tee /var/log/my_script.log) 2>&1

export DATABASE_URL="mysql://${db_username}:${db_password}@${db_endpoint}/${db_name}"
export AUTH_ISSUER_URL=${auth_issuer}
export NODE_ENV=production
export APP_URL=${app_url}
export AUTH_CLIENT_ID=${auth_client_id}
export AUTH_CLIENT_SECRET=${auth_client_secret}
export PORT=5000
export AWS_ACCESS_KEY_ID=${aws_access_key}
export AWS_SECRET_ACCESS_KEY=${aws_secret_access_key}
export AWS_REGION=${aws_region}
export SNS_TOPIC_ARN=${sns_topic_arn}

yum update -y

yum install -y git curl-minimal
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs
mkdir -p /opt/api
git clone ${repo_url} /opt/api
cd /opt/api/api
npm install
npm run build
DATABASE_URL="mysql://${db_username}:${db_password}@${db_endpoint}/${db_name}" npm exec drizzle-kit push
nohup npm start > /opt/api/app.log 2>&1 &
