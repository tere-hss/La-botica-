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

```bash
# Terminal 1 — Backend
cd server
npm install
npm start

# Terminal 2 — Frontend
cd client
npx serve .
```

El backend corre en `http://localhost:3001` y crea la base de datos SQLite automáticamente.

## Empleados demo

| Empleado | PIN |
|----------|-----|
| Tere (Encargada) | 1234 |
| Carlos (Camarero) | 2580 |
| Ana (Camarera) | 1379 |
| Javi (Cocina) | 9080 |