# QuickSight Assets Portal

A comprehensive web application for managing, exploring, and deploying AWS QuickSight assets including dashboards, analyses, datasets, and data sources.

## Features

- **Asset Management**: Browse, search, and organize QuickSight dashboards, analyses, datasets, and data sources
- **Folder Organization**: Create and manage folder hierarchies for better asset organization
- **User & Group Management**: Manage QuickSight users, groups, and permissions
- **Asset Export/Import**: Export QuickSight assets to JSON and restore them across environments
- **Data Lineage**: Visualize relationships between datasets, data sources, and dashboards
- **Field-Level Metadata**: Explore dataset schemas with field descriptions and usage tracking
- **Tagging System**: Organize assets with tags for better categorization
- **Audit History**: Track asset changes and user activities via CloudTrail integration
- **Refresh Schedules**: Manage and monitor dataset refresh schedules

## Architecture

The application consists of:
- **Frontend**: React/TypeScript SPA with Material-UI
- **Backend**: Node.js Lambda functions with TypeScript
- **Infrastructure**: AWS CDK for deployment
- **Storage**: S3 for metadata and export storage
- **Authentication**: AWS Cognito for user management
- **Queue**: SQS for async export job processing

## Prerequisites

- Node.js 18+ and npm
- AWS Account with QuickSight enabled
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Docker Desktop (for local development with SAM Local)
- Just command runner (optional, for simplified development workflows)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yeahthisisrob/quicksight-portal.git
   cd quicksight-portal
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Configure AWS account**
   ```bash
   # Set environment variables for CDK
   export CDK_DEFAULT_ACCOUNT=your-aws-account-id
   export CDK_DEFAULT_REGION=us-east-1
   
   # Or use AWS CLI profiles
   export AWS_PROFILE=your-profile-name
   ```

4. **Deploy everything**
   ```bash
   # First, build the project (required for bootstrap)
   npm run build:prod
   
   # Bootstrap CDK (first time only)
   npm run cdk:bootstrap
   
   # Deploy the stack (this also builds if needed)
   npm run deploy:prod
   
   # This will:
   # - Configure Cognito automatically
   # - Deploy frontend with correct config
   # - Output the site URL
   ```

5. **Access your portal**
   ```bash
   # CDK output will show:
   # SiteURL: https://[cloudfront-id].cloudfront.net
   # 
   # The portal is ready to use at this URL!
   ```

6. **Create your first user**
   
   **Option A: Using AWS Console (easier)**
   - Go to AWS Cognito Console
   - Find your User Pool (from CDK output)
   - Create a new user with your email
   - Add user to `QuickSightUsers` group
   
   **Option B: Using AWS CLI**
   ```bash
   # Create a user in Cognito (replace with your email)
   aws cognito-idp admin-create-user \
     --user-pool-id <UserPoolId from CDK output> \
     --username your-email@example.com \
     --user-attributes Name=email,Value=your-email@example.com \
     --message-action SUPPRESS
   
   # Add user to QuickSightUsers group
   aws cognito-idp admin-add-user-to-group \
     --user-pool-id <UserPoolId from CDK output> \
     --username your-email@example.com \
     --group-name QuickSightUsers
   ```

7. **Local development setup**
   ```bash
   # For local development, create a local config
   cp frontend/public/config.js.example frontend/public/config.js
   
   # Edit with values from CDK output for local development
   # The deployed version already has correct config
   
   # For backend development with SAM Local
   cp sam/template.yaml.example sam/template.yaml
   cp sam/env.example.json sam/env.json
   # Edit both files with your AWS account details and CDK output values
   ```

## Development

### Prerequisites for Local Development

- **Docker Desktop** - Required for SAM Local API emulation
- **Just** - Command runner for simplified workflows

#### Installing Just

```bash
# macOS
brew install just

# Linux
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Or via npm
npm install -g just-install && just-install
```

### Local Development with Just

The project includes a `justfile` with optimized development workflows:

```bash
# Run full development environment with all checks
just dev

# Quick development mode (skip checks, faster startup)
just dev-quick

# Run all checks (lint, typecheck, tests)
just check

# Check backend only
just check-backend

# Check frontend only  
just check-frontend

# Start individual services
just backend   # Start backend API
just frontend  # Start frontend dev server
just sam      # Start SAM Local API
```

### Manual Development Commands

If you prefer not to use Just:

```bash
# Start backend with SAM Local
npm run dev:api-only

# Start frontend dev server
cd frontend && npm run dev

# Run all checks
npm run lint && npm run test

# Run tests
npm test              # Backend tests
npm run test:frontend # Frontend tests
```

### Building for Production

```bash
# Using npm scripts (recommended)
npm run build:prod

# Or manually
cd backend/lambda && npm run build
cd frontend && npm run build
```

## Configuration

### Environment Variables

Key environment variables in `env.json`:
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `AWS_REGION`: AWS region for deployment
- `BUCKET_NAME`: S3 bucket for metadata storage
- `COGNITO_USER_POOL_ID`: Cognito user pool ID (after deployment)
- `API_URL`: API Gateway endpoint (after deployment)

### QuickSight Permissions

The Lambda execution role requires the following QuickSight permissions:
- List, Describe, Get operations for all asset types
- Tag management permissions
- Create/Update/Delete for assets (if restore functionality is needed)
- User and group management permissions

## Project Structure

```
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── entities/      # Domain-specific components
│   │   ├── features/      # Feature modules
│   │   ├── pages/         # Page components
│   │   ├── shared/        # Shared utilities and components
│   │   └── widgets/       # Layout components
│   └── public/
├── backend/
│   └── lambda/            # Lambda function code
│       ├── features/      # Feature handlers
│       ├── shared/        # Shared services
│       └── services/      # Core services
├── infrastructure/
│   └── cdk/              # AWS CDK infrastructure code
├── scripts/              # Utility scripts
└── docs/                 # Documentation
```

## API Documentation

The API is documented using OpenAPI specification. See `shared/schemas/api.openapi.yaml` for the complete API documentation.

Key endpoints:
- `/api/assets` - List and search assets
- `/api/folders` - Manage folder hierarchy
- `/api/users` - User management
- `/api/groups` - Group management
- `/api/export` - Export assets
- `/api/import` - Import/restore assets
- `/api/lineage` - Data lineage information
- `/api/catalog` - Data catalog and field metadata

## Security

- Authentication via AWS Cognito with JWT tokens
- Row-level security based on QuickSight permissions
- Encrypted storage in S3
- API Gateway with CORS configuration
- CloudTrail integration for audit logging

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure CloudFront distribution URL is added to API Gateway CORS configuration
2. **Permission denied**: Check Lambda execution role has required QuickSight permissions
3. **Cognito callback URL mismatch**: Update Cognito app client with correct callback URLs
4. **S3 access denied**: Ensure metadata bucket exists and Lambda has read/write permissions

### Debugging

- CloudWatch Logs for Lambda function logs
- Browser DevTools for frontend debugging
- AWS X-Ray for distributed tracing (if enabled)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- AWS QuickSight team for the comprehensive API
- React and Material-UI communities
- AWS CDK for infrastructure as code

## Support

For issues, questions, or contributions, please open an issue on GitHub.