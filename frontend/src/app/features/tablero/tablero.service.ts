import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ResponseEnvelope } from '../../core/envelope.model';
import { MotorSoporte } from '../../core/utils/motor.util';
import { KpisTablero } from './tablero.model';

export interface FiltrosTablero {
  fechaInicio: string | null;
  fechaFin: string | null;
  idUsuario: number[];
  motor: MotorSoporte[];
  idNovedad: number[];
}

export interface OpcionIntegrante {
  id: number;
  nombreCompleto: string;
}

@Injectable({ providedIn: 'root' })
export class TableroService {
  private readonly http = inject(HttpClient);

  kpis(filtros: FiltrosTablero): Observable<ResponseEnvelope<KpisTablero>> {
    return this.http.get<ResponseEnvelope<KpisTablero>>('/api/tablero/kpis', { params: construirParams(filtros) });
  }

  integrantes(): Observable<ResponseEnvelope<OpcionIntegrante[]>> {
    return this.http.get<ResponseEnvelope<OpcionIntegrante[]>>('/api/tablero/usuarios');
  }
}

/** Arreglos como parámetros repetidos (`?idUsuario=1&idUsuario=2`), igual que Informes. */
export function construirParams(filtros: FiltrosTablero): HttpParams {
  let params = new HttpParams();
  if (filtros.fechaInicio) params = params.set('fechaInicio', filtros.fechaInicio);
  if (filtros.fechaFin) params = params.set('fechaFin', filtros.fechaFin);
  for (const id of filtros.idUsuario) params = params.append('idUsuario', id);
  for (const motor of filtros.motor) params = params.append('motor', motor);
  for (const id of filtros.idNovedad) params = params.append('idNovedad', id);
  return params;
}
