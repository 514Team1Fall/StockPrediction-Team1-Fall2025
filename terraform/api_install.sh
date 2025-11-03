#!/bin/bash

exec > >(tee /var/log/my_script.log) 2>&1

export DATABASE_URL="mysql://${db_username}:${db_password}@${db_endpoint}/${db_name}"
export PORT=5000
export AUTH_ISSUER_URL=${auth_issuer}
export NODE_ENV=production
export API_URL=${api_url}
export APP_URL=${app_url}
export AUTH_CLIENT_ID=${auth_client_id}
export AUTH_CLIENT_SECRET=${auth_client_secret}
export PORT=5000

yum update -y
yum install -y certbot

certbot certonly \
  --standalone \
  --agree-tos \
  --register-unsafely-without-email \
  --non-interactive \
  -d "${public_dns}"

yum install -y git nginx curl-minimal
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo yum install -y nodejs
mkdir -p /opt/api
git clone -b frontend ${repo_url} /opt/api
cd /opt/api

cp /etc/letsencrypt/live/${public_dns}/fullchain.pem /opt/api/server.cert
cp /etc/letsencrypt/live/${public_dns}/privkey.pem /opt/api/server.key

npm install
npm run build
DATABASE_URL="mysql://${db_username}:${db_password}@${db_endpoint}/${db_name}" npm exec drizzle-kit push
nohup npm start > /opt/api/app.log 2>&1 &

cat > /etc/nginx/conf.d/api.conf <<EOL
server {
    listen 80;
    server_name ${public_dns};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${public_dns};

    ssl_certificate /opt/api/server.cert;
    ssl_certificate_key /opt/api/server.key;

    location / {
	proxy_pass http://localhost:5000;
	proxy_set_header Host \$host;
	proxy_set_header X-Real-IP \$remote_addr;
	proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOL
systemctl enable nginx --now
systemctl restart nginx
