import { readFile } from 'node:fs/promises';
import { AddressInfo, Server, createServer } from 'node:net';
import { Client as SshClient } from 'ssh2';

export interface TunelSshConfig {
  host: string;
  port: number;
  usuario: string;
  /** `SSH_KEY_PATH` de backend/.env: ruta real en tradicional; en Docker, la del volumen montado. */
  rutaLlave: string | undefined;
  passphrase?: string;
}

export interface TunelSsh {
  /** Puerto local (127.0.0.1) que reenvía al destino a través del bastión. */
  puertoLocal: number;
  cerrar: () => Promise<void>;
}

/** Falla al abrir el túnel (no de la sentencia): llave, bastión o destino. */
export class ErrorTunelSsh extends Error {
  constructor(
    mensaje: string,
    readonly causa?: unknown,
  ) {
    super(mensaje);
  }
}

/**
 * Abre un túnel SSH hacia `destinoHost:destinoPort` a través de un bastión y lo expone en un
 * puerto local efímero, para que el driver se conecte como si la base estuviera en 127.0.0.1.
 * Un túnel por ejecución: quien lo abre siempre debe llamar a `cerrar()`.
 */
export async function abrirTunelSsh(
  config: TunelSshConfig,
  destinoHost: string,
  destinoPort: number,
  timeoutMs: number,
): Promise<TunelSsh> {
  if (!config.rutaLlave) {
    throw new ErrorTunelSsh('Falta SSH_KEY_PATH en backend/.env (ruta de la llave privada del bastión).');
  }
  let llave: Buffer;
  try {
    llave = await readFile(config.rutaLlave);
  } catch (error) {
    throw new ErrorTunelSsh('No se pudo leer la llave SSH. Revisa SSH_KEY_PATH en backend/.env.', error);
  }
  // En Docker, sin SSH_KEY_PATH el volumen monta /dev/null: el archivo existe pero está vacío.
  if (llave.length === 0) {
    throw new ErrorTunelSsh(
      'La llave SSH está vacía: define SSH_KEY_PATH en backend/.env y, con Docker, recrea api con --env-file backend/.env.',
    );
  }

  const ssh = new SshClient();
  try {
    await new Promise<void>((resolve, reject) => {
      ssh.once('ready', resolve).once('error', reject);
      ssh.connect({
        host: config.host,
        port: config.port,
        username: config.usuario,
        privateKey: llave,
        passphrase: config.passphrase || undefined,
        readyTimeout: timeoutMs,
      });
    });
  } catch (error) {
    ssh.end();
    throw new ErrorTunelSsh(`No se pudo conectar al bastión SSH: ${mensajeSsh(error)}`, error);
  }

  const servidor: Server = createServer((socket) => {
    ssh.forwardOut('127.0.0.1', 0, destinoHost, destinoPort, (error, canal) => {
      if (error) {
        socket.destroy(error);
        return;
      }
      socket.pipe(canal).pipe(socket);
      socket.on('error', () => canal.close());
      canal.on('error', () => socket.destroy());
    });
  });

  await new Promise<void>((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });

  return {
    puertoLocal: (servidor.address() as AddressInfo).port,
    // Primero la sesión SSH (cierra los canales abiertos); así `close` no queda esperando conexiones vivas.
    cerrar: async () => {
      ssh.end();
      await new Promise<void>((resolve) => servidor.close(() => resolve()));
    },
  };
}

function mensajeSsh(error: unknown): string {
  const nivel = (error as { level?: string } | null)?.level;
  if (nivel === 'client-authentication') {
    return 'el bastión rechazó la autenticación. Repórtalo al Super Administrador para que revise la conexión en Configuración.';
  }
  if (nivel === 'client-timeout') {
    return 'tiempo de espera agotado. Repórtalo al Super Administrador para que revise el bastión en Configuración.';
  }
  return error instanceof Error ? error.message : 'error desconocido.';
}
