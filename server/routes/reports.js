const express = require('express');
const db = require('../database');
const router = express.Router();

// Momento del último cierre de caja (o epoch si nunca se cerró)
function lastClosureTime() {
  const row = db.prepare('SELECT closed_at FROM cash_closures ORDER BY id DESC LIMIT 1').get();
  return row ? row.closed_at : '1970-01-01 00:00:00';
}

// Resumen de la caja abierta: ventas desde el último cierre
function buildSummary() {
  const from = lastClosureTime();
  const orders = db.prepare(`
    SELECT o.id, o.table_id, o.closed_at, o.payment_method, o.total_paid,
           t.label as table_label, e.name as employee_name
    FROM orders o
    LEFT JOIN tables t ON t.id = o.table_id
    LEFT JOIN employees e ON e.id = o.employee_id
    WHERE o.status='closed' AND o.closed_at > ?
    ORDER BY o.closed_at DESC
  `).all(from);

  const byMethod = { efectivo: 0, tarjeta: 0, bizum: 0, invitacion: 0 };
  const byEmployee = {};
  let total = 0;
  for (const o of orders) {
    const amt = o.total_paid || 0;
    total += amt;
    if (byMethod[o.payment_method] != null) byMethod[o.payment_method] += amt;
    const emp = o.employee_name || '—';
    byEmployee[emp] = (byEmployee[emp] || 0) + amt;
  }

  // Productos más vendidos en el periodo
  const topProducts = db.prepare(`
    SELECT p.name, p.emoji, SUM(oi.quantity) as qty, SUM(oi.price*oi.quantity) as importe
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status='closed' AND o.closed_at > ?
    GROUP BY oi.product_id
    ORDER BY qty DESC
    LIMIT 5
  `).all(from);

  return {
    from,
    order_count: orders.length,
    total,
    by_method: byMethod,
    by_employee: Object.entries(byEmployee).map(([name, amount]) => ({ name, amount })),
    top_products: topProducts,
    tickets: orders,
  };
}

// GET resumen de la caja actual
router.get('/summary', (req, res) => {
  res.json(buildSummary());
});

// POST cierre de caja (Z): foto del turno y reinicio del acumulado
router.post('/close', (req, res) => {
  const { employee_id, employee_name } = req.body;
  const s = buildSummary();
  if (s.order_count === 0) return res.status(400).json({ error: 'No hay ventas que cerrar' });

  const r = db.prepare(`
    INSERT INTO cash_closures
      (closed_by, employee_name, from_at, order_count, total,
       total_efectivo, total_tarjeta, total_bizum, total_invitacion)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    employee_id || null, employee_name || '—', s.from, s.order_count, s.total,
    s.by_method.efectivo, s.by_method.tarjeta, s.by_method.bizum, s.by_method.invitacion
  );
  const closure = db.prepare('SELECT * FROM cash_closures WHERE id=?').get(r.lastInsertRowid);
  res.json({ ok: true, closure });
});

// GET historial de cierres
router.get('/closures', (req, res) => {
  res.json(db.prepare('SELECT * FROM cash_closures ORDER BY id DESC LIMIT 50').all());
});

module.exports = router;
