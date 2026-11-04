# Hosting con GitHub, Vercel y Supabase

## 1. Publicar el código en GitHub

Descomprimir el ZIP y usar la carpeta que contiene `package.json` como raíz del repositorio. Crear un repositorio en GitHub y publicar el código mediante GitHub Desktop o Git. No subir solamente el ZIP como un archivo: Vercel necesita el proyecto descomprimido.

Ejemplo con Git instalado:

```powershell
git init
git add .
git commit -m "Entrega del sistema de inventario"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
git push -u origin main
```

Antes del commit revisar `git status`. No publicar el TXT privado del profesor, `.env.local`, `.data`, fotos subidas, dependencias ni compilaciones. El archivo de acceso se entrega por un canal privado y por separado del repositorio.

## 2. Crear PostgreSQL en Supabase

Crear un proyecto Supabase y guardar su contraseña de base de datos. En **Connect**, copiar una conexión directa o del pooler en modo sesión para ejecutar migraciones. Para el runtime serverless de Vercel usar el pooler en modo transacción. El cliente de este proyecto ya tiene `prepare: false`, compatible con ese modo. [Conexiones oficiales de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

Usar una cuenta PostgreSQL propietaria de las tablas o con BYPASSRLS, solo en el servidor. Las migraciones activan RLS sin políticas para el navegador y revocan acceso de los roles anon/authenticated a las tablas de negocio; la vista de stock respeta RLS. La aplicación utiliza autenticación propia, no Supabase Auth.

En la copia local destinada al despliegue, crear `.env.local` desde `.env.example` y completar las variables. Si se utilizó antes la base embebida, conservar esa configuración por separado y sustituirla por la conexión Supabase de destino. No ejecutar `db:local` para producción.

Generar un secreto de sesión aleatorio:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copiar el resultado en AUTH_SECRET. Usar una contraseña inicial nueva en SEED_PASSWORD para cualquier instalación pública.

```powershell
npm ci
npm run db:migrate
```

Para una base vacía de evaluación con datos de ejemplo:

```powershell
npm run db:seed
```

El seed no elimina datos ni sobrescribe cuentas. Crea `admin@hotelgreco.cl`, `admin.prueba@hotelgreco.cl` y `trabajador.prueba@hotelgreco.cl` con la contraseña indicada en SEED_PASSWORD. Para una instalación pública, cambiar las claves y desactivar las cuentas de prueba que no se utilizarán. No ejecutar el seed sobre una base con datos reales.

## 3. Preparar Storage privado

Crear un bucket privado llamado `facturas`, o definir otro nombre en SUPABASE_STORAGE_BUCKET. Configurarlo para imágenes JPEG. Guardar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para el servidor. No crear políticas públicas de acceso a las fotografías ni publicar service_role en el cliente.

Las fotos manuales y del escáner utilizan el bucket y se sirven mediante rutas autenticadas de la aplicación. Vercel debe usar Storage; el almacenamiento local de desarrollo no es persistente en ese entorno. [Buckets privados de Supabase](https://supabase.com/docs/guides/storage/buckets/fundamentals).

## 4. Importar en Vercel

1. Importar el repositorio desde GitHub.
2. Seleccionar el preset **Next.js** y Node.js **24 LTS**.
3. Usar `npm run build` como comando de build. La raíz debe ser la carpeta de `package.json`.
4. Configurar las variables siguientes en el entorno de Production. Usar valores y bases separados para Preview si se habilita ese entorno.

| Variable | Configuración |
| --- | --- |
| DATABASE_URL | URI del pooler de transacción Supabase, copiada desde Connect. |
| DATABASE_POOL_MAX | Pool pequeño por proceso; comenzar con 1–3 según capacidad del proyecto. |
| AUTH_SECRET | Secreto aleatorio de al menos 32 caracteres. |
| SUPABASE_URL | URL del proyecto Supabase. |
| SUPABASE_SERVICE_ROLE_KEY | Clave privada del servidor para Storage. |
| SUPABASE_STORAGE_BUCKET | `facturas` o el bucket privado elegido. |
| OPENAI_API_KEY | Opcional. Sin clave hay OCR de demostración con aviso visible. |
| OPENAI_OCR_MODEL | Opcional; predeterminado `gpt-4.1-mini`. |

No poner prefijo NEXT_PUBLIC a conexión, secretos o service_role. SEED_PASSWORD solo se necesita durante la creación inicial de datos por CLI, no para ejecutar la web. No configurar FACTURAS_DIR ni ESCANER_UPLOADS_DIR en Vercel: deben utilizarse las credenciales de Storage.

Las variables deben estar en el entorno que se está desplegando. Tras cambiarlas, realizar un nuevo deployment. [Variables de entorno de Vercel](https://vercel.com/docs/environment-variables).

## 5. Validar el sitio

Después del deploy, abrir la URL HTTPS y comprobar:

- Login con el superadmin inicial y navegación al panel.
- Consulta de inventario, descarga de reportes y una guía con foto privada.
- Venta de caja y descuento de Bodega 2 cuando haya ingredientes disponibles.
- Admin sin mutaciones y trabajador limitado a sus utilidades.
- Fotos inaccesibles sin sesión y aviso de demostración si no hay API key.
- Cámara e instalación PWA desde un teléfono con HTTPS.

Las rutas de OCR y reportes declaran duración máxima de 90 segundos; comprobar que el plan y la configuración del hosting lo admiten. Vercel limita los cuerpos de funciones a 4,5 MB. Las imágenes se comprimen en cliente hasta 3 MB para dejar margen a multipart. Excel se genera en memoria: volúmenes excepcionales requieren una exportación por trabajo y descarga desde almacenamiento. [Límites oficiales de Vercel](https://vercel.com/docs/functions/limitations).

## Mantenimiento

Conservar y aplicar las migraciones versionadas antes de actualizar el código. Ejecutarlas desde una terminal o CI con conexión directa/sesión, sin mezclarlas con el arranque de cada función web. Mantener copias de seguridad de PostgreSQL y Storage según el entorno elegido.

El resumen diario de caja sigue deshabilitado hasta definir su formato y conciliación. La estimación de reposición no modifica stock ni registra compras. El acceso privado entregado para evaluar localmente no es una credencial productiva.
