import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';
import { Rol } from '../roles/rol.entity.js';

@Entity('usuarios')
export class Usuario extends AuditableBaseEntity {
  @Column({ name: 'numero_documento', type: 'varchar', length: 21 })
  numeroDocumento: string;

  @Column({ name: 'primer_nombre', type: 'varchar', length: 60 })
  primerNombre: string;

  @Column({ name: 'segundo_nombre', type: 'varchar', length: 60, nullable: true })
  segundoNombre: string | null;

  @Column({ name: 'primer_apellido', type: 'varchar', length: 60 })
  primerApellido: string;

  @Column({ name: 'segundo_apellido', type: 'varchar', length: 60, nullable: true })
  segundoApellido: string | null;

  @Column({ name: 'numero_contacto', type: 'varchar', length: 20 })
  numeroContacto: string;

  @Column({ name: 'id_rol', type: 'int' })
  idRol: number;

  @ManyToOne(() => Rol, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'id_rol' })
  rolRef: Rol;

  @Column({ name: 'correo', type: 'varchar', length: 120, unique: true })
  correo: string;

  @Column({ name: 'usuario', type: 'varchar', length: 45, unique: true })
  usuario: string;

  @Column({ name: 'password', type: 'varchar', length: 255 })
  password: string;

  @Column({ name: 'secreto', type: 'varchar', length: 255, nullable: true })
  secreto: string | null;

  @Column({ name: 'debe_cambiar_password', type: 'tinyint', width: 1, default: 1 })
  debeCambiarPassword: number;

  @Column({ name: 'refresh_token', type: 'varchar', length: 255, nullable: true })
  refreshToken: string | null;

  @Column({ name: 'ultimo_tipo_equipo', type: 'varchar', length: 20, nullable: true })
  ultimoTipoEquipo: string | null;

  @Column({ name: 'ultimo_navegador', type: 'varchar', length: 100, nullable: true })
  ultimoNavegador: string | null;

  @Column({ name: 'ultimo_sistema_operativo', type: 'varchar', length: 100, nullable: true })
  ultimoSistemaOperativo: string | null;

  @Column({ name: 'ultima_fecha_login', type: 'datetime', nullable: true })
  ultimaFechaLogin: Date | null;
}
