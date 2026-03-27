'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../config/database');
const logger = require('../config/logger');

/**
 * Ghi audit log cho các thao tác quan trọng.
 * @param {string} hanh_dong - Tên hành động (vd: 'TAO_THIET_BI')
 * @param {string} doi_tuong - Tên đối tượng (vd: 'thiet_bi')
 */
function auditLog(hanh_dong, doi_tuong) {
  return (req, res, next) => {
    // Wrap res.json để bắt response id
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const db = getDb();
          db.prepare(`
            INSERT INTO audit_log(id, nguoi_dung_id, hanh_dong, doi_tuong, doi_tuong_id, ip_address)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            uuidv4(),
            req.user?.id || null,
            hanh_dong,
            doi_tuong,
            data?.id || req.params?.id || null,
            req.ip
          );
        } catch (err) {
          logger.error('Không ghi được audit log', { error: err.message });
        }
      }
      return originalJson(data);
    };
    next();
  };
}

module.exports = auditLog;
