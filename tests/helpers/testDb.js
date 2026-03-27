'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let _testDb = null;

function setupTestDb() {
  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = ':memory:';
  process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars-long-for-hs256';
  process.env.BCRYPT_ROUNDS = '1'; // Nhanh hơn trong test
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.LOG_LEVEL = 'silent';

  // Ghi đè getDb để dùng in-memory DB
  const dbModule = require('../../src/config/database');
  const schemaSQL = fs.readFileSync(
    path.join(__dirname, '../../scripts/migrate.js'),
    'utf8'
  );

  // Trích xuất schema string từ migrate.js
  const match = schemaSQL.match(/const schema = `([\s\S]+?)`;/);
  if (!match) throw new Error('Không tìm thấy schema trong migrate.js');

  _testDb = new Database(':memory:');
  _testDb.pragma('foreign_keys = ON');
  _testDb.exec(match[1]);

  // Monkey-patch getDb để return test db
  jest.spyOn(dbModule, 'getDb').mockReturnValue(_testDb);
  return _testDb;
}

function teardownTestDb() {
  if (_testDb) {
    _testDb.close();
    _testDb = null;
  }
}

module.exports = { setupTestDb, teardownTestDb };
