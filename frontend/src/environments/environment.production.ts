/**
 * Mismo origen que la app: nginx reenvía /api al contenedor `api` (ver nginx.conf), así la
 * misma imagen funciona en dev, QA y PRO sin conocer la URL del servidor.
 */
export const environment = {
  apiUrl: '',
};
