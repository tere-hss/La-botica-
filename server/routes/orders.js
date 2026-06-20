const express = require('express');
const db = require('../database');
const router = express.Router();

function getOrderWithItems(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if (!order) return null;
  order.items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.emoji
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = ?
    ORDER BY oi.id
  `).all(orderId);
  order.total = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  return order;
}

// Get active order for a table
router.get('/table/:tableId', (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE table_id=? AND status='open'").get(req.params.tableId);
  if (!order) return res.json(null);
  res.json(getOrderWithItems(order.id));
});

// Get all open orders (for kitchen)
router.get('/kitchen', (req, res) => {
  const orders = db.prepare(`
    SELECT o.id, t.label as table_label, t.number as table_number
    FROM orders o
    JOIN tables t ON t.id = o.table_id
    WHERE o.status = 'open'
    ORDER BY o.created_at
  `).all();

  const result = orders.map(o => {
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.emoji
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND oi.status IN ('sent','preparing','ready')
      ORDER BY oi.sent_at, oi.id
    `).all(o.id);
    return { ...o, items };
  }).filter(o => o.items.length > 0);

  res.json(result);
});

// Open or get order for a table
router.post('/table/:tableId', (req, res) => {
  const { employee_id, guests } = req.body;
  let order = db.prepare("SELECT * FROM orders WHERE table_id=? AND status='open'").get(req.params.tableId);
  if (!order) {
    const r = db.prepare("INSERT INTO orders (table_id, employee_id, guests) VALUES (?,?,?)").run(req.params.tableId, employee_id || 1, guests || 1);
    db.prepare("UPDATE tables SET status='ocupada' WHERE id=?").run(req.params.tableId);
    order = db.prepare('SELECT * FROM orders WHERE id=?').get(r.lastInsertRowid);
    req.app.get('io').emit('tables:refresh');
  }
  res.json(getOrderWithItems(order.id));
});

// Add item to order
router.post('/:id/items', (req, res) => {
  const { product_id, quantity, notes } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const r = db.prepare(
    "INSERT INTO order_items (order_id,product_id,quantity,price,notes) VALUES (?,?,?,?,?)"
  ).run(req.params.id, product_id, quantity || 1, product.price, notes || '');

  const item = db.prepare(`
    SELECT oi.*, p.name as product_name, p.emoji
    FROM order_items oi JOIN products p ON p.id=oi.product_id
    WHERE oi.id=?
  `).get(r.lastInsertRowid);

  req.app.get('io').emit('order:updated', { order_id: req.params.id });
  res.json(item);
});

// Remove item (only if pending)
router.delete('/items/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM order_items WHERE id=?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  if (item.status !== 'pending') return res.status(400).json({ error: 'Item ya enviado a cocina' });
  db.prepare('DELETE FROM order_items WHERE id=?').run(req.params.itemId);
  req.app.get('io').emit('order:updated', { order_id: item.order_id });
  res.json({ ok: true });
});

// Send pending items to kitchen
router.post('/:id/send', (req, res) => {
  db.prepare(`
    UPDATE order_items SET status='sent', sent_at=datetime('now','localtime')
    WHERE order_id=? AND status='pending'
  `).run(req.params.id);
  req.app.get('io').emit('kitchen:refresh');
  req.app.get('io').emit('order:updated', { order_id: req.params.id });
  res.json({ ok: true });
});

// Update item status (kitchen)
router.patch('/items/:itemId/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE order_items SET status=? WHERE id=?').run(status, req.params.itemId);
  const item = db.prepare('SELECT * FROM order_items WHERE id=?').get(req.params.itemId);
  req.app.get('io').emit('kitchen:refresh');
  req.app.get('io').emit('order:updated', { order_id: item.order_id });
  res.json({ ok: true });
});

// Close and pay order
router.post('/:id/pay', (req, res) => {
  const { method, amount_paid } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name
    FROM order_items oi JOIN products p ON p.id=oi.product_id
    WHERE oi.order_id=?
  `).all(req.params.id);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const cambio = amount_paid ? Math.max(0, amount_paid - total) : 0;

  db.prepare(`
    UPDATE orders SET status='closed', closed_at=datetime('now','localtime'),
    payment_method=?, total_paid=? WHERE id=?
  `).run(method, total, req.params.id);
  db.prepare("UPDATE tables SET status='libre' WHERE id=?").run(order.table_id);

  req.app.get('io').emit('tables:refresh');
  req.app.get('io').emit('kitchen:refresh');
  res.json({ ok: true, total, cambio, items });
});

// Transfer order to another table
router.post('/:id/transfer', (req, res) => {
  const { target_table_id } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Comanda no encontrada' });

  const targetOpen = db.prepare("SELECT * FROM orders WHERE table_id=? AND status='open'").get(target_table_id);
  if (targetOpen) return res.status(400).json({ error: 'La mesa destino ya tiene una comanda abierta' });

  db.prepare('UPDATE orders SET table_id=? WHERE id=?').run(target_table_id, req.params.id);
  db.prepare("UPDATE tables SET status='libre' WHERE id=?").run(order.table_id);
  db.prepare("UPDATE tables SET status='ocupada' WHERE id=?").run(target_table_id);

  req.app.get('io').emit('tables:refresh');
  res.json({ ok: true });
});

module.exports = router;
