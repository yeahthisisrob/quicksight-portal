# QuickSight Assets Portal - task runner
#
# Every recipe goes through `mise exec` so the pinned node/pnpm in mise.toml are
# used even if mise is not activated in your shell.
#
# Start here:
#   just install      one-time setup (toolchain, deps, git hooks)
#   just dev          run the stack locally
#   just check        what CI runs - do this before opening a PR

x := "mise exec --"

# Show available recipes
default:
    @just --list --unsorted

# ============================================================================
# SETUP
# ============================================================================

# One-time setup: toolchain, dependencies, git hooks
[group('setup')]
install:
    mise install
    {{x}} pnpm install
    {{x}} lefthook install
    @echo "Ready. 'just dev' to run the stack, 'just check' before a PR."

# Remove build output and caches (keeps node_modules)
[group('setup')]
clean:
    ./scripts/kill-sam.sh || true
    rm -rf .aws-sam backend/lambda/dist frontend/dist infrastructure/cdk/cdk.out

# ============================================================================
# DEV
# ============================================================================

# Run backend (SAM, :3000) and frontend (Vite, :5173) together
[group('dev')]
dev: build-dev
    {{x}} pnpm exec concurrently --names 'SAM,WEB,WATCH,TSC' --prefix-colors 'blue,green,yellow,cyan' \
        "just sam" "just web" "just watch" "just watch-types"

# API only, via SAM local
[group('dev')]
sam:
    sam local start-api --template-file sam/template.yaml --env-vars sam/env.json \
        --port 3000 --warm-containers EAGER --skip-pull-image

# Frontend dev server
[group('dev')]
web:
    {{x}} pnpm --filter @quicksight-portal/frontend run dev

# Rebuild the Lambda bundle on change
[group('dev')]
watch:
    {{x}} pnpm --filter @quicksight-portal/lambda run watch

# Typecheck the backend on change
[group('dev')]
watch-types:
    {{x}} pnpm --filter @quicksight-portal/lambda run watch:typecheck

# Storybook (:6006)
[group('dev')]
storybook:
    {{x}} pnpm --filter @quicksight-portal/frontend run storybook

# Tail SAM logs
[group('dev')]
logs:
    ./scripts/get-sam-logs.sh

# Stop a stuck SAM container
[group('dev')]
kill:
    ./scripts/kill-sam.sh

# ============================================================================
# CHECK
#   export QSP_API_URL=https://<SiteURL>  QSP_API_KEY=qsp_...
#   just api GET /smus/status
#   just api POST /authoring/dashboard/<id>/rebind/plan '{"rebinds":[...]}'
# Call the portal API with an API key (docs/api-guide.md)
[group('api')]
api method path body='':
    #!/usr/bin/env bash
    set -euo pipefail
    : "${QSP_API_URL:?set QSP_API_URL to the portal URL (the SiteURL stack output)}"
    : "${QSP_API_KEY:?set QSP_API_KEY to a key from Settings > API keys}"
    url="${QSP_API_URL%/}/api{{path}}"
    if [ -n '{{body}}' ]; then
      curl -sS -X {{method}} "$url" -H "Authorization: Bearer $QSP_API_KEY" -H 'Content-Type: application/json' --data '{{body}}'
    else
      curl -sS -X {{method}} "$url" -H "Authorization: Bearer $QSP_API_KEY"
    fi
    echo

# ============================================================================

# Everything CI runs. Do this before opening a PR.
[group('check')]
check: lint deadcode typecheck test architecture
    @echo "All checks passed."

# Format + lint the whole repo (Biome, ~150ms)
[group('check')]
lint:
    {{x}} pnpm exec biome check .

# Unused files, exports, types and dependencies (knip). Biome catches unused
# imports and locals within a file; this catches what no other file uses.
[group('check')]
deadcode:
    {{x}} pnpm exec knip --no-progress

# Apply every safe fix Biome can make
[group('check')]
fix:
    {{x}} pnpm exec biome check --write .

# Typecheck every package
[group('check')]
typecheck:
    {{x}} pnpm -r run typecheck

# Unit tests, every package
[group('check')]
test *args:
    {{x}} pnpm -r run test {{args}}

# Tests for one package: just test-pkg lambda | frontend | cdk | shared
[group('check')]
test-pkg pkg *args:
    {{x}} pnpm --filter @quicksight-portal/{{pkg}} run test {{args}}

# Re-run tests on change (backend)
[group('check')]
test-watch:
    {{x}} pnpm --filter @quicksight-portal/lambda run test:watch

# Coverage, every package
[group('check')]
coverage:
    {{x}} pnpm -r run test:coverage

# Prove the VSA/FSD rules still catch violations
[group('check')]
architecture:
    {{x}} node scripts/verify-architecture-rules.mjs

# Render every Storybook story in Chromium and fail on console errors
[group('check')]
check-storybook:
    {{x}} pnpm --filter @quicksight-portal/frontend run test:storybook:ci

# Give the portal's Lambda role a seat in the SMUS (DataZone) domain, so it
# can list projects and read the catalog. Runs with YOUR admin credentials.
#   just smus-grant dzd_xxxx                     every project, read-only
#   just smus-grant dzd_xxxx "analytics_prod,analytics_dev"
[group('ops')]
smus-grant domain projects='' region='us-east-1' stack='QuicksightPortalStack' designation='PROJECT_CATALOG_VIEWER' role='':
    {{x}} node scripts/smus-grant-portal-access.mjs --domain {{domain}} --region {{region}} --stack {{stack}} --designation {{designation}} {{ if projects != '' { "--projects " + projects } else { "" } }} {{ if role != '' { "--role-arn " + role } else { "" } }}

# ============================================================================
# BUILD
# ============================================================================

# Production build of every package
[group('build')]
build:
    {{x}} pnpm -r run build

# Unminified backend bundle for local SAM
[group('build')]
build-dev:
    {{x}} pnpm --filter @quicksight-portal/lambda exec node build.js dev

# Validate the OpenAPI schema and regenerate shared types
[group('build')]
contract:
    {{x}} pnpm --filter @quicksight-portal/shared run contract

# ============================================================================
# INFRA
# ============================================================================

# Show the CloudFormation diff
[group('infra')]
diff: build
    {{x}} pnpm --filter @quicksight-portal/cdk exec cdk diff

# Synthesize templates
[group('infra')]
synth: build
    {{x}} pnpm --filter @quicksight-portal/cdk run synth

# Deploy. Runs the full check first - never deploy something unverified.
[group('infra')]
deploy: check build
    {{x}} pnpm --filter @quicksight-portal/cdk run deploy

# ============================================================================
# MAINTENANCE
# ============================================================================

# Show outdated dependencies across the workspace
[group('maint')]
outdated:
    {{x}} pnpm -r outdated || true

# Update dependencies within their current semver ranges
[group('maint')]
update:
    {{x}} pnpm -r update
    {{x}} pnpm install

# Re-scan for secrets and refresh the allowlist baseline
[group('maint')]
secrets-baseline:
    {{x}} gitleaks git --report-path .gitleaks-report.json --no-banner || true
    @echo "Review .gitleaks-report.json, then add false positives to .gitleaksignore"

# Lines of code by file, excluding tests, stories and generated code
[group('maint')]
cloc:
    cloc . --by-file \
        --exclude-dir=node_modules,dist,build,cdk.out,storybook-static,generated,.claude \
        --match-f='.*\.(ts|tsx)$$'
