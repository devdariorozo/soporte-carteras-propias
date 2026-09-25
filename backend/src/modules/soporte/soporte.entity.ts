import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';
import { Novedad } from '../novedades/novedad.entity.js';

export enum EstadoSoporte {
  CREADO = 'Creado',
  EN_PROCESO = 'En proceso',
  COMPLETADO = 'Completado',
  ERROR = 'Error',
}

/** Motor de BD contra el que se ejecuta la sentencia — igual al `configuracion.nombre` de su conexión. */
export enum MotorSoporte {
  MYSQL = 'mysql',
  POSTGRES = 'postgres',
}

@Entity('soporte')
export class Soporte extends AuditableBaseEntity {
  @Column({ name: 'cliente', type: 'varchar', length: 100 })
  cliente: string;

  @Column({ name: 'mensaje_whatsapp', type: 'varchar', length: 255 })
  mensajeWhatsapp: string;

  @Column({ name: 'motor', type: 'enum', enum: MotorSoporte })
  motor: MotorSoporte;

  @Column({ name: 'sentencia', type: 'text' })
  sentencia: string;

  @Column({ name: 'id_novedad', type: 'int' })
  idNovedad: number;

  @ManyToOne(() => Novedad, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_novedad' })
  novedadRef: Novedad;

  @Column({
    name: 'estado_soporte',
    type: 'enum',
    enum: EstadoSoporte,
    default: EstadoSoporte.CREADO,
  })
  estadoSoporte: EstadoSoporte;
}
