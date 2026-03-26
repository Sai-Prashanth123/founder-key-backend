import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          paths: {
            '@config/*': ['./src/config/*'],
            '@middlewares/*': ['./src/middlewares/*'],
            '@modules/*': ['./src/modules/*'],
            '@utils/*': ['./src/utils/*'],
            '@appTypes/*': ['./src/types/*'],
            '@types/*': ['./src/types/*'],
            '@jobs/*': ['./src/jobs/*'],
            '@sockets/*': ['./src/sockets/*'],
          },
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@appTypes/(.*)$': '<rootDir>/src/types/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@jobs/(.*)$': '<rootDir>/src/jobs/$1',
    '^@sockets/(.*)$': '<rootDir>/src/sockets/$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  // tests/setup.ts uses `jest.mock(...)`, so it must run in a Jest environment,
  // not as `globalSetup` (where `jest` is not defined).
  setupFilesAfterEnv: ['./tests/setup.ts'],
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  verbose: true,
  testTimeout: 30000,
};

export default config;
