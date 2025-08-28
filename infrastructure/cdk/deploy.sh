#!/bin/bash

# Deploy CDK stack

echo "Deploying QuickSight Portal CDK Stack..."

# Deploy the stack
npx cdk deploy \
  --require-approval never \
  --outputs-file cdk-outputs.json

echo "Deployment complete. Check cdk-outputs.json for stack outputs."