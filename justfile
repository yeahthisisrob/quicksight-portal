# QuickSight Assets Portal - Development Tasks

# Default task - show available commands
default:
    @just --list

# Full development workflow with validation
dev: check start

# Quick development workflow - skip checks, just build and start
dev-quick: clean build-dev
    @echo "🚀 Starting development services (quick mode - no checks)..."
    npx concurrently --names 'SAM,FRONTEND,WATCH,TSC,🚨ERRORS' --prefix-colors 'blue,green,yellow,cyan,red' \
        "just sam" \
        "just frontend" \
        "just watch" \
        "just typecheck-watch" \
        "while true; do sam logs --tail --filter-pattern ERROR 2>/dev/null || sleep 2; done"

# Pre-flight checks (fail fast) - Backend first, then Frontend
check: check-backend check-frontend
    @echo "✅ All checks passed!"

# Backend checks only
check-backend:
    @echo "📦 Checking Backend..."
    cd backend/lambda && npm run lint:fix
    cd backend/lambda && npm run typecheck
    cd backend/lambda && npm run test
    @echo "✅ Backend checks passed!"

# Frontend checks only
check-frontend:
    @echo "🎨 Checking Frontend..."
    cd frontend && npm run lint:fix
    cd frontend && npx tsc --noEmit
    cd frontend && npm test
    just check-storybook
    @echo "✅ Frontend checks passed!"

# Storybook checks - smoke test all stories
check-storybook:
    @echo "📚 Checking Storybook stories..."
    cd frontend && npm run test:storybook:ci
    @echo "✅ Storybook checks passed!"

# Full frontend check including Storybook
check-frontend-full: check-frontend check-storybook
    @echo "✅ All frontend checks including Storybook passed!"

# Start all development services
start: clean build-dev
    @echo "🚀 Starting development services..."
    npx concurrently --names 'SAM,FRONTEND,WATCH,TSC,🚨ERRORS' --prefix-colors 'blue,green,yellow,cyan,red' \
        "just sam" \
        "just frontend" \
        "just watch" \
        "just typecheck-watch" \
        "while true; do sam logs --tail --filter-pattern ERROR 2>/dev/null || sleep 2; done"

# Quick start (skip validation)
quick: clean build-dev
    @echo "⚡ Quick start (skipping checks)..."
    npx concurrently --names 'SAM,FRONTEND,WATCH,🚨ERRORS' --prefix-colors 'blue,green,yellow,red' \
        "just sam" \
        "just frontend" \
        "just watch" \
        "while true; do sam logs --tail --filter-pattern ERROR 2>/dev/null || sleep 2; done"

# Individual services
sam:
    sam local start-api --template-file sam/template.yaml --env-vars sam/env.json --port 3000 --warm-containers EAGER --skip-pull-image

frontend:
    cd frontend && npm run dev

watch:
    cd backend/lambda && npm run watch

typecheck-watch:
    cd backend/lambda && npm run watch:typecheck

# Build tasks (schema validation and type generation handled by esbuild)
build: lint test build-backend build-frontend

build-dev:
    cd backend/lambda && node build.js dev

build-backend:
    cd backend/lambda && npm run build

build-frontend:
    cd frontend && npm run build

build-prod: build-backend-prod build-frontend

# Quick production build (no linting/testing)
build-backend-prod:
    cd backend/lambda && npm run build:quick

# Quality checks
lint:
    cd backend/lambda && npm run lint:fix
    cd frontend && npm run lint:fix

test:
    cd backend/lambda && npm run test

test-watch:
    cd backend/lambda && npm run test:watch

coverage: coverage-backend coverage-frontend
    @echo "✅ All coverage reports generated!"

coverage-backend:
    cd backend/lambda && npm run test:coverage

coverage-frontend:
    cd frontend && npm run test:coverage


# Run specific test files
test-file FILE:
    cd backend/lambda && npm test -- {{FILE}}

# Run tests matching a pattern
test-pattern PATTERN:
    cd backend/lambda && npm test -- --testNamePattern="{{PATTERN}}"


# Infrastructure
deploy: build-prod
    cd infrastructure/cdk && npm run deploy

deploy-prod: build-prod
    cd infrastructure/cdk && npx cdk deploy --all --require-approval never

# Deploy with full validation (slower but safer)
deploy-validated: validate build-prod
    cd infrastructure/cdk && npm run deploy

# Run all validations
validate:
    @echo "🔍 Running full validation suite..."
    cd backend/lambda && npm run lint:fix
    cd backend/lambda && npm run typecheck
    cd backend/lambda && npm test
    cd frontend && npm run lint:fix
    @echo "✅ All validations passed!"

cdk-synth: build
    cd infrastructure/cdk && npx cdk synth

cdk-diff: build
    cd infrastructure/cdk && npx cdk diff

# Utilities
clean:
    @echo "🧹 Cleaning up..."
    ./scripts/kill-sam.sh || true
    rm -rf .aws-sam

install:
    npm ci
    cd backend/lambda && npm ci
    cd frontend && npm ci
    cd infrastructure/cdk && npm ci

# Development helpers
logs:
    ./scripts/get-sam-logs.sh

kill:
    ./scripts/kill-sam.sh

# Code metrics - show file sizes
cloc:
    cloc . --by-file --exclude-dir=node_modules,dist,build,.next,out,cdk.out,__tests__,__mocks__,.storybook,storybook-static,generated --exclude-ext=test.ts,test.tsx,spec.ts,spec.tsx,stories.ts,stories.tsx,story.ts,story.tsx --match-f='.*\.(ts|tsx)$$'

# Count lines including tests and stories
cloc-with-tests:
    cloc . --by-file --exclude-dir=node_modules,dist,build,.next,out,cdk.out --match-f='.*\.(ts|tsx)$$'

# Type check with details
typecheck:
    @echo "🔍 Running TypeScript type checking..."
    @cd backend/lambda && npx tsc --noEmit

# Strict type check (shows all issues)
typecheck-strict:
    @echo "🔍 Running strict TypeScript checking..."
    @cd backend/lambda && npx tsc --noEmit --listFiles=false 2>&1 | grep -v "^$$"