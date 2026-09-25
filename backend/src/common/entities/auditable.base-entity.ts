import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * `descripcion` e `id_usuario` van inmediatamente después de `estado_registro`, antes
 * de las fechas (ver `planing/03-modelo-datos.md`). Usada por las 6 tablas del
 * módulo (`roles`, `permisos`, `usuarios`, `novedades`, `soporte` y `configuracion`).
 */
export abstract class AuditableBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'estado_registro', type: 'tinyint', width: 1, default: 1 })
  estadoRegistro: number;

  @Column({ name: 'descripcion', type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  idUsuario: number | null;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;

  @DeleteDateColumn({ name: 'fecha_eliminacion' })
  fechaEliminacion: Date | null;
}
