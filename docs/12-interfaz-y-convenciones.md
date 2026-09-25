# 12 · Interfaz y convenciones

Frontend Angular 21 (componentes standalone + signals), PrimeNG 21 (tema Aura) y Tailwind 4 (`tailwindcss-primeui`). Este documento fija cómo está armada la interfaz y las reglas que toda pantalla debe seguir.

## Estructura

```
frontend/src/app/
  app.ts / app.html      raíz: toast, confirmación, modal de contraseña, preloader y layout
  app.config.ts          router, HttpClient + interceptores, PrimeNG, inicialización de sesión
  app.routes.ts          rutas (todas con carga diferida)
  core/
    envelope.model.ts    tipos ResponseEnvelope y PaginationBlock (mismo contrato que la API)
    guards/              authGuard, permisoGuard
    interceptors/        api-base-url, auth, timeout
    services/            auth, permisos, toast, loading, confirm, cambiar-password-ui, layout
    utils/               jerarquía de roles, motor, portapapeles, recarga de versión, sentencia, texto
    validators/          password-strength (política de contraseña)
  features/              una carpeta por pantalla (auth/login, auth/recuperar-password, home,
                         roles, permisos, usuarios, novedades, configuracion, soporte, informes, menu)
  shared/                nav-bar, footer, alerta-resultado, cambiar-password-modal,
                         password-fortaleza, pipes/vacio, directives/tabla-responsiva
```

- `core/` = lógica transversal sin vista (servicios `providedIn: 'root'`, guards, interceptores, utilidades puras).
- `features/` = pantallas; cada una trae su `.ts` + `.html` y define sus interfaces locales.
- `shared/` = componentes y pipes reutilizables sin estado de negocio.

## Rutas y guards

`frontend/src/app/app.routes.ts`. Todas usan `loadComponent` (un chunk por pantalla).

| Ruta | Pantalla | Guards |
|---|---|---|
| `/login` | Login | — |
| `/recuperar-password` | Recuperar contraseña | — |
| `/` | Inicio | `authGuard` |
| `/roles` | Roles | `authGuard`, `permisoGuard('Roles')` |
| `/permisos` | Permisos | `authGuard`, `permisoGuard('Permisos')` |
| `/usuarios` | Usuarios | `authGuard`, `permisoGuard('Usuarios')` |
| `/novedades` | Novedades | `authGuard`, `permisoGuard('Novedades')` |
| `/configuracion` | Configuración | `authGuard`, `permisoGuard('Configuración')` |
| `/soporte` | Soporte | `authGuard`, `permisoGuard('Soporte')` |
| `/informes` | Informes | `authGuard`, `permisoGuard('Informe')` |
| `/menu` | Menú | `authGuard`, `permisoGuard('Menu')` |
| `**` | — | redirige a `/` |

| Guard | Archivo | Regla |
|---|---|---|
| `authGuard` | `core/guards/auth.guard.ts` | Hay access token → pasa; si no → `/login` |
| `permisoGuard(modulo, accion = 'Consultar')` | `core/guards/permiso.guard.ts` | Espera la carga de `mis-permisos` en curso y exige la acción sobre el módulo; si no → `/` |

Reglas:

- El nombre del módulo del guard debe ser **idéntico** al campo `menu` de la opción de menú y del permiso (`Informe`, `Menu`, `Configuración`, con tilde).
- La `ruta` de una opción del módulo Menú debe existir en `app.routes.ts`; si no, el comodín `**` lleva al inicio. Una pantalla nueva requiere código (ruta + componente), no solo una fila en Menú.
- Los guards solo ocultan; quien hace cumplir los permisos es el backend ([05-permisos](05-permisos.md)).

### Arranque de la app

`provideAppInitializer` en `app.config.ts`, antes de la primera ruta:

1. `AuthService.validarSesionGuardada()`: si hay refresh token guardado, lo renueva; si falla, limpia la sesión local.
2. `PermisosService.esperarCarga()`: espera `GET /api/permisos/mis-permisos` para que los guards decidan con datos reales.

