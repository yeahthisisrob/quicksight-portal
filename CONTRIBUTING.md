# Contributing to QuickSight Assets Portal

Thank you for considering contributing to the QuickSight Assets Portal! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the [issue tracker](https://github.com/yourusername/quicksight-assets-portal/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce the problem
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Screenshots if applicable

### Suggesting Features

1. Check the issue tracker for existing feature requests
2. Open a new issue with the "enhancement" label
3. Provide detailed description of the feature and use cases
4. Explain why this feature would be useful

### Submitting Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the setup instructions** in README.md
3. **Write your code** following our coding standards
4. **Add tests** for new functionality
5. **Update documentation** as needed
6. **Ensure all tests pass** before submitting
7. **Create a pull request** with clear description

## Development Setup

### Prerequisites

- Node.js 18+
- AWS Account with appropriate permissions
- Git

### Local Development

1. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/quicksight-assets-portal.git
   cd quicksight-assets-portal
   ```

2. Install dependencies:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   cd backend/lambda && npm install && cd ../..
   ```

3. Set up configuration:
   ```bash
   cp env.json.example env.json
   cp frontend/public/config.js.example frontend/public/config.js
   # Edit these files with your configuration
   ```

4. Start development servers:
   ```bash
   # Terminal 1: Backend
   cd backend/lambda && npm run dev

   # Terminal 2: Frontend
   cd frontend && npm run dev
   ```

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Define interfaces for data structures
- Avoid `any` type; use `unknown` if type is truly unknown
- Use meaningful variable and function names
- Prefer `const` over `let` when possible

### Code Style

- We use ESLint and Prettier for code formatting
- Run `npm run lint` before committing
- Run `npm run format` to auto-fix formatting issues
- Follow existing code patterns in the codebase

### File Organization

- **One test file per source file**: `Component.ts` → `Component.test.ts`
- Group related functionality in feature folders
- Keep components focused and single-purpose
- Extract reusable logic to shared utilities

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use Material-UI components consistently
- Implement proper error boundaries
- Add loading states for async operations

### Backend Services

- Follow service/handler pattern
- Implement proper error handling
- Add logging for debugging
- Keep Lambda functions focused
- Cache expensive operations appropriately

## Testing

### Running Tests

```bash
# All tests
npm test

# Backend tests
cd backend/lambda && npm test

# Frontend tests
cd frontend && npm test

# Watch mode
npm test -- --watch

# Coverage report
npm test -- --coverage
```

### Writing Tests

- Write unit tests for all new functionality
- Follow the AAA pattern: Arrange, Act, Assert
- Mock external dependencies appropriately
- Test error cases and edge conditions
- Aim for >80% code coverage

Example test structure:
```typescript
describe('ComponentName', () => {
  it('should handle normal case', () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toEqual(expectedOutput);
  });

  it('should handle error case', () => {
    // Test error handling
  });
});
```

## Commit Messages

Follow conventional commits format:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(export): add support for bulk dashboard export
fix(auth): resolve token refresh issue
docs(readme): update installation instructions
```

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Document complex algorithms
- Include examples for utility functions
- Keep comments up-to-date with code changes

### API Documentation

- Update OpenAPI spec for API changes
- Document request/response formats
- Include example payloads
- Note any breaking changes

## Pull Request Process

1. **Update your branch** with latest main:
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Ensure quality**:
   - All tests pass
   - No linting errors
   - Documentation updated
   - Commit messages follow convention

3. **Create PR** with:
   - Descriptive title
   - Link to related issue(s)
   - Description of changes
   - Screenshots for UI changes
   - Testing instructions

4. **Address review feedback**:
   - Respond to all comments
   - Make requested changes
   - Update PR description if needed

5. **Merge criteria**:
   - Approved by maintainer
   - All checks passing
   - No merge conflicts
   - Up-to-date with main

## Release Process

Maintainers handle releases following semantic versioning:

- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features, backwards compatible
- **Patch** (0.0.x): Bug fixes

## Questions?

- Open an issue for questions
- Join discussions in issues/PRs
- Check existing documentation

## Recognition

Contributors are recognized in:
- GitHub contributors page
- Release notes
- Project documentation

Thank you for contributing to QuickSight Assets Portal!