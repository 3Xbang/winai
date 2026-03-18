#!/bin/bash
# SSL 证书配置脚本 - winaii.com
# 用法: sudo bash deploy/setup-ssl.sh
# 前提: DNS 已经指向此服务器 IP

set -euo pipefail

DOMAIN="winaii.com"
EMAIL="${1:-admin@winaii.com}"

echo "=== WINAI SSL 配置 ==="

# 1. 安装 certbot
echo ">>> 安装 certbot..."
if command -v dnf &> /dev/null; then
    sudo dnf install -y certbot
elif command -v apt &> /dev/null; then
    sudo apt install -y certbot
fi

# 2. 创建 webroot 目录
sudo mkdir -p /var/www/certbot

# 3. 确保 nginx 在运行（需要 80 端口响应 ACME challenge）
echo ">>> 确保 nginx 运行中..."
sudo systemctl start nginx || true

# 4. 申请证书
echo ">>> 申请 SSL 证书..."
sudo certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive

# 5. 重载 nginx 以启用 HTTPS
echo ">>> 重载 nginx..."
sudo nginx -t && sudo systemctl reload nginx

# 6. 设置自动续期
echo ">>> 配置自动续期..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | sort -u | crontab -

echo ""
echo "=== SSL 配置完成 ==="
echo "https://$DOMAIN 已就绪"
echo "证书将自动续期（每天凌晨3点检查）"
