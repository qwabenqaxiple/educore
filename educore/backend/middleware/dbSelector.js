// middleware/dbSelector.js
// Routes all DB queries in a request to the correct pool (live or demo).
// Uses req.dbType set by the authenticate middleware — must run AFTER authenticate.
const { setDbContext } = require('../db/pool');

const dbSelector = (req, res, next) => {
  const dbType = req.dbType || 'live';
  setDbContext(dbType, () => next());
};

module.exports = dbSelector;
