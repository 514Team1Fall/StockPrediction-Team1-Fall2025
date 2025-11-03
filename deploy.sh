#!/bin/bash

CURRENT_DIR=$(pwd)
cd ./api
npm ci

cd "$CURRENT_DIR"/frontend
npm ci
npm run build

# Terraform
cd "$CURRENT_DIR"/terraform
terraform init
terraform apply -auto-approve
