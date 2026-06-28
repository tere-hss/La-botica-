const express = require('express');
const db = require('../database');
const router = express.Router();

router.get('/employees', (req, res) => {
  res.json(db.prepare('SELECT id,name,role,color,initial FROM employees ORDER BY id').all());
});

router.post('/login', (req, res) => {
  const { employee_id, pin } = req.body;
  const emp = db.prepare('SELECT * FROM employees WHERE id = ? AND pin = ?').get(employee_id, String(pin));
  if (!emp) return res.status(401).json({ error: 'PIN incorrecto' });
  const { pin: _, ...safe } = emp;
  res.json({ ok: true, employee: safe });
});

module.exports = router;
