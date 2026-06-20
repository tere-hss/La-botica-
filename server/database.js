const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'botica.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    color TEXT NOT NULL,
    initial TEXT NOT NULL,
    pin TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id INTEGER REFERENCES zones(id),
    number INTEGER NOT NULL,
    label TEXT NOT NULL,
    x INTEGER DEFAULT 0,
    y INTEGER DEFAULT 0,
    capacity INTEGER DEFAULT 4,
    status TEXT DEFAULT 'libre' CHECK(status IN ('libre','ocupada','naranja','cobrar'))
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🍽️',
    sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES categories(id),
    name TEXT NOT NULL,
    price REAL NOT NULL,
    price_night REAL,
    emoji TEXT DEFAULT '',
    demand REAL DEFAULT 0,
    available INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER REFERENCES tables(id),
    employee_id INTEGER REFERENCES employees(id),
    status TEXT DEFAULT 'open' CHECK(status IN ('open','closed')),
    guests INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    closed_at TEXT,
    payment_method TEXT,
    total_paid REAL
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER DEFAULT 1,
    price REAL NOT NULL,
    notes TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending','sent','preparing','ready','delivered')),
    sent_at TEXT
  );
`);

// Seed only if empty
const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get();
if (empCount.c === 0) {
  // Employees
  const ie = db.prepare('INSERT INTO employees (name,role,color,initial,pin) VALUES (?,?,?,?,?)');
  ie.run('Tere',   'Encargada', '#d4a843', 'T', '1234');
  ie.run('Carlos', 'Camarero',  '#5b8ee6', 'C', '2580');
  ie.run('Ana',    'Camarera',  '#5bc47a', 'A', '1379');
  ie.run('Javi',   'Cocina',    '#e65b7a', 'J', '9080');

  // Zones
  const iz = db.prepare('INSERT INTO zones (name, sort_order) VALUES (?,?)');
  const intId  = iz.run('Interior', 1).lastInsertRowid;
  const terrId = iz.run('Terraza',  2).lastInsertRowid;
  const barId  = iz.run('Barra',    3).lastInsertRowid;

  // Tables — Interior
  const it = db.prepare('INSERT INTO tables (zone_id,number,label,x,y,capacity) VALUES (?,?,?,?,?,?)');
  it.run(intId,  1, '1',  60,  60, 4);
  it.run(intId,  2, '2', 200,  60, 4);
  it.run(intId,  3, '3', 340,  60, 4);
  it.run(intId,  4, '4', 480,  60, 4);
  it.run(intId,  5, '5',  60, 200, 6);
  it.run(intId,  6, '6', 220, 200, 6);
  it.run(intId,  7, '7', 380, 200, 6);
  it.run(intId,  8, '8', 540, 200, 4);
  // Tables — Terraza
  it.run(terrId,  9, '9',   60,  60, 4);
  it.run(terrId, 10, '10', 200,  60, 4);
  it.run(terrId, 11, '11', 340,  60, 4);
  it.run(terrId, 12, '12', 480,  60, 4);
  it.run(terrId, 13, '13',  60, 200, 4);
  it.run(terrId, 14, '14', 200, 200, 4);
  it.run(terrId, 15, '15', 340, 200, 4);
  // Tables — Barra (positions horizontally)
  for (let b = 1; b <= 8; b++) {
    it.run(barId, 100+b, `B${b}`, (b-1)*100+30, 60, 2);
  }

  // Categories
  const ic = db.prepare('INSERT INTO categories (name,emoji,sort_order) VALUES (?,?,?)');
  const catCerv = ic.run('Cañas y cervezas', '🍺', 1).lastInsertRowid;
  const catVino = ic.run('Vinos y copas',    '🍷', 2).lastInsertRowid;
  const catDest = ic.run('Destilados',        '🥃', 3).lastInsertRowid;
  const catCafe = ic.run('Cafés y tés',       '☕', 4).lastInsertRowid;
  const catRefi = ic.run('Refrescos y agua',  '🧃', 5).lastInsertRowid;
  const catTapa = ic.run('Tapas y raciones',  '🍖', 6).lastInsertRowid;
  const catBoca = ic.run('Bocadillos',        '🥪', 7).lastInsertRowid;
  const catPost = ic.run('Postres',           '🍮', 8).lastInsertRowid;

  // Products
  const ip = db.prepare('INSERT INTO products (category_id,name,price,emoji,demand) VALUES (?,?,?,?,?)');
  // Cañas
  ip.run(catCerv, 'Caña',            1.80, '🍺', 0.9);
  ip.run(catCerv, 'Media',           2.20, '🍺', 0.7);
  ip.run(catCerv, 'Botellín',        2.50, '🍺', 0.6);
  ip.run(catCerv, 'Estrella 1/3',    3.00, '🍺', 0.5);
  ip.run(catCerv, 'Clara limón',     2.00, '🍺', 0.4);
  ip.run(catCerv, 'Sin alcohol',     2.50, '🍺', 0.3);
  // Vinos
  ip.run(catVino, 'Copa tinto',      3.00, '🍷', 0.8);
  ip.run(catVino, 'Copa blanco',     3.00, '🍷', 0.5);
  ip.run(catVino, 'Copa cava',       4.00, '🥂', 0.4);
  ip.run(catVino, 'Botella tinto',  15.00, '🍷', 0.6);
  ip.run(catVino, 'Botella blanco', 14.00, '🍷', 0.4);
  // Destilados
  ip.run(catDest, 'Gin Tonic',       7.00, '🍸', 0.8);
  ip.run(catDest, 'Cubata',          6.50, '🥤', 0.6);
  ip.run(catDest, 'Whisky solo',     5.50, '🥃', 0.5);
  ip.run(catDest, 'Ron con Cola',    6.00, '🥤', 0.5);
  ip.run(catDest, 'Vodka limón',     6.00, '🍋', 0.4);
  ip.run(catDest, 'Vermut',          3.50, '🍸', 0.7);
  // Cafés
  ip.run(catCafe, 'Café solo',       1.50, '☕', 0.9);
  ip.run(catCafe, 'Café con leche',  1.80, '☕', 0.8);
  ip.run(catCafe, 'Cortado',         1.60, '☕', 0.7);
  ip.run(catCafe, 'Capuchino',       2.20, '☕', 0.5);
  ip.run(catCafe, 'Té',              2.00, '🍵', 0.4);
  ip.run(catCafe, 'Infusión',        2.00, '🌿', 0.3);
  ip.run(catCafe, 'Chocolate',       2.80, '🍫', 0.5);
  // Refrescos
  ip.run(catRefi, 'Agua sin gas',    1.50, '💧', 0.7);
  ip.run(catRefi, 'Agua con gas',    1.80, '💧', 0.4);
  ip.run(catRefi, 'Coca-Cola',       2.50, '🥤', 0.9);
  ip.run(catRefi, 'Fanta naranja',   2.50, '🍊', 0.6);
  ip.run(catRefi, 'Fanta limón',     2.50, '🍋', 0.5);
  ip.run(catRefi, 'Nestea',          2.50, '🧃', 0.4);
  ip.run(catRefi, 'Zumo naranja',    3.00, '🍊', 0.5);
  // Tapas
  ip.run(catTapa, 'Pincho tortilla',  2.50, '🍳', 0.9);
  ip.run(catTapa, 'Croquetas (6)',    8.00, '🔶', 0.8);
  ip.run(catTapa, 'Patatas bravas',   5.50, '🥔', 0.7);
  ip.run(catTapa, 'Tabla jamón',     18.00, '🐷', 0.6);
  ip.run(catTapa, 'Tabla quesos',    16.00, '🧀', 0.5);
  ip.run(catTapa, 'Pulpo a feira',   14.00, '🐙', 0.7);
  ip.run(catTapa, 'Gambas al ajillo',12.00, '🦐', 0.6);
  ip.run(catTapa, 'Boquerones',       8.00, '🐟', 0.5);
  ip.run(catTapa, 'Ensaladilla',      7.00, '🥗', 0.6);
  // Bocadillos
  ip.run(catBoca, 'Bocadillo jamón',  5.00, '🥖', 0.7);
  ip.run(catBoca, 'Bocadillo calamares', 5.50, '🥖', 0.6);
  ip.run(catBoca, 'Montadito anchoa', 2.50, '🍞', 0.5);
  ip.run(catBoca, 'Montadito salmón', 2.80, '🍞', 0.5);
  ip.run(catBoca, 'Tosta aguacate',   6.00, '🥑', 0.4);
  // Postres
  ip.run(catPost, 'Flan casero',      3.50, '🍮', 0.6);
  ip.run(catPost, 'Tarta del día',    4.00, '🎂', 0.7);
  ip.run(catPost, 'Coulant choco',    5.00, '🍫', 0.5);
  ip.run(catPost, 'Helado',           3.00, '🍨', 0.4);
}

module.exports = db;
