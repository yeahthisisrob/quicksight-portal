#!/bin/bash
set -e

echo "Building Lambda handlers..."

# Clean previous build
rm -rf dist

# Install dependencies
npm install

# Build TypeScript
npm run build

echo "Lambda build complete!"