# La Bótica — TPV Bar

Sistema de comandas y punto de venta para bar/restaurante.

## Pantallas

| Vista | Descripción |
|-------|-------------|
| **Login** | Selección de empleado + PIN de 4 dígitos |
| **Mapa** | Vista de mesas por zonas (Interior / Terraza / Barra) con estado en tiempo real |
| **Comanda** | Toma de pedidos por mesa: categorías, grid de productos, búsqueda, envío a cocina |
| **Cocina** | Display de pedidos pendientes con cambio de estado (Pendiente → Preparando → Listo) |

## Funcionalidades

- Login con PIN por empleado
- Vista de mesas con colores por estado (libre / ocupada / alerta / cobrar)
- Comanda por mesa: añadir/eliminar artículos, enviar a cocina
- Búsqueda de productos en tiempo real
- Cobro: efectivo (con cálculo de cambio), tarjeta, Bizum, invitación
- División de cuenta (cobro parcial de artículos)
- Traslado de comanda entre mesas
- Vista de cocina con estados (enviado / preparando / listo)
- Tiempo real vía Socket.io
- Tarifa día / noche automática

## Arrancar

Una sola orden — el servidor sirve también el cliente:

```bash
cd server
npm install
npm start
```

Abre **http://localhost:3001** en el navegador. La base de datos SQLite se crea y rellena con datos de ejemplo automáticamente.

## Estados de mesa (automáticos)

| Estado | Color | Significado |
|--------|-------|-------------|
| Libre | gris | Sin comanda abierta |
| Ocupada | dorado | Comanda en curso |
| Alerta | naranja | Cocina tiene comida lista por servir |
| Cobrar | verde | Todo servido, pendiente de cobro |

## Tarifa noche

De **21:00 a 06:00** las bebidas alcohólicas aplican un recargo automático (precio noche). El TPV muestra la tarifa activa y marca con 🌙 los productos con precio nocturno.

## Empleados demo

| Empleado | PIN |
|----------|-----|
| Tere (Encargada) | 1234 |
| Carlos (Camarero) | 2580 |
| Ana (Camarera) | 1379 |
| Javi (Cocina) | 9080 |