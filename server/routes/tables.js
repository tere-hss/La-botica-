const express = require('express');
const db = require('../database');
const router = express.Router();

router.get('/', (req, res) => {
  const zones = db.prepare('SELECT * FROM zones ORDER BY sort_order').all();
  const tables = db.prepare(`
    SELECT t.*,
      o.id as order_id,
      COALESCE(SUM(oi.price * oi.quantity), 0) as total,
      COUNT(CASE WHEN oi.status IN ('pending','sent','preparing') THEN 1 END) as pending_items,
      MAX(o.created_at) as opened_at
    FROM tables t
    LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
    LEFT JOIN order_items oi ON oi.order_id = o.id
    GROUP BY t.id
    ORDER BY t.number
  `).all();

  const byZone = zones.map(z => ({
    ...z,
    tables: tables.filter(t => t.zone_id === z.id)
  }));
  res.json(byZone);
});

router.patch('/:id/position', (req, res) => {
  const { x, y } = req.body;
  db.prepare('UPDATE tables SET x=?, y=? WHERE id=?').run(x, y, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE tables SET status=? WHERE id=?').run(status, req.params.id);
  req.app.get('io').emit('tables:refresh');
  res.json({ ok: true });
});

module.exports = router;
