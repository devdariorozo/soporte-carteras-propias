import { Column, Entity } from 'typeorm';
import { AuditableBaseEntity } from '../../common/entities/auditable.base-entity.js';

@Entity('configuracion')
export class Configuracion extends AuditableBaseEntity {
  @Column({ name: 'nombre', type: 'varchar', length: 45 })
  nombre: string;

  /** A qué bases aplica (ej. `Todas`, `Base Raiz`) — texto del select Motor de Soporte. */
  @Column({ name: 'alcance', type: 'varchar', length: 45 })
  alcance: string;

  /** JSON plano (sin cifrar) — pares clave/valor libres administrados desde el CRUD. */
  @Column({ name: 'objeto', type: 'json' })
  objeto: Record<string, unknown>;
}
