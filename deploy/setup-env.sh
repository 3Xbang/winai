#!/bin/bash
cd /opt/winai
cp .env.example .env
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://winai:winai_secure_2024@postgres:5432/winai|' .env
sed -i 's|REDIS_URL=.*|REDIS_URL=redis://redis:6379|' .env
sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=http://100.51.160.4:8080|' .env
sed -i 's|NODE_ENV=.*|NODE_ENV=production|' .env
sed -i 's|APP_URL=.*|APP_URL=http://100.51.160.4:8080|' .env
NEWSECRET=$(openssl rand -base64 32)
NEWKEY=$(openssl rand -hex 32)
sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEWSECRET}|" .env
sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${NEWKEY}|" .env
echo "=== .env configured ==="
grep -E "^(DATABASE_URL|REDIS_URL|NEXTAUTH_URL|NODE_ENV|APP_URL)" .env
