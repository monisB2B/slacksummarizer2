import pino from 'pino';
import config from './config';

const loggerOptions = {
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: config.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  } : undefined,
};

const logger = pino(loggerOptions);

export default logger;