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

## Cloudinary
- Crea un preset sin firma en Cloudinary y coloca `VITE_CLOUDINARY_CLOUD_NAME` y `VITE_CLOUDINARY_UPLOAD_PRESET` en tu `.env`.
- Activa la opcion **Return delete token** en ese preset para que los barberos puedan borrar fotos desde la app.
- Cada carga se guarda en la carpeta `clientes/<ID>` para mantener ordenadas las imagenes por cliente.
- Si las variables no estan definidas, la app usa imagenes de prueba para que el flujo siga funcionando en modo demo.
