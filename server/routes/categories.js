const express = require('express');
const db = require('../database');
const router = express.Router();

router.get('/', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json(cats);
});

module.exports = router;
