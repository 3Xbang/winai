#!/bin/bash
set -euo pipefail

echo "=== WINAI EC2 Setup ==="

# Create swap (critical for t2.micro with 1GB RAM)
echo ">>> Creating 1GB swap..."
if [ ! -f /swapfile ]; then
  sudo dd if=/dev/zero of=/swapfile bs=128M count=8
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
  echo "Swap created."
else
  echo "Swap already exists."
fi

# Install nginx and certbot
echo ">>> Installing nginx and certbot..."
sudo dnf install -y -q nginx certbot python3-certbot-nginx
sudo systemctl enable nginx

# Create certbot webroot directory
sudo mkdir -p /var/www/certbot

# Copy nginx config
echo ">>> Configuring nginx..."
sudo cp /opt/winai/deploy/nginx-prod.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL auto-renewal cron
echo ">>> Setting up SSL auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

# Create .env if not exists
if [ ! -f /opt/winai/.env ]; then
  echo ">>> Creating .env from example..."
  cp /opt/winai/.env.example /opt/winai/.env
  # Update DATABASE_URL for docker network
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="postgresql://winai:winai_secure_2024@postgres:5432/winai"|' /opt/winai/.env
  sed -i 's|REDIS_URL=.*|REDIS_URL="redis://redis:6379"|' /opt/winai/.env
  sed -i 's|NODE_ENV=.*|NODE_ENV="production"|' /opt/winai/.env
  sed -i 's|APP_URL=.*|APP_URL="https://winaii.com"|' /opt/winai/.env
  sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL="https://winaii.com"|' /opt/winai/.env
  # Generate a random NEXTAUTH_SECRET
  RANDOM_SECRET=$(openssl rand -base64 32)
  sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"${RANDOM_SECRET}\"|" /opt/winai/.env
  # Generate a random ENCRYPTION_KEY
  RANDOM_ENC=$(openssl rand -hex 32)
  sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=\"${RANDOM_ENC}\"|" /opt/winai/.env
  echo ".env created. You'll need to add real API keys later."
fi

# Build and start with docker-compose
echo ">>> Building and starting containers..."
cd /opt/winai
sudo docker-compose -f deploy/docker-compose.prod.yml build --no-cache
sudo docker-compose -f deploy/docker-compose.prod.yml up -d

# Wait for postgres to be ready
echo ">>> Waiting for database..."
sleep 10

# Run prisma migrations
echo ">>> Running database migrations..."
sudo docker exec winai-app npx prisma migrate deploy 2>/dev/null || \
  sudo docker exec winai-app npx prisma db push --accept-data-loss

echo ""
echo "=== WINAI Deployment Complete ==="
echo "App: https://winaii.com"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/winai/.env to add real API keys (LLM, payment, etc.)"
echo "  2. Restart: cd /opt/winai && sudo docker-compose -f deploy/docker-compose.prod.yml restart app"
echo "  3. Run SSL setup: sudo certbot certonly --webroot -w /var/www/certbot -d winaii.com -d www.winaii.com"
echo "  4. Reload nginx: sudo systemctl reload nginx"
