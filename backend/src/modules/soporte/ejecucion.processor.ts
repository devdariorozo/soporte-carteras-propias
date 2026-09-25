import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SoporteService } from './soporte.service.js';
import { COLA_EJECUCION_SENTENCIAS, EjecucionSentenciaJob } from './ejecucion.constants.js';

/**
 * Corre la ejecución real de la sentencia contra el servidor de las carteras propias
 * (ver planing/07-infraestructura.md, "Colas (Redis)") — `concurrency: 1` serializa el
 * acceso a las conexiones compartidas (`configuracion.nombre = soporte.motor`)
 * (planing/03-modelo-datos.md).
 */
@Injectable()
@Processor(COLA_EJECUCION_SENTENCIAS, { concurrency: 1 })
export class EjecucionProcessor extends WorkerHost {
  constructor(private readonly soporteService: SoporteService) {
    super();
  }

  async process(job: Job<EjecucionSentenciaJob>): Promise<void> {
    await this.soporteService.procesarEjecucion(job.data.soporteId, job.data.idUsuario);
  }
}
