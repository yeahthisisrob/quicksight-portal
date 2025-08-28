#!/bin/bash

echo "Killing any existing SAM local processes..."

# Kill SAM local processes
pkill -f "sam local" || true

# Kill any Python processes running SAM
pkill -f "python.*sam" || true

# Kill any Node processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Stop and remove any SAM Docker containers
docker ps -a | grep -E "amazon/aws-sam|lambda/nodejs" | awk '{print $1}' | xargs -r docker stop 2>/dev/null || true
docker ps -a | grep -E "amazon/aws-sam|lambda/nodejs" | awk '{print $1}' | xargs -r docker rm 2>/dev/null || true

# Clear SAM cache to ensure fresh environment variables
rm -rf ~/.aws-sam/cache 2>/dev/null || true

echo "SAM cleanup complete!"