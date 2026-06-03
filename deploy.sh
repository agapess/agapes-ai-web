#!/bin/bash
# ─── Agapes AI Website Builder — Server Deploy Script ───────────────────────
# Run this on your server after cloning the repo.
# Usage: bash deploy.sh

set -e

echo "═══════════════════════════════════════════════════"
echo "  ✦ Agapes AI Website Builder — Deploy"
echo "═══════════════════════════════════════════════════"

# Check if .env exists
if [ ! -f .env ]; then
  echo ""
  echo "⚠ No .env file found. Creating from .env.example..."
  cp .env.example .env
  echo ""
  echo "→ Edit .env with your settings before continuing:"
  echo "  nano .env"
  echo ""
  echo "Required changes:"
  echo "  - NEXTAUTH_URL=https://your-domain.com"
  echo "  - NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>"
  echo "  - ENCRYPTION_SECRET=<generate with: openssl rand -base64 32>"
  echo "  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (for login)"
  echo ""
  echo "Then re-run: bash deploy.sh"
  exit 1
fi

echo ""
echo "→ Pulling latest code..."
git pull origin main 2>/dev/null || true

echo ""
echo "→ Building Docker containers..."
docker compose build --no-cache

echo ""
echo "→ Starting services..."
docker compose up -d

echo ""
echo "→ Waiting for services to start..."
sleep 5

echo ""
echo "→ Checking service health..."
if curl -s http://localhost:4000/api/auth/session > /dev/null 2>&1; then
  echo "  ✓ Web service (port 4000) — running"
else
  echo "  ⚠ Web service (port 4000) — may still be starting..."
fi

if curl -s http://localhost:4001/health > /dev/null 2>&1; then
  echo "  ✓ AI service (port 4001) — running"
else
  echo "  ⚠ AI service (port 4001) — may still be starting..."
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✓ Deploy complete!"
echo ""
echo "  Web App:    http://localhost:4000"
echo "  AI Service: http://localhost:4001"
echo ""
echo "  Next steps:"
echo "  1. Point Nginx Proxy Manager to localhost:4000"
echo "  2. Add SSL certificate via NPM"
echo "  3. Update NEXTAUTH_URL in .env to your domain"
echo "  4. Run: docker compose restart web"
echo "═══════════════════════════════════════════════════"
