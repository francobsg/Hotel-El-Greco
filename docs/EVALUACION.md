# Guía de evaluación

## Inicio

1. Instalar Node.js 24 LTS, disponer de un servidor PostgreSQL y descomprimir el código.
2. Ejecutar `npm ci` en la carpeta que contiene `package.json`.
3. Crear una base vacía en PostgreSQL y configurar `.env.local` con su `DATABASE_URL`, `AUTH_SECRET` y `SEED_PASSWORD`.
4. Ejecutar `npm run db:seed` una vez para cargar datos de demostración en la base vacía. Este paso es opcional.
5. Ejecutar `npm run dev`. Las migraciones se aplican automáticamente antes de iniciar la web.
6. Abrir http://127.0.0.1:3000/login e ingresar con la cuenta principal de prueba si se cargó el seed.

El código fuente contiene el esquema y las migraciones, no una base PostgreSQL ni credenciales. PostgreSQL conserva los datos en el servidor configurado. No ejecutes el seed sobre una base con datos reales.

## Recorrido funcional

| Módulo | Verificación sugerida |
| --- | --- |
| Panel | KPIs, últimos movimientos, alertas, filtros y cuatro gráficos de stock de cocina. |
| Inventario | Cambiar entre Global/Bodega 1/Bodega 2, buscar, paginar y abrir el detalle de un producto. |
| Guías | Registrar una entrada con factura y varios ítems; comprobar incremento de Bodega 1. |
| Traspaso | Mover una cantidad disponible de Bodega 1 a Bodega 2 y comprobar ambos movimientos. |
| Stock | Intentar un consumo mayor al disponible y verificar que se rechaza sin escrituras parciales. |
| Historial | Filtrar por folio, consultar detalle, imprimir y descargar la lista Excel. |
| Escáner | Seleccionar una imagen y analizar. Sin API key se muestran datos de ejemplo; elegir productos, revisar y confirmar antes de guardar. |
| Caja | Agregar platillos, revisar y confirmar; verificar guía provisional, descuento de ingredientes y resumen del día. Si faltan ingredientes, abastecer cocina mediante una guía. |
| Reportes | Descargar los dos Excel del mes actual y comprobar stock inicial + entradas − salidas = final. |
| Estadísticas | Elegir período, bodega y unidad; consultar consumo, uso de productos, rotación y movimientos semanales. |
| Estimación | Consultar consumo diario, días restantes y reposición sugerida. No genera compras automáticamente. |
| Configuración | Editar umbrales, crear una categoría, un platillo y sus ingredientes de receta; verificar que editar niveles no cambia el stock. |
| Usuarios | Crear cuentas con rol admin/trabajador y comprobar sus restricciones. |

Para probar caja, cada ingrediente de la receta debe tener stock en Bodega 2. Los productos de recetas usan kg/lt y las cantidades se expresan en gramos/ml enteros. Productos en unidades/cajas requieren una equivalencia que aún no está definida.

Admin puede consultar pero no registrar, editar ni eliminar. Trabajador se limita a guías, escáner y caja, sin ajustes de superadmin ni acceso al historial general. No se puede eliminar la propia cuenta ni el último superadmin activo.

## Pruebas automatizadas

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

Las pruebas utilizan bases efímeras y proveedores simulados; no alteran la base de demostración ni realizan llamadas OpenAI. En Windows el flujo de navegador utiliza Edge instalado; en otros sistemas instalar Chromium con `npx playwright install chromium`.

Se comprueban transacciones, saldos, reintentos, permisos vigentes, RLS, guías, facturas privadas, reportes Excel, estadísticas, configuración y la matriz de 360/768/1280 px. Las capturas de prueba se generan en `test-results`, excluido del repositorio.

## Alcance pendiente

- El resumen de caja diario permanece en desarrollo, con carga deshabilitada y sin importación ni conciliación.
- La predicción es una estimación por promedio móvil de treinta días, no un pronóstico externo.
- El OCR real requiere una API key; el modo de demostración está indicado en pantalla.
- La PWA y las operaciones requieren conexión; no se registran ventas sin red.
- Cámara e instalación física deben probarse en un dispositivo con contexto seguro (HTTPS).
