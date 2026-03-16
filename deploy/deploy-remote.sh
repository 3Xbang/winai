#!/bin/bash
# 一键远程部署脚本
# 用法: bash deploy/deploy-remote.sh
# 前提: winai.pem 在项目根目录

set -euo pipefail

SERVER="ec2-user@100.51.160.4"
KEY="winai.pem"
REMOTE_DIR="/opt/winai"

echo "=== WINAI 远程部署 ==="

# 1. 拉取最新代码
echo ">>> 拉取最新代码..."
ssh -i $KEY -o StrictHostKeyChecking=no $SERVER "cd $REMOTE_DIR && sudo git pull origin main"

# 2. 确保 .env 有 GLM_API_KEY
echo ">>> 检查 GLM_API_KEY..."
ssh -i $KEY $SERVER "grep -q 'GLM_API_KEY' $REMOTE_DIR/.env || echo 'GLM_API_KEY=\"[your-glm-api-key]\"' | sudo tee -a $REMOTE_DIR/.env"
ssh -i $KEY $SERVER "grep -q 'GLM_MODEL' $REMOTE_DIR/.env || echo 'GLM_MODEL=\"glm-4-flash-250414\"' | sudo tee -a $REMOTE_DIR/.env"

# 3. 重新构建并启动
echo ">>> 构建并重启容器..."
ssh -i $KEY $SERVER "cd $REMOTE_DIR && sudo docker compose -f deploy/docker-compose.prod.yml up -d --build"

# 4. 等待启动
echo ">>> 等待服务启动..."
sleep 15

# 5. 检查状态
echo ">>> 检查容器状态..."
ssh -i $KEY $SERVER "sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'"

echo ""
echo "=== 部署完成 ==="
echo "访问: http://100.51.160.4:3001"