## Layout

`app.html`:

| Elemento | Siempre | Detalle |
|---|---|---|
| `<p-toast />` | Sí | Avisos (`ToastService`). En móvil (< 640px) ocupa el ancho de la pantalla menos 1rem por lado |
| `<p-confirmdialog styleClass="confirmar-eliminar" />` | Sí | Confirmación de eliminar (`ConfirmService`). En móvil, 92vw |
| `<app-cambiar-password-modal />` | Sí | Se muestra solo cuando corresponde |
| Preloader | Si `LoadingService.visible()` | Overlay `fixed inset-0 z-[1100]`, spinner y mensaje |
| `app-nav-bar` + `main` + `app-footer` | Con sesión y sin cambio de contraseña pendiente | Barra lateral (ver abajo), contenido con scroll propio (`min-w-0`, para que nada ensanche la página), pie abajo |
| Barra superior con hamburguesa | Con sesión, solo < 1024px (`lg:hidden`) | Botón ☰ (abre el menú), ícono de la app y "SCP"; fija arriba al hacer scroll |
| `router-outlet` solo | Sin sesión o con `debeCambiarPassword` | Login, recuperar contraseña, o inicio con el modal obligatorio encima |

### Barra lateral (`shared/nav-bar`)

Se comporta según el ancho (estado en `core/services/layout.service.ts`, `LayoutService`):

| Pantalla | Comportamiento |
|---|---|
| PC (≥ 1024px, `lg`) | Fija a la izquierda. **Desplegada** (`w-64`): saludo y rol arriba con el botón `«` para contraerla. **Contraída** (`w-20`): solo íconos; arriba, el ícono de la app (el del favicon) la vuelve a desplegar; cada ícono muestra su nombre en tooltip y los apartados se separan con una línea. El estado se recuerda en el navegador (`localStorage`, clave `scp.menuColapsado`) |
| Tablet y móvil (< 1024px) | Oculta. La hamburguesa de la barra superior la abre como panel (`w-72`, máx. 85% del ancho) sobre el contenido con fondo oscurecido, siempre con nombres. Se cierra con la ✕, tocando fuera, con Escape o al navegar. Si la ventana pasa a PC con el panel abierto, se cierra |

- Accesibilidad: los botones de abrir (hamburguesa) y de contraer/expandir llevan `aria-label`, `aria-controls="menu-lateral"` y `aria-expanded`; el de cerrar (✕) solo `aria-label`; en modo contraído las opciones llevan `aria-label` con su nombre.
- Arriba: saludo `Hola, {primerNombre}` y el rol.
- Centro: opciones de `GET /api/menu/activos`, agrupadas por `apartado` en el orden recibido (`orden` ascendente). Solo aparece una opción si el rol tiene **Consultar** sobre su `menu`. Ícono = clase PrimeIcons del campo `icono`; la activa se resalta con `routerLinkActive`.
- Abajo: botón **Ayuda** (diálogo con los canales de soporte, definidos en `nav-bar.component.html`) y botón con el nombre del usuario que abre un menú: **Actualizar contraseña** (abre el modal) y **Cerrar sesión**.
- Si falla la carga del menú, la barra queda sin opciones (sin aviso).

### Pie (`shared/footer`)

Texto de derechos de autor con el año actual, fondo oscuro fijo (`#0d1829`).

### Inicio (`features/home`)

Solo título y descripción del sistema; el saludo y el menú viven en la barra lateral.

## Componentes compartidos

