#!/bin/bash

# =========================================================================
# Systego Backend Deployment Script (Plesk Node.js Automation)
#
# This script must be allowed to run without a password via sudoers.
# Ensure the Node.js application user has the following line in `visudo`:
# username ALL=(ALL) NOPASSWD: /path/to/this/script/plesk-node-deploy.sh
# =========================================================================

# Check if script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (or via sudo)"
  exit 1
fi

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <subdomain> <target_vhosts_dir>"
    exit 1
fi

DOMAIN=$1
TARGET_DIR=$2

echo "=========== STARTING NODE.JS PROVISIONING FOR $DOMAIN ==========="

# 1. Enable Node.js
echo "[1/5] Enabling Node.js extension on $DOMAIN..."
/usr/sbin/plesk ext nodejs --enable -domain "$DOMAIN"

# 2. Configure Startup File and Environment
echo "[2/5] Setting startup file and production mode..."
/usr/sbin/plesk ext nodejs --update -domain "$DOMAIN" -startup-file dist/src/server.js -app-mode production

# 3. Disable Nginx proxy mode so Node routes directly
echo "[3/5] Disabling Nginx Proxy Mode..."
/usr/sbin/plesk bin domain -u "$DOMAIN" -nginx-proxy false

# 4. Install NPM Dependencies in the Vhosts directory
echo "[4/5] Installing NPM Production Dependencies in $TARGET_DIR..."
cd "$TARGET_DIR" || exit 1
# Since we are root right now, we use sudo -u to install as the domain user, 
# ensuring we don't accidentally chown their files to root
DOMAIN_USER=$(stat -c '%U' "$TARGET_DIR")
sudo -u "$DOMAIN_USER" npm install --production

# 5. Restart the Application
echo "[5/5] Restarting Node.js App..."
/usr/sbin/plesk ext nodejs --restart -domain "$DOMAIN"

echo "=========== COMPLETELY SUCCESSFUL PROVISIONING ==========="
exit 0
