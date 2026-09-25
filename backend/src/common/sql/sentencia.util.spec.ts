import { describe, expect, it } from 'vitest';
import { validarSentencia } from './sentencia.util.js';

const INSERT_MYSQL = `--  Auto-generated SQL script #202609251040
INSERT INTO miosv2_carteras_QA.campaign_users (campaign_id,user_id,is_active,user_admin)
	VALUES (1,1111,1,1);`;

const INSERT_POSTGRES = `-- Auto-generated SQL script #202609251024
INSERT INTO tenant_bbva.clients (first_name,second_name,first_last_name,second_last_name,identification,city_id,regional,judicial_status,management_state)
	VALUES ('usuario','de','pruebas','desarrollo','12322556566565',21,'MOSQUERA','comercializado'::tenant_bbva."clients_judicial_status_enum",'147');`;

describe('validarSentencia', () => {
  describe('INSERT limpio', () => {
    it('acepta el INSERT de MySQL y toma la base de la tabla', () => {
      const r = validarSentencia(INSERT_MYSQL, 'mysql');
      expect(r.mensaje).toBeNull();
      expect(r.sentencias).toHaveLength(1);
      expect(r.bases).toEqual(['miosv2_carteras_QA']);
    });

    it('acepta el INSERT de PostgreSQL con cast a enum', () => {
      const r = validarSentencia(INSERT_POSTGRES, 'postgres');
      expect(r.mensaje).toBeNull();
      expect(r.bases).toEqual(['']);
    });

    it('acepta varios INSERT y varias filas en un VALUES', () => {
      const sql = `INSERT INTO miosv2_x.a (id) VALUES (1);
        INSERT INTO miosv2_x.a (id, nombre) VALUES (2, 'b'), (3, 'c; d');`;
      const r = validarSentencia(sql, 'mysql');
      expect(r.mensaje).toBeNull();
      expect(r.sentencias).toHaveLength(2);
    });

    it('acepta funciones en los valores', () => {
      expect(validarSentencia('INSERT INTO miosv2_x.a (id, fecha) VALUES (1, NOW());', 'mysql').valida).toBe(true);
    });
  });

  describe('INSERT con riesgo', () => {
    const casos: [string, string, 'mysql' | 'postgres', string][] = [
      ['INSERT ... SELECT', 'INSERT INTO miosv2_x.a (id) SELECT id FROM miosv2_x.b;', 'mysql', 'SELECT'],
      ['subconsulta en VALUES', 'INSERT INTO miosv2_x.a (id) VALUES ((SELECT MAX(id) FROM miosv2_x.a));', 'mysql', 'SELECT'],
      ['ON DUPLICATE KEY UPDATE', 'INSERT INTO miosv2_x.a (id, n) VALUES (1, 2) ON DUPLICATE KEY UPDATE n = 3;', 'mysql', 'ON DUPLICATE'],
      ['ON CONFLICT DO UPDATE', "INSERT INTO tenant_x.a (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 2;", 'postgres', 'ON CONFLICT'],
      ['ON CONFLICT DO NOTHING', 'INSERT INTO tenant_x.a (id) VALUES (1) ON CONFLICT DO NOTHING;', 'postgres', 'ON CONFLICT'],
      ['INSERT IGNORE', 'INSERT IGNORE INTO miosv2_x.a (id) VALUES (1);', 'mysql', 'IGNORE'],
      ['REPLACE INTO', 'REPLACE INTO miosv2_x.a (id) VALUES (1);', 'mysql', 'REPLACE'],
      ['RETURNING', 'INSERT INTO tenant_x.a (id) VALUES (1) RETURNING *;', 'postgres', 'RETURNING'],
      ['sin lista de columnas', "INSERT INTO miosv2_x.a VALUES (1, 'a');", 'mysql', 'lista de columnas'],
      ['INSERT ... SET', 'INSERT INTO miosv2_x.a SET id = 1;', 'mysql', 'lista de columnas'],
      ['sin INTO', 'INSERT miosv2_x.a (id) VALUES (1);', 'mysql', 'INSERT INTO'],
      ['DEFAULT VALUES', 'INSERT INTO tenant_x.a DEFAULT VALUES;', 'postgres', 'lista de columnas'],
    ];
    it.each(casos)('rechaza %s', (_nombre, sql, motor, esperado) => {
      const r = validarSentencia(sql, motor);
      expect(r.valida).toBe(false);
      expect(r.mensaje).toContain(esperado);
    });

    it('rechaza el INSERT sin base/esquema', () => {
      const r = validarSentencia('INSERT INTO campaign_users (id) VALUES (1);', 'mysql');
      expect(r.mensaje).toContain('base.tabla');
    });

    it('rechaza el INSERT de PostgreSQL con el motor MySQL', () => {
      expect(validarSentencia(INSERT_POSTGRES, 'mysql').mensaje).toContain('parece de PostgreSQL');
    });
  });

  describe('mezcla de tipos', () => {
    it('rechaza INSERT y UPDATE en la misma solicitud', () => {
      const sql = `INSERT INTO miosv2_x.a (id) VALUES (1);
        UPDATE miosv2_x.a SET n = 0 WHERE id = 2;`;
      const r = validarSentencia(sql, 'mysql');
      expect(r.valida).toBe(false);
      expect(r.mensaje).toContain('No se pueden mezclar');
    });

    it('rechaza UPDATE seguido de INSERT en PostgreSQL', () => {
      const sql = `UPDATE tenant_x.a SET n = 0 WHERE id = 2;
        INSERT INTO tenant_x.a (id) VALUES (1);`;
      expect(validarSentencia(sql, 'postgres').mensaje).toContain('No se pueden mezclar');
    });
  });

  describe('UPDATE (sin cambios)', () => {
    it('acepta varios UPDATE con WHERE', () => {
      const sql = `UPDATE miosv2_x.a SET n = 0 WHERE id = 1;
        UPDATE miosv2_x.a SET n = 0 WHERE id = 2;`;
      expect(validarSentencia(sql, 'mysql').valida).toBe(true);
    });

    it('rechaza el UPDATE sin WHERE', () => {
      expect(validarSentencia('UPDATE miosv2_x.a SET n = 0;', 'mysql').mensaje).toContain('WHERE');
    });

    it('rechaza DELETE', () => {
      expect(validarSentencia('DELETE FROM miosv2_x.a WHERE id = 1;', 'mysql').mensaje).toContain('es un DELETE');
    });
  });
});
