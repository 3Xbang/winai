#!/bin/bash
cd /opt/winai
NEWSECRET=$(openssl rand -base64 32)
NEWKEY=$(openssl rand -hex 32)
sed -i "s|NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=${NEWSECRET}|" .env
sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=${NEWKEY}|" .env
echo "Secrets updated"
grep NEXTAUTH_SECRET .env
grep ENCRYPTION_KEY .env
