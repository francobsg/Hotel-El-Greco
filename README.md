# Inventario — Hotel Museo El Greco

Aplicación web responsiva para controlar las existencias de una bodega principal y una bodega de cocina. Incluye usuarios y permisos, guías, historial, caja de platillos, reportes mensuales, estadísticas y estimaciones de reposición. Interfaz en español de Chile.

## Funciones

- Inventario global o por bodega, búsquedas, paginación, alertas y exportación Excel.
- Entradas con factura, traspasos, consumos y ajustes. El stock se calcula desde movimientos; las guías no se editan ni eliminan.
- Registro transaccional que rechaza stock negativo y descuenta ingredientes de cocina según recetas.
- Cámara con lectura OCR opcional y revisión humana obligatoria. Sin clave del proveedor se usan datos de demostración identificados como tales.
- Caja con pedidos confirmados, ventas provisionales, resumen diario e ingredientes utilizados.
- Reportes mensuales independientes por bodega con hojas de movimientos y resumen de stock.
- Estadísticas por período y unidad. Reposición estimada mediante promedio móvil de consumo, sin servicio externo.
- Configuración de niveles, categorías, platillos y recetas; administración de usuarios.
- PWA instalable con manifest e íconos. Las operaciones requieren conexión.

**Ventas diarias está en desarrollo:** el apartado es visible, pero la carga de resumen y la conciliación permanecen deshabilitadas. No se implementa un parser de archivos.

## Tecnología

Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, Zod, Recharts y ExcelJS. Autenticación por contraseña bcrypt y sesiones HttpOnly. En despliegue se utiliza PostgreSQL/Supabase y almacenamiento privado Supabase Storage.

## Requisitos

Node.js 24 LTS con npm. Para producción: PostgreSQL 15 o superior o un proyecto Supabase. Para evaluar localmente se incluye PostgreSQL embebido, sin instalación adicional de un servicio de base de datos.

## Evaluación local

```powershell
npm ci
npm run db:local
```

Mantén esa terminal abierta. En otra terminal de la misma carpeta:

```powershell
npm run dev -- --hostname 127.0.0.1
```

Abre http://127.0.0.1:3000/login. **No copies `.env.example` para este modo:** `db:local` crea `.env.local` únicamente si no existe, genera secretos y carga una base de prueba vacía. Mantiene los datos en `.data/postgres-local` al reiniciar. La cuenta principal es `admin@hotelgreco.cl` y su contraseña inicial queda en `SEED_PASSWORD` del archivo privado `.env.local`.

Si recibiste un acceso privado para la evaluación, sigue sus instrucciones **antes del primer `db:local`** para utilizar esa contraseña. El proyecto publicado no contiene credenciales. El comando no sobrescribe un entorno existente ni cambia claves al reiniciar. Escucha solo en 127.0.0.1:55432, exige `DATABASE_POOL_MAX=1` y es exclusivamente para desarrollo local.

El seed incorpora tres roles de prueba, dos bodegas, doce categorías, sesenta productos, ocho platillos con recetas y sesenta días de movimientos. No modifica una base que ya tiene datos.

## Roles

| Rol | Alcance |
| --- | --- |
| Superadmin | Todas las consultas y operaciones del sistema. |
| Admin | Consulta de panel, inventario, historial, reportes, estadísticas, estimación, configuración, usuarios y ventas diarias. Sin mutaciones. |
| Trabajador | Utilidades de guías, escáner y caja; consulta únicamente sus guías y fotos. En móvil el menú muestra el escáner. |

Los permisos se validan en servidor y en las transacciones. El proxy también bloquea las mutaciones del admin y las rutas ajenas al trabajador. La aplicación no usa Supabase Auth: mantiene sus propias sesiones y consulta PostgreSQL desde el servidor.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` | Compilación de producción. |
| `npm start` | Servidor de producción local, después del build. |
| `npm run db:local` | Base persistente de evaluación local. |
| `npm run db:generate` | Generar migraciones tras modificar el esquema. |
| `npm run db:migrate` | Aplicar migraciones a la conexión configurada. |
| `npm run db:seed` | Cargar datos de prueba en una base vacía. |
| `npm run lint` | ESLint sin advertencias. |
| `npx tsc --noEmit` | Comprobación de tipos. |
| `npm test` | Pruebas automatizadas de servicios, stock, permisos y reportes. |
| `npm run test:e2e` | Flujo en navegador con una base efímera; requiere build previo. |

## Documentación

- [Despliegue y variables de entorno](docs/GUIA_HOSTING.md).
- [Recorrido de evaluación y pruebas](docs/EVALUACION.md).
- [Diseño visual](docs/DISENO.md).

## Publicación del código

Descomprime el paquete y publica **el contenido de esta carpeta** como raíz del repositorio. No publiques archivos privados de acceso, `.env.local`, `.data`, fotos subidas, `node_modules` ni `.next`. El archivo `.gitignore` contempla estas exclusiones. Conserva `package-lock.json` y las migraciones con sus snapshots.

Para usar una base real y desplegar la aplicación sigue la guía de hosting. Las credenciales de evaluación no deben reutilizarse en una instalación pública.
