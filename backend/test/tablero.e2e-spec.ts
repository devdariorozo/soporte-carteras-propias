import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { crearApp } from './utils/crear-app.js';

type Metodo = 'get' | 'post';

/**
 * Tablero: contrato de `/api/tablero/kpis` con el Super Administrador sembrado y la regla de que
 * su permiso solo se asigna a Super Administrador y Administrador. Corre contra la BD de desarrollo.
 */
describe('Tablero (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;

  beforeAll(async () => {
    app = await crearApp();
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usuario: process.env.SEED_SUPERADMIN_DOCUMENTO, password: process.env.SEED_SUPERADMIN_PASSWORD })
      .expect(201);
    token = login.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = (metodo: Metodo, ruta: string) => request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${token}`);

  it('sin fechas devuelve el mes actual con el contrato completo', async () => {
    const respuesta = await auth('get', '/api/tablero/kpis').expect(200);
    const { rango, resumen, porIntegrante, topNovedades } = respuesta.body.data;
    expect(rango.fechaInicio).toMatch(/^\d{4}-\d{2}-01$/);
    expect(resumen).toHaveProperty('tasaExito');
    expect(resumen.total).toBe(resumen.completados + resumen.errores + resumen.pendientes);
    expect(Array.isArray(porIntegrante)).toBe(true);
    expect(topNovedades.length).toBeLessThanOrEqual(10);
  });

  it('rechaza un rango invertido o mayor a 366 días', async () => {
    await auth('get', '/api/tablero/kpis').query({ fechaInicio: '2026-09-10', fechaFin: '2026-09-01' }).expect(400);
    await auth('get', '/api/tablero/kpis').query({ fechaInicio: '2024-01-01', fechaFin: '2026-01-01' }).expect(400);
  });

  it('no permite asignar el Tablero a un rol distinto de Super Administrador y Administrador', async () => {
    const roles = await auth('get', '/api/roles/opciones').expect(200);
    const desarrollador = roles.body.data.find((rol: { rol: string }) => rol.rol === 'Desarrollador(a)');
    await auth('post', '/api/permisos').send({ idRol: desarrollador.id, menu: 'Tablero', permiso: 'Consultar' }).expect(403);
  });
});