| Componente | Selector | Entradas / salidas | Uso |
|---|---|---|---|
| `AlertaResultadoComponent` | `app-alerta-resultado` | `tipo` (`exito` \| `error` \| `advertencia` \| `info`, obligatorio), `mensaje`, `copiable` (bool), `(copiar)` emite el mensaje | Resultado de una acción (Soporte) |
| `CambiarPasswordModalComponent` | `app-cambiar-password-modal` | — (lee `AuthService` y `CambiarPasswordUiService`) | Cambio de contraseña obligatorio o voluntario |
| `PasswordFortalezaComponent` | `app-password-fortaleza` | `valor` | Medidor y checklist bajo todo campo de contraseña nueva |
| `NavBarComponent` / `FooterComponent` | `app-nav-bar` / `app-footer` | — | Layout |
| `TablaResponsivaDirective` | `p-table[appTablaResponsiva]` | — | En móvil muestra cada fila como tarjeta (ver [Tablas](#tablas)) |
| `VacioPipe` | `vacio` | — | Celdas vacías como `---` |

### `app-alerta-resultado`

- **Fondo sólido del color del tipo** y contenido claro encima (ícono, título y detalle en blanco), para que el mensaje se distinga de la pantalla. Igual en tema claro y oscuro.
- Si el mensaje tiene varias líneas (`\n`), la **primera se muestra como título** en negrita y el resto como detalle (`whitespace-pre-line`). Los mensajes del backend ya vienen así (ej. reglas de la sentencia).
- Con `copiable`, botón **Copiar** arriba a la derecha: texto blanco, fondo y borde en un tono más claro del color del tipo (más claro aún al pasar el mouse). El componente no copia: emite `copiar` y la pantalla decide qué hacer.

| Tipo | Uso | Ícono | Fondo |
|---|---|---|---|
| `exito` | Operación correcta | `pi-check-circle` | verde (`bg-green-600`) |
| `error` | Falló | `pi-times-circle` | rojo (`bg-red-600`) |
| `advertencia` | Hay que corregir algo (ej. sentencia no permitida) | `pi-exclamation-triangle` | amarillo (`bg-yellow-600`) |
| `info` | Aviso informativo | `pi-info-circle` | azul (`bg-blue-600`) |

### `app-cambiar-password-modal`

| Modo | Cuándo | Se puede cerrar |
|---|---|---|
| Forzado | `usuario.debeCambiarPassword === true` (primer ingreso o tras restablecer) | No (sin X, sin Esc, sin clic fuera) |
| Voluntario | Barra lateral → Actualizar contraseña (`CambiarPasswordUiService.abrir()`) | Sí; al cerrar se limpia el formulario |

Campos: contraseña actual (obligatoria), nueva (política segura + medidor), confirmar (debe coincidir; se valida cuando ya tiene valor), secreto de recuperación (3–45). El botón Guardar se deshabilita mientras el formulario es inválido **o hay un envío en curso** (`enviando`). Al guardar: `POST /api/auth/cambiar-password`, luego refresh para obtener un token sin la marca de cambio pendiente ([03-autenticacion-y-sesion](03-autenticacion-y-sesion.md)).

### `app-password-fortaleza`

Tres segmentos y etiqueta, más la lista de requisitos con check verde cuando se cumplen. Política en `core/validators/password-strength.ts` (misma que `backend/src/common/validators/password-segura.ts`):

| Requisito | Regla |
|---|---|
| Longitud | ≥ 8 |
| Mayúscula / minúscula | `\p{Lu}` / `\p{Ll}` |
| Número | `\p{N}` |
| Carácter especial | cualquier cosa que no sea letra, número ni espacio |

| Nivel | Requisitos cumplidos | Color |
|---|---|---|
| Débil | 0–2 | rojo |
| Media | 3–4 | ámbar |
| Fuerte | 5 (única aceptada por `passwordSeguraValidator`) | verde |

### Pipe `vacio`

`shared/pipes/vacio.pipe.ts`. `null`, `undefined`, `''` o solo espacios → `---` (`TEXTO_VACIO`). `0` y `false` se muestran tal cual. En fechas se encadena después del `date`: `(fecha | date: 'short') | vacio`. El Excel de Informes aplica la misma regla en el backend.

## Servicios de `core/services`

| Servicio | Responsabilidad | API |
|---|---|---|
| `AuthService` | Login, tokens en `localStorage` (`scp_access_token`, `scp_refresh_token`, `scp_usuario`), renovación cada 14 min y al volver a la pestaña, sincronización entre pestañas (evento `storage` + Web Locks), logout | `login`, `refresh`, `logout`, `cambiarPassword`, `recuperarPassword`, `usuario()` (signal), `isAuthenticated()` |
| `PermisosService` | Permisos del rol (`GET /api/permisos/mis-permisos`) | `cargar()`, `esperarCarga()`, `tiene(menu, accion)`, `limpiar()` |
| `ToastService` | Avisos flotantes (envuelve `MessageService`) | `success` (título "Éxito"), `error` ("Error"), `warning` ("Atención"), `info` ("Información") |
| `LoadingService` | Preloader global con mensaje | `show(mensaje)`, `hide()` |
| `ConfirmService` | Única confirmación del sistema: eliminar | `eliminar(): Promise<boolean>` |
| `CambiarPasswordUiService` | Abrir/cerrar el modal voluntario | `abrir()`, `cerrar()`, `abiertoManualmente` |
| `LayoutService` | Estado del menú lateral: escritorio o no (`BreakpointObserver`, `min-width: 1024px`), contraído (se recuerda en `localStorage`) y panel móvil abierto | `esEscritorio()`, `colapsado()`, `alternarColapsado()`, `menuMovilAbierto()`, `abrirMenuMovil()`, `cerrarMenuMovil()` |

Reglas de uso:

- Toda petición visible usa `loadingService.show('Cargando roles...')` / `hide()` en `finally`. No usar spinners locales ni `p-blockui` (puede quedar pegado si la animación CSS no se dispara).
- Los botones Crear/Editar/Eliminar de cada pantalla se muestran según `permisosService.tiene(MODULO, 'Crear' | 'Editar' | 'Eliminar')`, con `MODULO` constante en el componente.
- Los permisos se cargan al iniciar sesión y al recargar; un cambio de permisos se ve al volver a entrar o recargar.

## Utilidades y validadores

| Archivo | Exporta | Uso |
|---|---|---|
| `core/utils/texto.util.ts` | `capitalizarPalabras`, `capitalizarPrimeraLetra` | Mayúsculas en vivo en los inputs |
| `core/utils/portapapeles.util.ts` | `copiarTexto(texto): Promise<boolean>` | `navigator.clipboard` en contexto seguro; si no (HTTP por IP), `textarea` + `execCommand('copy')` |
| `core/utils/recarga-version.util.ts` | `recargarSiCambioLaVersion` | Handler de errores de navegación: si falla la carga de un chunk, recarga una vez (máx. una cada 10 s, marca en `sessionStorage`) |
| `core/utils/jerarquia-roles.util.ts` | `esSuperAdministrador`, `nivelRol`, `puedeGestionarRol`, `MENU_CONFIGURACION` | Ocultar acciones sobre roles/usuarios/permisos por encima del propio ([04-roles-y-jerarquia](04-roles-y-jerarquia.md)) |
| `core/utils/motor.util.ts` | `MOTORES`, `etiquetaMotor` | `mysql` → MySQL, `postgres` → PostgreSQL |
| `core/utils/limite-excedido.util.ts` | `esLimiteExcedido(error)` | ¿El error es un 429? Para mostrarlo como advertencia |
| `core/utils/sentencia.util.ts` | `validarSentenciaUpdate`, `separarSentencias`, `extraerBaseDeDatos`, `advertenciaSentencia`, `sentenciaSegunMotorValidator` | Adelanta en el formulario de Soporte la regla del backend (`common/sql/sentencia-update.util.ts`) |
| `core/validators/password-strength.ts` | `REQUISITOS_PASSWORD`, `nivelPassword`, `passwordSeguraValidator` | Política de contraseña |

## Formularios

Formularios reactivos (`FormBuilder.nonNullable`), en `p-dialog` modal para CRUD y en `p-card` para Login, Recuperar y Soporte.

### Validación y mensajes

- Las validaciones del formulario replican las del DTO del backend (longitudes, obligatorios, patrones); ver [14-api](14-api.md).
- Mensaje de error por campo con `<small class="text-red-500">`, visible cuando el campo está `touched` y tiene el error. Un solo mensaje a la vez (`@if / @else if`).
- Ayuda neutra con `<small class="text-surface-500">` (ej. formato del ícono, qué pasa con la contraseña temporal).
- `maxlength` en el HTML acompaña al `Validators.maxLength`.

Mensajes estándar:

| Error | Mensaje |
|---|---|
| `minlength` en descripción | `Mínimo 3 caracteres.` |
| `maxlength` | `Máximo N caracteres.` |
| `required` | `El … es obligatorio.` / `Ingresa …` |
| Teléfono | `Debe tener 10 dígitos (ej. 321 256 5689).` |
| Ruta de menú | `Ruta inválida, ej. /admin/roles.` |
| Contraseñas distintas | `Las contraseñas no coinciden.` |

### Botones

- **Guardar** (y Ingresar, Recuperar, Asignar, Registrar y ejecutar) `type="submit"`, ancho completo, `[disabled]="form.invalid"`. Solo el modal de contraseña suma `|| enviando()`; en el resto el preloader bloquea el doble clic.
- `guardar()` repite la comprobación: si es inválido, `markAllAsTouched()` y no envía.
- **Nuevo / Nueva** arriba a la derecha (`pi pi-plus`), solo con permiso Crear.
- Acciones de fila: íconos de texto (`[text]="true"`) alineados a la derecha — editar `pi-pencil` `secondary`, eliminar `pi-trash` `danger`, restablecer contraseña `pi-key` `warn` (Usuarios).
- Exportar a Excel: `pi-file-excel`, `success`.

### Estado y alta/edición

- **Estado** (Activo/Inactivo) solo aparece al **editar**; al crear, el registro nace activo y no se envía `estadoRegistro`.
- Descripción vacía se envía como `undefined` (no se toca en el backend).
- Actualizar **no** pide confirmación.
- **Eliminar sí:** `ConfirmService.eliminar()` → diálogo amarillo completo (`.confirmar-eliminar` en `styles.scss`: fondo, borde de 2 px, texto e ícono), mensaje `¿Estás seguro de querer eliminar este registro?`, botón **No** verde (`success`) y **Sí** rojo (`danger`). Eliminar en el backend es borrado lógico.

### Capitalización y formato en vivo

Se aplica en el evento `(input)` con `setValue(..., { emitEvent: false })`; el backend vuelve a normalizar al guardar.

| Campo | Regla frontend | Backend |
|---|---|---|
| Rol, Novedad, Apartado y Menú (módulo Menú) | Cada palabra con mayúscula inicial | `capitalizarPalabras` (además pasa el resto a minúscula y colapsa espacios) |
| Cliente (Soporte) | Minúsculas y cada palabra con mayúscula (`valueChanges`, porque `p-autocomplete` no expone `input`) | `capitalizarPalabras` |
| Nombres y apellidos (Usuarios) | Primera letra en mayúscula | `capitalizarPrimeraLetra` |
| Descripciones | Primera letra en mayúscula | Se guarda como llega |
| Número de documento | Puntos de miles (`1.234.567`); en alta autocompleta **Usuario** con el documento sin puntos | Se guarda como llega |
| Número de contacto | 10 dígitos agrupados `3-3-4` (`321 256 5689`) | `formatearTelefono` + validación del mismo patrón |
| Mensaje de WhatsApp, Sentencia, Configuración | Sin cambios | Sin cambios |

## Tablas

`p-table` con **paginación lazy** en todos los listados (Roles, Permisos, Usuarios, Novedades, Configuración, Menú, Informes):

```html
<p-table [value]="items()" [lazy]="true" [paginator]="true" [rows]="rows"
         [totalRecords]="total()" (onLazyLoad)="cargar($event)" dataKey="id">
```

```ts
const rows = event?.rows ?? this.rows;                          // rows = 10
const page = Math.floor((event?.first ?? 0) / rows) + 1;        // PrimeNG usa offset; la API, página
params = new HttpParams().set('page', page).set('limit', rows);
this.items.set(respuesta.data ?? []);
this.total.set(respuesta.pagination?.total ?? 0);
```

- Orden: siempre el que devuelve la API (id descendente). No hay orden ni filtro por columna en la tabla.
- Tras crear, editar o eliminar se vuelve a llamar `cargar()` sin evento (página 1).
- En Informes, al cambiar un filtro se pone `first` en 0 (`primerRegistro`) y se recarga.
- Columnas comunes al final: Estado (`Activo`/`Inactivo`), Descripción (truncada, `max-w-xs truncate`), **Responsable**, Fecha (`fechaCreacion`), Actualizado (`fechaActualizacion`), acciones.
- **Responsable** = nombre completo del último usuario que modificó el registro (primer y segundo nombre, primer y segundo apellido, omitiendo vacíos). Lo arma el backend (`common/utils/responsable.util.ts`).
- Celdas vacías con el pipe `vacio` (`---`).
- Fechas con `date: 'short'` (detalle de Informes: `'medium'`).
- Fila sin datos: plantilla `#emptymessage` con `No hay … registrados.`.
- Informes: fila expandible (clic o Enter) con Mensaje de WhatsApp, Sentencia y Descripción, cada uno con botón **Copiar**; la sentencia muestra tooltip con vista previa de 300 caracteres.

### Tablas en móvil, tablet y PC

| Pantalla | Presentación |
|---|---|
| Móvil (< 768px) | Cada fila es una **tarjeta** con una línea por columna, `Título: valor` (título a la izquierda, valor a la derecha). Encabezado oculto. Celdas sin título (acciones, flecha de expandir) alineadas a la derecha; las que ocupan toda la fila (detalle expandido, "sin registros") a lo ancho |
| Tablet y PC | Tabla normal. Si no cabe, se desplaza a lo ancho dentro de su contenedor, nunca la página |

Cómo se arma (toda tabla nueva debe llevar las dos cosas):

```html
<p-table appTablaResponsiva [tableStyle]="{ 'min-width': '48rem' }" ...>
```

- `appTablaResponsiva` (`shared/directives/tabla-responsiva.directive.ts`): copia el texto de cada `thead th` en el `data-label` de su celda y lo repite cuando cambian las filas (paginación, filtros, fila expandida). Los estilos de tarjeta están en `styles.scss` (`.tabla-responsiva`, `@media (max-width: 767px)`).
- `tableStyle min-width`: ancho mínimo según las columnas (Roles y Novedades `48rem`, Permisos `52rem`, Menú y Configuración `56rem`, Informes `60rem`, Usuarios `80rem`). En móvil se anula.
- `styles.scss` da `overflow-x: auto` a `.p-datatable-table-container` (PrimeNG solo lo hace con `scrollable`).
- Texto que se trunca dentro de una celda va en un `<span class="block min-w-0 truncate">` (ej. Sentencia en Informes), para que el "…" funcione también en la tarjeta.
- En Informes el detalle expandido queda fijo a la izquierda (`sticky left-0`) con ancho de pantalla, para leerlo sin desplazarse.

## Diseño responsive

Tailwind con enfoque móvil primero; puntos de corte estándar:

| Ancho | Prefijo | Qué cambia |
|---|---|---|
| < 640px | — | Diálogos y toasts casi a todo el ancho; formularios a una columna |
| ≥ 640px | `sm:` | Formularios de dos columnas (Usuarios); Login y Recuperar vuelven a su ancho |
| ≥ 768px | `md:` | Tablas como tabla (antes, tarjetas); márgenes de página `p-6`; filtros de Informes en 4 columnas |
| ≥ 1024px | `lg:` | Barra lateral fija y contraíble; desaparece la barra superior con hamburguesa |
| ≥ 1280px | `xl:` | Tarjetas de resumen de Informes en 5 columnas (antes 2 y, desde `sm`, 3) |

Reglas para toda pantalla:

- Contenedor de la página: `p-4 md:p-6`. Fila de título y botón **Nuevo**: `flex flex-wrap items-center justify-between gap-3`.
- `p-dialog` con ancho fijo lleva `[breakpoints]="{ '575px': '92vw' }"` (o `maxWidth: '95vw'`, como Configuración).
- Grillas de formulario: `grid-cols-1 sm:grid-cols-2`.
- Tablas: `appTablaResponsiva` + `tableStyle min-width` (ver arriba).
- Tarjetas de Login y Recuperar: `w-full sm:w-auto sm:min-w-[320px]`.
- Alto de la app `h-dvh` (no `h-screen`), para que en móvil la barra del navegador no tape el contenido.

## Colores y severidades por estado

### Estado del soporte (Informes)

| Estado | Tag (`p-tag` severity) | Tarjeta de resumen | Ícono tarjeta | Detalle de la fila |
|---|---|---|---|---|
| Creado | `secondary` | `#64748b` | `pi-shopping-cart` | `pi-info-circle`, borde gris |
| En proceso | `warn` | `#f59e0b` | `pi-truck` | `pi-exclamation-triangle`, borde amarillo |
| Completado | `success` | `#22c55e` | `pi-check-circle` | `pi-check-circle`, borde verde |
| Error | `danger` | `#ef4444` | `pi-times-circle` | `pi-times-circle`, borde rojo |

La tarjeta **Total** usa el color primario del tema. Las tarjetas por estado ignoran el filtro de estado; el Total sí lo respeta (es el total de la tabla).

### Resultado en Soporte

| Situación | Presentación |
|---|---|
| Sentencia no permitida (validación en vivo o 422 del backend) | `app-alerta-resultado` **advertencia** (amarillo), copiable |
| Ejecución `Completado` | Alerta **éxito** (verde) con su botón Copiar; al copiar, el formulario se limpia |
| Ejecución `Error` | Alerta **error** (rojo) + botón **Reintentar** (guarda cambios con PATCH y vuelve a ejecutar el mismo registro) |
| 429 (rate limit de ejecuciones) | Toast amarillo con el mensaje del backend |
| Otro error HTTP | Toast rojo |

### Convención general

Verde = éxito · Rojo = error / eliminar · Amarillo = advertencia / confirmación de eliminar · Gris = neutro o pendiente.

## Tema claro / oscuro

- Tema PrimeNG **Aura** con `darkModeSelector: '.dark'` (`app.config.ts`); los componentes propios traen clases `dark:` de Tailwind y `styles.scss` define `.dark .confirmar-eliminar`.
- **No hay selector de tema**: nada agrega la clase `.dark` al documento, así que la app siempre se ve en claro. Para activarlo basta con poner `class="dark"` en `<html>`.
- Textos de PrimeNG traducidos en `providePrimeNG({ translation })`: Débil/Media/Fuerte, `Sí`/`No`.

## Manejo de errores HTTP y timeout

Interceptores en `core/interceptors/`, en este orden (`app.config.ts`):

| Orden | Interceptor | Qué hace |
|---|---|---|
| 1 | `apiBaseUrlInterceptor` | Si `environment.apiUrl` tiene valor, lo antepone a `/api/...`. Hoy está vacío en todos los ambientes: mismo origen |
| 2 | `authInterceptor` | Agrega `Authorization: Bearer <token>` salvo en `/api/auth/login`, `/refresh` y `/recuperar-password`. Ante un **401** renueva la sesión y reintenta **una vez** (marca `REINTENTADA`); si la renovación también da 401, va al login. `/api/auth/logout` no reintenta |
| 3 | `timeoutInterceptor` | Corta toda petición a los **20 s** (`TimeoutError` de RxJS) para que el preloader no quede visible para siempre |

En cada pantalla:

- `try / catch / finally` con `firstValueFrom`; el `finally` oculta el preloader.
- Mensaje al usuario: `error.error.message` del envelope si existe (`extraerMensaje`, repetido en cada componente); si no, un genérico (`Ocurrió un error, intenta de nuevo.`, o uno propio de la pantalla).
- Errores al cargar listas: toast `No se pudieron cargar los ….`. Errores al cargar selects (`/opciones`): lista vacía, sin aviso.
- **429** (límite excedido: intentos de login / recuperar, ejecuciones de Soporte) se muestra como toast **amarillo** con el mensaje del backend, usando `esLimiteExcedido(error)` de `core/utils/limite-excedido.util.ts` ([14-api](14-api.md#429-límite-excedido)).
- **401** lo resuelve el interceptor; **403** de cambio de contraseña pendiente no ocurre en la práctica porque la UI solo muestra el modal; **422** en Soporte se muestra en amarillo, no como error.
- Un timeout o fallo de red no es `HttpErrorResponse` con envelope: se ve el mensaje genérico.
- Códigos y formato del envelope: [14-api](14-api.md).

## Versiones nuevas

- `recargarSiCambioLaVersion` (arriba) recarga si una pantalla (chunk) ya no existe tras un despliegue.
- nginx sirve `index.html` con `Cache-Control: no-cache` y los archivos con hash con caché de un año `immutable`; un chunk inexistente responde **404** (nunca `index.html`), así la recarga se dispara limpia.

## Servidor de desarrollo

| Qué | Dónde | Valor |
|---|---|---|
| Comando | `frontend/package.json` | `npm start` (`ng serve`, configuración `development`), puerto 4200 |
| Proxy | `frontend/proxy.conf.json` | `/api` → `http://localhost:3000` (`changeOrigin`, `secure: false`) |
| Hosts permitidos | `frontend/angular.json` → `serve.options.allowedHosts` | `.trycloudflare.com` (túnel Cloudflared rápido) |
| Ambiente | `src/environments/environment.ts` | `apiUrl: ''` |

Con el proxy, `ng serve` llama a `/api` en su mismo origen y no necesita CORS. Solo si se apunta a una API en otro origen hay que agregar `http://localhost:4200` a `CORS_ORIGENES` ([13-despliegue-y-operacion](13-despliegue-y-operacion.md#cors)).

## Build y nginx

| Qué | Dónde | Detalle |
|---|---|---|
| Build | `angular.json` (`production` por defecto) | `outputHashing: all`, reemplaza `environment.ts` por `environment.production.ts`; presupuestos: inicial 1 MB aviso / 2 MB error, estilos por componente 4 kB / 8 kB |
| Imagen | `frontend/Dockerfile` | Etapa `node:22-alpine` (`npm ci`, `npm run build`) → etapa `nginx:alpine` con `dist/frontend/browser` |
| Servidor | `frontend/nginx.conf` | Puerto 80 (publicado como 3001) |

`nginx.conf`:

| `location` | Comportamiento |
|---|---|
| `^~ /api/` | `proxy_pass http://api:3000`, cabeceras `X-Real-IP` / `X-Forwarded-*`, `proxy_read_timeout 90s`, `client_max_body_size 10m` |
| Estáticos (`js, css, map, fuentes, imágenes`) | `try_files $uri =404`, caché un año `immutable` |
| `/` | `try_files $uri $uri/ /index.html` (SPA), `Cache-Control: no-cache` |

En todas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer-when-downgrade` (repetidas en cada `location` porque nginx no hereda `add_header`).
