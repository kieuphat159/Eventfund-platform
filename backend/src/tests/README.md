# Testing Infrastructure

This directory contains the testing infrastructure for the EventFund Platform backend.

## Structure

```
tests/
├── config/           # Test configuration files
│   ├── test.config.js      # Test environment configuration
│   ├── logger.config.js    # Test logger configuration
│   └── index.js            # Configuration exports
├── helpers/          # Test helper utilities
│   ├── db.helper.js        # Database setup/teardown helpers
│   ├── user.factory.js     # User data factory
│   ├── jwt.helper.js       # JWT token generator
│   ├── request.helper.js   # Mock request/response helpers
│   └── index.js            # Helper exports
├── mocks/            # Mock implementations
│   └── redis.mock.js       # Mock Redis client
├── setup.js          # Jest setup file (runs before all tests)
└── README.md         # This file
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Unit Tests Only
```bash
npm run test:unit
```

### Integration Tests Only
```bash
npm run test:integration
```

## Test Environment

Tests use the following environment:
- **Database**: MongoDB Memory Server (in-memory MongoDB instance)
- **Redis**: Mock Redis client (in-memory implementation)
- **Logger**: Silent mode (only errors logged)
- **JWT**: Test secret key
- **Environment**: `.env.test` configuration

## Writing Tests

### Unit Tests

Place unit tests next to the file being tested with `.test.js` suffix:

```javascript
// src/services/user.service.test.js
import { describe, test, expect } from '@jest/globals';
import { UserService } from './user.service.js';

describe('UserService', () => {
  test('should create user', async () => {
    // Test implementation
  });
});
```

### Integration Tests

Place integration tests in `__tests__` directories:

```javascript
// src/controllers/__tests__/user.controller.integration.test.js
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { connectTestDB, disconnectTestDB } from '../../../tests/helpers/index.js';

describe('User Controller Integration', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  test('should handle user creation', async () => {
    // Test implementation
  });
});
```

## Test Helpers

### Database Helpers

```javascript
import { connectTestDB, disconnectTestDB, clearTestDB } from './helpers/index.js';

// Connect to test database
await connectTestDB();

// Clear all collections
await clearTestDB();

// Disconnect from test database
await disconnectTestDB();
```

### User Factory

```javascript
import { createUserData, createAdminUser, generateWalletAddress } from './helpers/index.js';

// Create test user data
const userData = createUserData({ username: 'testuser' });

// Create admin user
const adminUser = createAdminUser();

// Generate wallet address
const wallet = generateWalletAddress();
```

### JWT Helper

```javascript
import { generateTestToken, generateAdminToken } from './helpers/index.js';

// Generate token for user
const token = generateTestToken({ walletAddress: '0x123...', role: 'user' });

// Generate admin token
const adminToken = generateAdminToken('0x123...');
```

### Request/Response Helpers

```javascript
import { createMockRequest, createMockResponse, createMockNext } from './helpers/index.js';

// Create mock request
const req = createMockRequest({
  body: { username: 'test' },
  params: { id: '123' }
});

// Create mock response
const res = createMockResponse();

// Create mock next function
const next = createMockNext();
```

## Coverage Requirements

The project requires minimum 80% code coverage across:
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data after tests complete
3. **Mocking**: Use mocks for external services (Redis, blockchain)
4. **Descriptive Names**: Use clear, descriptive test names
5. **Arrange-Act-Assert**: Follow AAA pattern in tests
6. **Fast Tests**: Keep tests fast by using in-memory databases
7. **No Side Effects**: Tests should not affect production data

## Troubleshooting

### Tests Hanging
- Ensure all database connections are closed in `afterAll` hooks
- Check for unresolved promises
- Increase test timeout if needed

### Memory Issues
- Clear test database between tests
- Disconnect from database after test suites
- Use `--runInBand` flag to run tests serially

### Import Errors
- Ensure all imports use `.js` extension (ES modules)
- Check that `NODE_OPTIONS=--experimental-vm-modules` is set
