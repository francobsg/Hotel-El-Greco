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
- Alertas de stock con opción para ignorarlas temporalmente y abrir un ajuste positivo precargado para resolverlas.
- Configuración de niveles, categorías, platillos y recetas; administración de usuarios.
- PWA instalable con manifest e íconos. Las operaciones requieren conexión.

**Ventas diarias está en desarrollo:** el apartado es visible, pero la carga de resumen y la conciliación permanecen deshabilitadas. No se implementa un parser de archivos.

## Tecnología

Next.js App Router, React, TypeScript, Tailwind CSS, PostgreSQL, Drizzle ORM, Zod, Recharts y ExcelJS. La aplicación se conecta directamente a PostgreSQL mediante Postgres.js y Drizzle; `db/schema.ts` y `db/migrations` contienen la definición versionada del esquema, no una base SQLite. Autenticación por contraseña bcrypt y sesiones HttpOnly. En despliegue se utiliza PostgreSQL/Supabase y almacenamiento privado Supabase Storage.

## Requisitos

Node.js 24 LTS con npm y un servidor PostgreSQL 15 o superior (local o alojado). La base PostgreSQL debe existir y estar disponible; al iniciar la web, las migraciones crean o actualizan automáticamente sus tablas, índices, secuencias y demás objetos del esquema. En Vercel, el archivo `vercel.json` aplica las migraciones durante el build, antes de publicar la web.

## Ejecución local con PostgreSQL

```powershell
npm ci
```

Configura `.env.local` con la URI de una base PostgreSQL vacía (puedes partir de `.env.example`) y completa `AUTH_SECRET` y `SEED_PASSWORD`. La base y el servidor PostgreSQL deben estar creados y en ejecución antes de iniciar la aplicación. Luego:

```powershell
npm run db:seed
npm run dev
```

`npm run dev` aplica las migraciones automáticamente antes de iniciar Next.js; no hace falta ejecutar `db:migrate` a mano. `db:seed` es opcional y solo debe usarse una vez en una base vacía para crear las cuentas y datos de demostración. La cuenta principal es `admin@hotelgreco.cl`; su contraseña es el valor de `SEED_PASSWORD`. El seed rechaza bases que ya tengan datos y no sobrescribe cuentas existentes.

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
| `npm run build` | Compilación de producción. En Vercel, `vercel.json` aplica antes las migraciones. |
| `npm start` | Aplica las migraciones y levanta el servidor de producción local, después del build. |
| `npm run db:generate` | Generar migraciones tras modificar el esquema. |
| `npm run db:migrate` | Aplicar manualmente las migraciones a la conexión configurada. También se ejecuta automáticamente con `npm run dev` y `npm start`. |
| `npm run db:seed` | Aplicar primero las migraciones y cargar datos de prueba en una base vacía. |
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
