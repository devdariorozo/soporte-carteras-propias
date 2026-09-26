import 'dotenv/config';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source.js';
import { NombreRol, Rol } from '../../modules/roles/rol.entity.js';
import { AccionPermiso, ModuloPermiso, Permiso, accionesPermitidas } from '../../modules/permisos/permiso.entity.js';
import { Usuario } from '../../modules/usuarios/usuario.entity.js';
import { Configuracion } from '../../modules/configuracion/configuracion.entity.js';
import { Menu } from '../../modules/menu/menu.entity.js';
import { formatearTelefono } from '../../common/utils/telefono.util.js';
import { capitalizarPalabras } from '../../common/utils/texto.util.js';
import { Novedad } from '../../modules/novedades/novedad.entity.js';

const DESCRIPCION_SEED_INICIAL = 'Creado en la migración inicial.';
/**
 * `roles`/`permisos` se siembran antes que el usuario Super Administrador, pero en
 * una base de datos nueva su `id` autoincremental siempre es 1 — se le atribuyen a él
 * (ver `id_usuario` en planing/03-modelo-datos.md).
 */
const ID_USUARIO_SEED_INICIAL = 1;

function formatearNumeroDocumento(documento: string): string {
  return documento.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const TODOS_LOS_MODULOS = Object.values(ModuloPermiso);

const MATRIZ_PERMISOS: Record<NombreRol, { menu: ModuloPermiso; acciones: AccionPermiso[] }[]> = {
  [NombreRol.SUPER_ADMINISTRADOR]: TODOS_LOS_MODULOS.map((menu) => ({
    menu,
    acciones: accionesPermitidas(menu),
  })),
  // Todo menos Configuración — incluye Tablero, que solo comparte con el Super Administrador.
  [NombreRol.ADMINISTRADOR]: TODOS_LOS_MODULOS.filter(
    (menu) => menu !== ModuloPermiso.CONFIGURACION,
  ).map((menu) => ({ menu, acciones: accionesPermitidas(menu) })),
  [NombreRol.DESARROLLADOR]: [
    {
      menu: ModuloPermiso.SOPORTE,
      acciones: [AccionPermiso.CREAR, AccionPermiso.EDITAR, AccionPermiso.CONSULTAR],
    },
    {
      menu: ModuloPermiso.INFORMES,
      acciones: [AccionPermiso.CONSULTAR],
    },
    // Administra el catálogo de novedades (sin eliminar) y lo usa en el select de su formulario
    // y en el filtro de Informes (Opciones).
    {
      menu: ModuloPermiso.NOVEDADES,
      acciones: [AccionPermiso.CREAR, AccionPermiso.EDITAR, AccionPermiso.CONSULTAR, AccionPermiso.OPCIONES],
    },
    { menu: ModuloPermiso.USUARIOS, acciones: [AccionPermiso.OPCIONES] },
  ],
  // Solo ve el Informe; Opciones de Novedades alimenta el filtro por novedad de esa vista.
  [NombreRol.APRENDIZ_SENA]: [
    { menu: ModuloPermiso.INFORMES, acciones: [AccionPermiso.CONSULTAR] },
    { menu: ModuloPermiso.NOVEDADES, acciones: [AccionPermiso.OPCIONES] },
  ],
};

async function seedRoles(): Promise<Map<NombreRol, Rol>> {
  const repo = AppDataSource.getRepository(Rol);
  const mapa = new Map<NombreRol, Rol>();

  for (const nombreRol of Object.values(NombreRol)) {
    let rol = await repo.findOne({ where: { rol: nombreRol } });
    if (!rol) {
      rol = await repo.save(
        repo.create({
          rol: nombreRol,
          estadoRegistro: 1,
          descripcion: DESCRIPCION_SEED_INICIAL,
          idUsuario: ID_USUARIO_SEED_INICIAL,
        }),
      );
      console.log(`[seed] rol creado: ${nombreRol}`);
    }
    mapa.set(nombreRol, rol);
  }

  return mapa;
}

async function seedPermisos(roles: Map<NombreRol, Rol>): Promise<void> {
  const repo = AppDataSource.getRepository(Permiso);

  for (const [nombreRol, entradas] of Object.entries(MATRIZ_PERMISOS) as [NombreRol, typeof MATRIZ_PERMISOS[NombreRol]][]) {
    const rol = roles.get(nombreRol);
    if (!rol) continue;

    for (const { menu, acciones } of entradas) {
      for (const accion of acciones) {
        const existente = await repo.findOne({
          where: { idRol: rol.id, menu, permiso: accion },
        });
        if (!existente) {
          await repo.save(
            repo.create({
              idRol: rol.id,
              menu,
              permiso: accion,
              estadoRegistro: 1,
              descripcion: DESCRIPCION_SEED_INICIAL,
              idUsuario: ID_USUARIO_SEED_INICIAL,
            }),
          );
          console.log(`[seed] permiso creado: ${nombreRol} / ${menu} / ${accion}`);
        }
      }
    }
  }
}

async function seedSuperAdmin(roles: Map<NombreRol, Rol>): Promise<void> {
  const documento = process.env.SEED_SUPERADMIN_DOCUMENTO;
  const nombre = process.env.SEED_SUPERADMIN_NOMBRE;
  const segundoNombre = process.env.SEED_SUPERADMIN_SEGUNDO_NOMBRE || null;
  const apellido = process.env.SEED_SUPERADMIN_APELLIDO;
  const segundoApellido = process.env.SEED_SUPERADMIN_SEGUNDO_APELLIDO || null;
  const numeroContacto = process.env.SEED_SUPERADMIN_NUMERO_CONTACTO;
  const correo = process.env.SEED_SUPERADMIN_CORREO;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!documento || !nombre || !apellido || !numeroContacto || !correo || !password) {
    throw new Error(
      'Faltan variables SEED_SUPERADMIN_* en el .env: DOCUMENTO, NOMBRE, APELLIDO, NUMERO_CONTACTO, CORREO, PASSWORD son obligatorias.',
    );
  }

  const repo = AppDataSource.getRepository(Usuario);
  const existente = await repo.findOne({ where: { usuario: documento } });
  if (existente) {
    console.log('[seed] usuario Super Administrador ya existe, no se duplica.');
    return;
  }

  const superAdmin = roles.get(NombreRol.SUPER_ADMINISTRADOR);
  if (!superAdmin) {
    throw new Error('No se encontró el rol Super Administrador ya sembrado.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await repo.save(
    repo.create({
      numeroDocumento: formatearNumeroDocumento(documento),
      primerNombre: nombre,
      segundoNombre,
      primerApellido: apellido,
      segundoApellido,
      numeroContacto: formatearTelefono(numeroContacto),
      idRol: superAdmin.id,
      correo,
      usuario: documento,
      password: passwordHash,
      debeCambiarPassword: 1,
      estadoRegistro: 1,
      descripcion: DESCRIPCION_SEED_INICIAL,
    }),
  );
  console.log(`[seed] usuario Super Administrador creado: ${documento}`);
}

const CONFIGURACIONES_SEED: { nombre: string; alcance: string; objeto: Record<string, unknown> }[] = [
  {
    nombre: 'mysql',
    alcance: 'Todas',
    objeto: {
      host: 'localhost',
      username: 'root',
      password: 'root',
      port: 3306,
    },
  },
  {
    // Ejemplo FICTICIO de PostgreSQL (AWS RDS detrás de un bastión SSH), en el orden de DBeaver:
    // pestaña Main (host, database, username, password, port), `ssl` (conexión cifrada, la exige
    // el servidor cuando su pg_hba.conf solo acepta hostssl) y pestaña SSH (ssh_host,
    // ssh_username, ssh_passphrase, ssh_port). `database` es obligatoria: las sentencias vienen
    // como esquema.tabla. Sin `ssh_host` la conexión es directa. El Private Key NO va aquí: sale
    // de SSH_KEY_PATH de backend/.env. Los valores reales se ponen en Configuración.
    nombre: 'postgres',
    alcance: 'Base Raiz',
    objeto: {
      host: 'mi-base.xxxxxxxx.us-east-1.rds.amazonaws.com',
      database: 'mi_base_cartera',
      username: 'usuario_cartera',
      password: 'CAMBIAR_PASSWORD',
      port: 5432,
      ssl: true,
      ssh_host: '203.0.113.10',
      ssh_username: 'usuario_bastion',
      ssh_passphrase: 'CAMBIAR_PASSPHRASE',
      ssh_port: 22,
    },
  },
];

/**
 * Por `nombre` (no por "hay una fila activa"): el seed solo crea cada fila la primera vez, sin
 * importar si luego el usuario la desactivó/eliminó desde Configuración. Si la fila activa ya
 * existe, solo le AGREGA las claves nuevas del ejemplo que le falten (ej. `database`, `ssh_*`),
 * con su valor de ejemplo; nunca cambia un valor ya escrito.
 */
async function seedConfiguraciones(): Promise<void> {
  const repo = AppDataSource.getRepository(Configuracion);
  for (const item of CONFIGURACIONES_SEED) {
    const existente = await repo.findOne({ where: { nombre: item.nombre } });
    if (existente) {
      const activa = await repo.findOne({ where: { nombre: item.nombre, estadoRegistro: 1 } });
      const faltantes = activa ? Object.keys(item.objeto).filter((clave) => !(clave in (activa.objeto ?? {}))) : [];
      if (activa && faltantes.length) {
        activa.objeto = { ...activa.objeto, ...Object.fromEntries(faltantes.map((clave) => [clave, item.objeto[clave]])) };
        await repo.save(activa);
        console.log(`[seed] configuración "${item.nombre}": se agregaron las claves ${faltantes.join(', ')} (valores de ejemplo, completar en Configuración).`);
      } else {
        console.log(`[seed] configuración "${item.nombre}" ya existe, no se duplica.`);
      }
      continue;
    }
    await repo.save(
      repo.create({
        nombre: item.nombre,
        alcance: item.alcance,
        objeto: item.objeto,
        estadoRegistro: 1,
        descripcion: DESCRIPCION_SEED_INICIAL,
        idUsuario: ID_USUARIO_SEED_INICIAL,
      }),
    );
    console.log(`[seed] configuración creada: ${item.nombre}`);
  }
}

const MENU_FINAL: { apartado: string; menu: string; ruta: string; icono: string; orden: number }[] = [
  { apartado: 'Administración', menu: 'Configuración', ruta: '/configuracion', icono: 'pi pi-cog', orden: 1 },
  { apartado: 'Administración', menu: 'Roles', ruta: '/roles', icono: 'pi pi-shield', orden: 2 },
  { apartado: 'Administración', menu: 'Menu', ruta: '/menu', icono: 'pi pi-sitemap', orden: 3 },
  { apartado: 'Administración', menu: 'Permisos', ruta: '/permisos', icono: 'pi pi-lock', orden: 4 },
  { apartado: 'Administración', menu: 'Usuarios', ruta: '/usuarios', icono: 'pi pi-users', orden: 5 },
  { apartado: 'Administración', menu: 'Novedades', ruta: '/novedades', icono: 'pi pi-megaphone', orden: 6 },
  { apartado: 'Control', menu: 'Tablero', ruta: '/tablero', icono: 'pi pi-chart-pie', orden: 7 },
  { apartado: 'Control', menu: 'Informe', ruta: '/informes', icono: 'pi pi-chart-bar', orden: 8 },
  { apartado: 'Operación', menu: 'Soporte', ruta: '/soporte', icono: 'pi pi-wrench', orden: 9 },
];

/** El orden sale solo de `MENU_FINAL` al sembrar una BD nueva: una opción que ya existe (por ruta) no se toca. */
async function seedMenu(): Promise<void> {
  const repo = AppDataSource.getRepository(Menu);
  for (const item of MENU_FINAL) {
    const existente = await repo.findOne({ where: { ruta: item.ruta } });
    if (existente) continue;
    await repo.save(
      repo.create({
        ...item,
        estadoRegistro: 1,
        descripcion: DESCRIPCION_SEED_INICIAL,
        idUsuario: ID_USUARIO_SEED_INICIAL,
      }),
    );
    console.log(`[seed] menú creado: ${item.apartado} / ${item.menu}`);
  }
}

/**
 * Catálogo inicial de novedades, estandarizado a partir del histórico del chat de
 * soporte de carteras (abr–sep 2026), ordenado de mayor a menor frecuencia.
 */
const NOVEDADES_INICIALES = [
  'Romper Acuerdo',
  'Subir Novación',
  'Subir Acuerdo',
  'Aprobar Acuerdo',
  'Caída De Soul',
  'Pago En Landing',
  'Código De Pago No Llega',
  'Envío De Acuerdo Por Correo',
  'Descargar Acuerdo',
  'Búsqueda De Clientes',
  'Lentitud De Soul',
  'Actualizar Correo Del Cliente',
  'Permisos De Usuario',
  'Novación En Cero',
  'Cierre De Novación Con Deuda Activa',
  'Selección De Banco En Pago',
  'Cargue De Pagos',
  'Extracción De Estrategia',
  'Promesa Sin Gestión Asociada',
  'Cliente No Existe En Cartera',
  'Descargar Certificado De Deuda',
];

/** Por nombre, igual que el módulo Novedades (capitalizado, sin duplicar aunque esté inactiva). */
async function seedNovedades(): Promise<void> {
  const repo = AppDataSource.getRepository(Novedad);
  for (const texto of NOVEDADES_INICIALES) {
    const novedad = capitalizarPalabras(texto);
    const existente = await repo.findOne({ where: { novedad }, withDeleted: true });
    if (existente) continue;
    await repo.save(
      repo.create({
        novedad,
        estadoRegistro: 1,
        descripcion: DESCRIPCION_SEED_INICIAL,
        idUsuario: ID_USUARIO_SEED_INICIAL,
      }),
    );
    console.log(`[seed] novedad creada: ${novedad}`);
  }
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const roles = await seedRoles();
    await seedPermisos(roles);
    await seedSuperAdmin(roles);
    await seedConfiguraciones();
    await seedMenu();
    await seedNovedades();
    console.log('[seed] completado.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('[seed] error:', error);
  process.exitCode = 1;
});
