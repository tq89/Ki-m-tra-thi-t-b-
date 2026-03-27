'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

const logger = require('./config/logger');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes/index');

const app = express();

// ── Bảo mật HTTP headers ──────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3001').split(',');
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' không được phép`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

// ── Middleware cơ bản ─────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Logging HTTP ──────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim(), { source: 'http' }) },
  skip: (req) => req.url === '/api/v1/health',
}));

// ── Rate limiting ─────────────────────────────────────────
app.use('/api/', generalLimiter);

// ── Routes ────────────────────────────────────────────────
app.use('/api/v1', routes);

// ── 404 & Error handler ───────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Khởi động server ──────────────────────────────────────
const PORT = parseInt(process.env.PORT) || 3000;

function start() {
  const server = app.listen(PORT, () => {
    logger.info(`PCCC API server khởi động`, { port: PORT, env: process.env.NODE_ENV });
    console.log(`[SERVER] ✓ http://localhost:${PORT}/api/v1`);
  });

  // Graceful shutdown
  ['SIGTERM', 'SIGINT'].forEach(signal => {
    process.on(signal, () => {
      logger.info(`Nhận ${signal} — đang tắt server...`);
      server.close(() => {
        const { closeDb } = require('./config/database');
        closeDb();
        logger.info('Server đã tắt');
        process.exit(0);
      });
    });
  });

  return server;
}

if (require.main === module) start();

module.exports = { app, start };
