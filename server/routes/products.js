const express = require('express');
const db = require('../database');
const router = express.Router();

router.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, c.emoji as category_emoji
    FROM products p
    JOIN categories c ON c.id = p.category_id
    WHERE p.available = 1
    ORDER BY c.sort_order, p.name
  `).all();
  res.json(products);
});

router.patch('/:id/availability', (req, res) => {
  const { available } = req.body;
  db.prepare('UPDATE products SET available=? WHERE id=?').run(available ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
