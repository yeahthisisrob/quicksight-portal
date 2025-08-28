/**
 * Logger using AWS Lambda Powertools
 */
import * as fs from 'fs';
import * as path from 'path';

import { Logger, LogLevel } from '@aws-lambda-powertools/logger';

// Map string log levels to PowerTools LogLevel enum
const getLogLevel = (): (typeof LogLevel)[keyof typeof LogLevel] => {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  switch (envLevel) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
};

// Drive sample rate from env, default to 1
const sampleRate = parseFloat(process.env.POWERTOOLS_LOGGER_SAMPLE_RATE || '1');

const loggerOptions = {
  serviceName: process.env.SERVICE_NAME || 'quicksight-portal-api',
  sampleRateValue: sampleRate,
  logLevel: getLogLevel(),
};

const powertoolsLogger = new Logger(loggerOptions);

// Simple file logging for local development
const isLocalDev = process.env.NODE_ENV === 'development';
let localLogFile: string | null = null;

// Only log configuration in DEBUG/dev
if (getLogLevel() === LogLevel.DEBUG || isLocalDev) {
  // Use powertools logger for initialization instead of console.debug
  // This will be handled by the logger once it's created
}

if (isLocalDev) {
  // SAM Local mounts the function code directory as read-only at /var/task
  // We can write to /tmp which is writable but not persistent
  // Better approach: use AWS_SAM_LOCAL environment variable that SAM sets
  const isSamLocal = process.env.AWS_SAM_LOCAL === 'true';

  // Choose log location based on environment
  const logDir = isSamLocal ? '/tmp' : path.join(process.cwd(), 'logs');

  try {
    if (!isSamLocal && !fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFileName = `quicksight-${new Date().toISOString().split('T')[0]}.log`;
    localLogFile = path.join(logDir, logFileName);

    // Test write access
    fs.appendFileSync(
      localLogFile,
      `[${new Date().toISOString()}] Logger initialized (SAM Local: ${isSamLocal})\n`
    );

    // Logger initialized silently
  } catch (error) {
    localLogFile = null;
    console.warn('Could not initialize file logging:', error);
  }
}

// Helper function to write to local file in dev mode
const writeToLocalFile = (level: string, message: string, data?: any): void => {
  if (!isLocalDev || !localLogFile) {
    return;
  }

  try {
    // In development, log everything to file for debugging
    const logEntry = `[${new Date().toISOString()}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    fs.appendFileSync(localLogFile, logEntry);
  } catch (_error) {
    // Fail silently
  }
};

// Export a wrapper that matches the existing interface
export const logger = {
  info: (message: string, data?: any): void => {
    powertoolsLogger.info(message, data);
    writeToLocalFile('INFO', message, data);
  },

  error: (message: string, data?: any): void => {
    powertoolsLogger.error(message, data);
    writeToLocalFile('ERROR', message, data);
  },

  warn: (message: string, data?: any): void => {
    powertoolsLogger.warn(message, data);
    writeToLocalFile('WARN', message, data);
  },

  debug: (message: string, data?: any): void => {
    powertoolsLogger.debug(message, data);
    writeToLocalFile('DEBUG', message, data);
  },

  // Helper to get the local log file path
  getLogFilePath: (): string | null => localLogFile,
};
