import { Column, Entity } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';

@Entity('menu')
export class Menu extends AuditableBaseEntity {
  @Column({ name: 'apartado', type: 'varchar', length: 45 })
  apartado: string;

  @Column({ name: 'menu', type: 'varchar', length: 45, unique: true })
  menu: string;

  @Column({ name: 'ruta', type: 'varchar', length: 150, unique: true })
  ruta: string;

  @Column({ name: 'icono', type: 'varchar', length: 45 })
  icono: string;

  @Column({ name: 'orden', type: 'int', unique: true })
  orden: number;
}
