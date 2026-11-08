const { databaseMode, isOnline } = require('../config/db');

// This middleware reports state, not a routing decision. Actual queries can
// recover connectivity without health probes or a global offline latch.
module.exports = (req, res, next) => {
  req.databaseMode = databaseMode;
  if (process.env.NODE_ENV === 'test') {
    if (req.isOnline === undefined) req.isOnline = true;
  } else {
    req.isOnline = databaseMode === 'local' || isOnline();
  }
  next();
};
