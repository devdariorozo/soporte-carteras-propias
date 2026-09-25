import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { Rol } from '../modules/roles/rol.entity.js';
import { Permiso } from '../modules/permisos/permiso.entity.js';
import { Usuario } from '../modules/usuarios/usuario.entity.js';
import { Novedad } from '../modules/novedades/novedad.entity.js';
import { Soporte } from '../modules/soporte/soporte.entity.js';
import { Configuracion } from '../modules/configuracion/configuracion.entity.js';
import { Menu } from '../modules/menu/menu.entity.js';
import { InitialSchema1700000000000 } from './migrations/1700000000000-initial-schema.js';

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'dbd_soporte_carteras_propias',
  poolSize: Number(process.env.DB_POOL_SIZE ?? 10),
  // Sin esto, mysql2 interpreta los TIMESTAMP devueltos por el driver como si fueran
  // hora local del proceso Node (opción por defecto `timezone: 'local'`) — funciona
  // por accidente dentro de Docker (contenedor y BD en UTC), pero rompe corriendo el
  // backend/tests en el host (Bogotá, UTC-5): la sesión de MySQL guarda en UTC, así
  // que el driver debe leerlo como UTC también, sin importar dónde corre el proceso.
  timezone: 'Z',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [Rol, Permiso, Usuario, Novedad, Soporte, Configuracion, Menu],
  migrations: [InitialSchema1700000000000],
};

export const AppDataSource = new DataSource(dataSourceOptions);
