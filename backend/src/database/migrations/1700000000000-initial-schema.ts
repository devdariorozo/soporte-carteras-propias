import { MigrationInterface, QueryRunner } from 'typeorm';

/** Columnas de auditoría comunes a todas las tablas (ver `AuditableBaseEntity`). */
const AUDIT_COLUMNS = `
  estado_registro TINYINT(1) NOT NULL DEFAULT 1,
  descripcion VARCHAR(255) NULL,
  id_usuario INT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  fecha_eliminacion TIMESTAMP NULL
`;

const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

/**
 * Unicidad solo entre registros no eliminados (borrado lógico): MySQL no tiene índices
 * parciales, así que se indexa una columna virtual que vale `columna` mientras
 * `fecha_eliminacion` es NULL y NULL cuando el registro se elimina (UNIQUE admite varios
 * NULL). Así un registro eliminado no impide crear otro con el mismo valor, igual que las
 * validaciones de duplicado de los servicios (TypeORM excluye los eliminados).
 */
function unicoSinEliminados(indice: string, columna: string, tipo: string): string {
  return `
    ${columna}_vigente ${tipo} GENERATED ALWAYS AS (IF(fecha_eliminacion IS NULL, ${columna}, NULL)) VIRTUAL,
    UNIQUE KEY ${indice} (${columna}_vigente)`;
}

/**
 * Esquema inicial completo del sistema. Los datos base (roles, permisos, Super
 * Administrador, configuración y menú) los siembra `seeds/run-seed.ts`.
 */
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE roles (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        rol VARCHAR(45) NOT NULL,
        ${AUDIT_COLUMNS}
      ) ${TABLE_OPTIONS};
    `);

    await queryRunner.query(`
      CREATE TABLE menu (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        apartado VARCHAR(45) NOT NULL,
        menu VARCHAR(45) NOT NULL,
        ruta VARCHAR(150) NOT NULL,
        icono VARCHAR(45) NOT NULL,
        orden INT NOT NULL,
        ${AUDIT_COLUMNS},
        ${unicoSinEliminados('uq_menu_menu', 'menu', 'VARCHAR(45)')},
        ${unicoSinEliminados('uq_menu_ruta', 'ruta', 'VARCHAR(150)')},
        ${unicoSinEliminados('uq_menu_orden', 'orden', 'INT')}
      ) ${TABLE_OPTIONS};
    `);

    /** `menu` debe ser igual al `menu.menu` de una opción activa (validado en PermisosService). */
    await queryRunner.query(`
      CREATE TABLE permisos (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        id_rol INT NOT NULL,
        menu VARCHAR(45) NOT NULL,
        permiso VARCHAR(45) NOT NULL,
        ${AUDIT_COLUMNS},
        CONSTRAINT fk_permisos_rol FOREIGN KEY (id_rol) REFERENCES roles (id) ON DELETE CASCADE
      ) ${TABLE_OPTIONS};
    `);

    await queryRunner.query(`
      CREATE TABLE usuarios (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        numero_documento VARCHAR(21) NOT NULL,
        primer_nombre VARCHAR(60) NOT NULL,
        segundo_nombre VARCHAR(60) NULL,
        primer_apellido VARCHAR(60) NOT NULL,
        segundo_apellido VARCHAR(60) NULL,
        numero_contacto VARCHAR(20) NOT NULL,
        id_rol INT NOT NULL,
        correo VARCHAR(120) NOT NULL,
        usuario VARCHAR(45) NOT NULL,
        password VARCHAR(255) NOT NULL,
        secreto VARCHAR(255) NULL,
        debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 1,
        refresh_token VARCHAR(255) NULL,
        ultimo_tipo_equipo VARCHAR(20) NULL,
        ultimo_navegador VARCHAR(100) NULL,
        ultimo_sistema_operativo VARCHAR(100) NULL,
        ultima_fecha_login DATETIME NULL,
        ${AUDIT_COLUMNS},
        ${unicoSinEliminados('uq_usuarios_correo', 'correo', 'VARCHAR(120)')},
        ${unicoSinEliminados('uq_usuarios_usuario', 'usuario', 'VARCHAR(45)')},
        CONSTRAINT fk_usuarios_rol FOREIGN KEY (id_rol) REFERENCES roles (id) ON DELETE RESTRICT
      ) ${TABLE_OPTIONS};
    `);

    await queryRunner.query(`
      CREATE TABLE novedades (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        novedad VARCHAR(45) NOT NULL,
        ${AUDIT_COLUMNS}
      ) ${TABLE_OPTIONS};
    `);

    /**
     * `motor` = `configuracion.nombre` de la conexión contra la que se ejecuta la sentencia.
     * Índices por rango de `fecha_creacion` para los agregados del Tablero e Informe (por estado y por responsable).
     */
    await queryRunner.query(`
      CREATE TABLE soporte (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        cliente VARCHAR(100) NOT NULL,
        id_novedad INT NOT NULL,
        mensaje_whatsapp VARCHAR(255) NOT NULL,
        motor ENUM('mysql', 'postgres') NOT NULL,
        sentencia TEXT NOT NULL,
        estado_soporte ENUM('Creado', 'En proceso', 'Completado', 'Error') NOT NULL DEFAULT 'Creado',
        ${AUDIT_COLUMNS},
        KEY idx_soporte_fecha_estado (fecha_creacion, estado_soporte),
        KEY idx_soporte_usuario_fecha (id_usuario, fecha_creacion),
        CONSTRAINT fk_soporte_novedad FOREIGN KEY (id_novedad) REFERENCES novedades (id) ON DELETE RESTRICT
      ) ${TABLE_OPTIONS};
    `);

    /**
     * `objeto`: JSON plano, un valor por clave (texto, número, sí/no o lista); versionado por `nombre`.
     * `alcance`: a qué bases aplica la conexión (ej. `Todas`, `Base Raiz`); se muestra en el select Motor de Soporte.
     */
    await queryRunner.query(`
      CREATE TABLE configuracion (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(45) NOT NULL,
        alcance VARCHAR(45) NOT NULL,
        objeto JSON NOT NULL,
        ${AUDIT_COLUMNS}
      ) ${TABLE_OPTIONS};
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS configuracion;');
    await queryRunner.query('DROP TABLE IF EXISTS soporte;');
    await queryRunner.query('DROP TABLE IF EXISTS novedades;');
    await queryRunner.query('DROP TABLE IF EXISTS usuarios;');
    await queryRunner.query('DROP TABLE IF EXISTS permisos;');
    await queryRunner.query('DROP TABLE IF EXISTS menu;');
    await queryRunner.query('DROP TABLE IF EXISTS roles;');
  }
}
