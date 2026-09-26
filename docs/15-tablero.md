# 15 · Tablero

KPIs de soporte del rango de fechas filtrado, en una sola pantalla del apartado **Control** (encima de Informe). Responde tres preguntas: cómo vamos (indicadores generales), **quién hace más soportes** (ranking de integrantes) y **qué novedades pesan más** (top 10).

## Acceso

Exclusivo de **Super Administrador** y **Administrador**, con doble candado:

| Capa | Regla |
|---|---|
| API | `@Roles(Super Administrador, Administrador)` en todo el controlador **y** `@RequierePermiso(Tablero, Consultar)`. Cualquier otro rol → 403, aunque tuviera el permiso |
| Permisos | El permiso `Tablero` solo se asigna a esos dos roles: crear o editar uno para otro rol → **403** (`PermisosService.validarRolTablero`). La vista Permisos solo ofrece esos dos roles cuando el menú es Tablero |
| Frontend | Ruta `/tablero` con `permisoGuard('Tablero')`; la opción del menú solo aparece con `Tablero → Consultar` |

`Tablero` solo admite la acción **Consultar** (`ACCIONES_POR_MENU`).

## Universo y reglas de negocio

| Concepto | Regla |
|---|---|
| Universo | Tabla `soporte`, **incluidos los eliminados**, igual que [Informe](11-informes.md) |
| Rango | Sobre `fecha_creacion`, en hora Colombia (UTC-5). Sin filtro → **mes actual** (día 1 a hoy). Máximo 366 días |
| Integrante | `soporte.id_usuario`: el responsable (último usuario que creó, editó o ejecutó el caso), mismo criterio que la columna Responsable de Informe. Sin responsable → "Sin responsable" |
| Pendientes | `Creado` + `En proceso` |
| Tasa de éxito | `Completado / (Completado + Error) × 100`. Los pendientes no entran en la base. Base 0 → `null` (se muestra "—", no 0 %) |
| Comparativo | Variación % del total contra el periodo anterior de igual duración, inmediatamente antes. Anterior 0 → `null` |
| Top 10 novedades | Orden por cantidad de soportes desc, desempate por errores desc y luego nombre |
| Alerta de novedad | % de error > **10 %** → etiqueta en rojo (`UMBRAL_ERROR_NOVEDAD`) |
| Concentración | % del total del rango que suman las novedades del top 10 |
| Meta de éxito | Gauge con meta **95 %**: rojo < 80 %, ámbar 80–94 %, verde ≥ 95 % (`META_EXITO`). El color se evalúa sobre la tasa redondeada, igual que se muestra: "95 %" nunca sale en ámbar |

Todos los porcentajes se redondean a 1 decimal en el backend y la interfaz los muestra en entero (`formatearPorcentaje`: 92,6 → "93 %"; sin base → "—"). Todo se calcula con consultas agregadas en MySQL (`COUNT`/`SUM(CASE …)` + `GROUP BY`), apoyadas en los índices `idx_soporte_fecha_estado` e `idx_soporte_usuario_fecha` ([02-base-de-datos](02-base-de-datos.md)).

## Pantalla

| Bloque | Contenido |
|---|---|
| Filtros | Rango de fechas, atajos (Hoy, 7 días, Mes actual, Mes anterior), Integrante, Motor, Limpiar. Cada cambio recarga el tablero |
| Indicadores | Total (con ▲/▼ vs. periodo anterior y pendientes), Completados, Con error (con su % del total) y Tasa de éxito. Tarjetas compactas; la de tasa de éxito es horizontal (título y meta a la izquierda, gauge pequeño con el % dentro a la derecha) para no estirar la fila |
| Quién hace más soportes | Barra horizontal apilada Completado / Error / Pendiente por integrante (todos, de mayor a menor), medallas al top 3 y etiqueta `total · % éxito`. Clic en un integrante → filtra el tablero por él |
| Top 10 novedades | Barra horizontal Sin error / Con error, etiqueta `total · % error` (en rojo si supera el umbral) y la frase de concentración ("N novedades concentran el X % de los soportes del rango."). Clic en una novedad → filtra el tablero por ella (chip removible) |
| Sin datos | "No hay soportes en el rango seleccionado." en lugar de gráficos vacíos |

Los gráficos usan **Apache ECharts** (`ngx-echarts`), registrado con tree-shaking (barras, gauge, canvas) y cargado con import dinámico: solo se descarga al entrar al Tablero. El alto de cada gráfico crece con la cantidad de barras (32 px por barra) para que las etiquetas no se aplasten.

## Endpoints (`/api/tablero`)

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/kpis` | Todo el tablero en una llamada (contrato abajo) |
| GET | `/usuarios` | Opciones del filtro Integrante (`id`, `nombreCompleto`) |

Filtros y errores en [14-api](14-api.md#tablero-apitablero).

```jsonc
{
  "rango": { "fechaInicio": "2026-09-01", "fechaFin": "2026-09-26" },
  "resumen": {
    "total": 1284, "completados": 1150, "errores": 98, "pendientes": 36,
    "tasaExito": 92.1, "totalPeriodoAnterior": 1146, "variacionTotal": 12.0
  },
  "porIntegrante": [
    { "idUsuario": 3, "nombre": "…", "total": 312, "completados": 300, "errores": 12, "pendientes": 0, "tasaExito": 96.2 }
  ],
  "topNovedades": [
    { "idNovedad": 5, "novedad": "Romper Acuerdo", "total": 210, "errores": 8, "porcentajeError": 3.8 }
  ],
  "concentracionTop10": 78.4
}
```

## Código

| Qué | Dónde |
|---|---|
| Controlador, servicio, DTO | `backend/src/modules/tablero/` |
| Cálculos puros (tasa, variación, rangos) y sus pruebas | `backend/src/modules/tablero/tablero.calculos.ts` |
| Rango de fechas en hora Colombia (compartido con Informe) | `backend/src/common/utils/rango-fechas.util.ts` |
| Restricción de roles (`ROLES_TABLERO`) | `backend/src/common/auth/jerarquia-roles.util.ts`, `backend/src/modules/permisos/permisos.service.ts` |
| Pantalla, servicio y modelo | `frontend/src/app/features/tablero/` |
| Opciones de los gráficos, colores y umbrales | `frontend/src/app/features/tablero/tablero.graficos.ts` |
| Registro de ECharts | `frontend/src/app/features/tablero/echarts.config.ts` |
| Pruebas e2e | `backend/test/tablero.e2e-spec.ts` |
