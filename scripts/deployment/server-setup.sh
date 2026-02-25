#!/bin/bash
# ============================================
# GARMENT ERP - Server Setup Script
# ============================================
# Run this script on a fresh Ubuntu 22.04 LTS server
# Usage: curl -sSL https://raw.githubusercontent.com/YOUR_REPO/main/scripts/deployment/server-setup.sh | bash
# ============================================

set -e

echo "============================================"
echo "  GARMENT ERP - Server Setup"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (use sudo)${NC}"
  exit 1
fi

echo -e "${GREEN}Step 1: Updating system packages...${NC}"
apt-get update && apt-get upgrade -y

echo -e "${GREEN}Step 2: Installing essential packages...${NC}"
apt-get install -y \
  curl \
  wget \
  git \
  ufw \
  fail2ban \
  htop \
  ncdu \
  unzip \
  ca-certificates \
  gnupg \
  lsb-release

echo -e "${GREEN}Step 3: Installing Docker...${NC}"
# Add Docker's official GPG key
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

# Add the repository to Apt sources
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

echo -e "${GREEN}Step 4: Configuring firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable

echo -e "${GREEN}Step 5: Configuring fail2ban...${NC}"
systemctl start fail2ban
systemctl enable fail2ban

echo -e "${GREEN}Step 6: Creating swap space (2GB)...${NC}"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab
fi

echo -e "${GREEN}Step 7: Creating deployment directory...${NC}"
mkdir -p /opt/garment-erp
cd /opt/garment-erp

echo -e "${GREEN}Step 8: Creating deploy user...${NC}"
if ! id "deploy" &>/dev/null; then
  useradd -m -s /bin/bash deploy
  usermod -aG docker deploy
  echo -e "${YELLOW}Created 'deploy' user. Set password with: passwd deploy${NC}"
fi

echo -e "${GREEN}Step 9: Installing Ollama (for local AI)...${NC}"
curl -fsSL https://ollama.ai/install.sh | sh

# Pull embedding model
ollama pull nomic-embed-text

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Server Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Clone your repository:"
echo "   cd /opt/garment-erp"
echo "   git clone https://github.com/YOUR_USERNAME/garment-erp.git ."
echo ""
echo "2. Copy and configure environment:"
echo "   cp .env.production.example .env"
echo "   nano .env"
echo ""
echo "3. Run SSL setup:"
echo "   ./scripts/deployment/ssl-setup.sh your-domain.com"
echo ""
echo "4. Start the application:"
echo "   docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo "5. Run database migrations:"
echo "   docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy"
echo ""
echo -e "${YELLOW}Don't forget to:${NC}"
echo "- Set a password for 'deploy' user: passwd deploy"
echo "- Copy your SSH key: ssh-copy-id deploy@server-ip"
echo "- Add GitHub secrets for CI/CD"
echo ""
