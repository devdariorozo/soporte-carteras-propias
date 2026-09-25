import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { crearApp } from './utils/crear-app.js';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await crearApp();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'success') {
          throw new Error('Expected envelope status to be success');
        }
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
