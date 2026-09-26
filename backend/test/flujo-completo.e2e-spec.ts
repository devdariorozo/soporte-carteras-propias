import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { crearApp } from './utils/crear-app.js';

type Metodo = 'get' | 'post' | 'patch' | 'delete';

/**
 * Flujo completo de extremo a extremo (Fase 7): login -> novedad -> registrar y
 * ejecutar un caso de soporte -> confirmar que aparece en informes y en el tablero. Corre contra la
 * base de datos real de desarrollo (mismo criterio que `app.e2e-spec.ts`), usando el
 * Super Administrador sembrado (`SEED_SUPERADMIN_*`) y una versión de prueba de la
 * configuración `mysql` que apunta a la propia base del proyecto (sin depender de un
 * servidor de carteras externo). Al terminar se elimina esa versión y se reactiva la
 * configuración `mysql` que estaba activa antes de la prueba.
 */
describe('Flujo completo (e2e)', () => {
  let app: INestApplication<App>;
  let token: string;
  const idsALimpiar = { novedad: 0, configuracion: 0, soporte: 0, mysqlAnterior: 0 };

  beforeAll(async () => {
    app = await crearApp();

    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ usuario: process.env.SEED_SUPERADMIN_DOCUMENTO, password: process.env.SEED_SUPERADMIN_PASSWORD })
      .expect(201);
    token = login.body.data.accessToken;
  });

  const auth = (metodo: Metodo, ruta: string) => request(app.getHttpServer())[metodo](ruta).set('Authorization', `Bearer ${token}`);

  afterAll(async () => {
    if (idsALimpiar.soporte) {
      await auth('delete', `/api/soporte/${idsALimpiar.soporte}`);
    }
    if (idsALimpiar.configuracion) {
      await auth('delete', `/api/configuracion/${idsALimpiar.configuracion}`);
    }
    if (idsALimpiar.mysqlAnterior) {
      await auth('patch', `/api/configuracion/${idsALimpiar.mysqlAnterior}`).send({ estadoRegistro: 1 });
    }
    if (idsALimpiar.novedad) {
      await auth('delete', `/api/novedades/${idsALimpiar.novedad}`);
    }
    await app.close();
  });

  it('registra una novedad, un caso de soporte, lo ejecuta y aparece en informes', async () => {
    const novedad = await auth('post', '/api/novedades')
      .send({ novedad: 'CLIENTE REPORTA CASO DE PRUEBA E2E FASE 7.' })
      .expect(201);
    idsALimpiar.novedad = novedad.body.data.id;

    const configuraciones = await auth('get', '/api/configuracion').query({ limit: 100 }).expect(200);
    const mysqlActiva = configuraciones.body.data.find(
      (c: { nombre: string; estadoRegistro: number }) => c.nombre === 'mysql' && c.estadoRegistro === 1,
    );
    idsALimpiar.mysqlAnterior = mysqlActiva?.id ?? 0;

    const configuracion = await auth('post', '/api/configuracion')
      .send({
        nombre: 'mysql',
        alcance: 'Todas',
        objeto: {
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT),
          database: process.env.DB_NAME,
          username: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
        },
        descripcion: 'Conexión de prueba e2e.',
      })
      .expect(201);
    idsALimpiar.configuracion = configuracion.body.data.id;

    const soporte = await auth('post', '/api/soporte')
      .send({
        cliente: 'cliente prueba e2e',
        idNovedad: idsALimpiar.novedad,
        mensajeWhatsapp: 'mensaje de prueba e2e fase 7',
        motor: 'mysql',
        sentencia: `SELECT COUNT(*) AS total FROM ${process.env.DB_NAME}.roles;`,
      })
      .expect(201);
    idsALimpiar.soporte = soporte.body.data.id;
    expect(soporte.body.data.estadoSoporte).toBe('Creado');

    const ejecucion = await auth('post', `/api/soporte/${idsALimpiar.soporte}/ejecutar`).expect(201);
    expect(ejecucion.body.data.estadoSoporte).toBe('Completado');
    expect(ejecucion.body.data.descripcion).toContain('la novedad fue resuelta correctamente');

    const informes = await auth('get', '/api/informes').query({ limit: 50 }).expect(200);
    const encontrado = informes.body.data.find((r: { id: number }) => r.id === idsALimpiar.soporte);
    expect(encontrado).toBeDefined();
    expect(encontrado.estadoSoporte).toBe('Completado');

    const tablero = await auth('get', '/api/tablero/kpis').query({ idNovedad: idsALimpiar.novedad }).expect(200);
    expect(tablero.body.data.resumen.completados).toBeGreaterThanOrEqual(1);
    expect(tablero.body.data.topNovedades[0].idNovedad).toBe(idsALimpiar.novedad);
  }, 20_000);
});
