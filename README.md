# Barbería – PRO (React + Vite + Tailwind + Firebase + Cloudinary)

Incluye:
- Admin de usuarios (cambio de roles).
- Listado de clientes con **búsqueda avanzada + paginación**.
- Estilos ajustados a tus **mockups** (listado oscuro y detalle crema).

## Paso extra para búsqueda por prefijo
Agrega el campo `fullName_lower` (en minúsculas) a cada cliente. Ejemplo:
```json
{ "fullName": "Juan Pérez", "fullName_lower": "juan pérez", "mainBarberId": "UID", "phone": "...", "notes": "" }
```
Así las consultas `>=` y `<=` funcionan rápido en Firestore.

## Scripts
```bash
npm install
npm run dev
```

## Rutas
- `/clientes` (listado)
- `/clientes/:id` (detalle)
- `/admin/usuarios` (roles)
- `/login`
