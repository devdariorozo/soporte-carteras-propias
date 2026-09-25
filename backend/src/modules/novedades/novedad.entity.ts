import { Column, Entity } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';

@Entity('novedades')
export class Novedad extends AuditableBaseEntity {
  @Column({ name: 'novedad', type: 'varchar', length: 45 })
  novedad: string;
}
