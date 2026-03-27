'use strict';

const { validationResult } = require('express-validator');

/**
 * Middleware kiểm tra kết quả validation từ express-validator.
 * Trả về lỗi đầu tiên theo từng field để UI dễ hiển thị.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = {};
    errors.array().forEach(e => {
      if (!formatted[e.path]) formatted[e.path] = e.msg;
    });
    return res.status(422).json({ error: 'Dữ liệu không hợp lệ', fields: formatted });
  }
  next();
}

module.exports = validate;
