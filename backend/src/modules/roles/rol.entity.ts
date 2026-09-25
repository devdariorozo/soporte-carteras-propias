import { Column, Entity } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';

export enum NombreRol {
  SUPER_ADMINISTRADOR = 'Super Administrador',
  ADMINISTRADOR = 'Administrador',
  DESARROLLADOR = 'Desarrollador(a)',
  APRENDIZ_SENA = 'Aprendiz Sena',
}

@Entity('roles')
export class Rol extends AuditableBaseEntity {
  @Column({ name: 'rol', type: 'varchar', length: 45 })
  rol: string;
}
