import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { DEFAULT_LIMIT, DEFAULT_PAGE, buildPaginationBlock } from '../../common/envelope/envelope.util.js';
import { PaginacionQueryDto } from '../../common/dto/paginacion-query.dto.js';
import { asignarDefinidos } from '../../common/utils/asignar-definidos.util.js';
import { adjuntarResponsables, nombreCompleto } from '../../common/utils/responsable.util.js';
import { capitalizarPrimeraLetra } from '../../common/utils/texto.util.js';
import { Usuario } from './usuario.entity.js';
import { Actor, exigirJerarquia, puedeGestionarRol, rolesVisibles } from '../../common/auth/jerarquia-roles.util.js';
import { CrearUsuarioDto } from './dto/crear-usuario.dto.js';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto.js';

const TITULO = 'Usuarios';
const BCRYPT_ROUNDS = 10;
const MENSAJE_DUPLICADO = 'Ya existe un usuario con ese número de documento o correo.';

/** Nunca se devuelven `password`/`secreto`/`refreshToken` en las respuestas (ver planing/03-modelo-datos.md). */
export type UsuarioPublico = Omit<Usuario, 'password' | 'secreto' | 'refreshToken'>;

@Injectable()
export class UsuariosService {
  constructor(@InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>) {}

  async create(dto: CrearUsuarioDto, idUsuario: number, actor: Actor) {
    this.validarAlcance(dto.idRol, actor);
    const { passwordTemporal, descripcion, ...datos } = dto;
    const usuario = this.usuarios.create({
      ...datos,
      primerNombre: capitalizarPrimeraLetra(datos.primerNombre),
      segundoNombre: datos.segundoNombre ? capitalizarPrimeraLetra(datos.segundoNombre) : null,
      primerApellido: capitalizarPrimeraLetra(datos.primerApellido),
      segundoApellido: datos.segundoApellido ? capitalizarPrimeraLetra(datos.segundoApellido) : null,
      password: await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS),
      secreto: null,
      debeCambiarPassword: 1,
      idUsuario,
      descripcion: descripcion ?? null,
      estadoRegistro: 1,
    });

    const guardado = await this.guardarOFallarPorDuplicado(usuario);
    return { message: 'Usuario creado correctamente.', data: this.sanitizar(guardado) };
  }

  /** Solo usuarios de roles del nivel del actor hacia abajo — los de arriba ni se listan. */
  async findAll(query: PaginacionQueryDto, actor: Actor) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const [data, total] = await this.usuarios.findAndCount({
      where: { idRol: rolesVisibles(actor) },
      skip: (page - 1) * limit,
      take: limit,
      order: { id: 'DESC' },
      relations: { rolRef: true },
    });
    const conResponsable = await adjuntarResponsables(this.usuarios, data);
    return { data: conResponsable.map((usuario) => this.sanitizar(usuario)), pagination: buildPaginationBlock(total, page, limit) };
  }

  async findOne(id: number, actor: Actor) {
    const usuario = await this.obtenerOFallar(id);
    if (!puedeGestionarRol(actor, usuario.idRol)) {
      throw new NotFoundException({ title: TITULO, message: 'Usuario no encontrado.' });
    }
    return { data: this.sanitizar(usuario) };
  }

  async update(id: number, dto: ActualizarUsuarioDto, idUsuario: number, actor: Actor) {
    const usuario = await this.obtenerOFallar(id);
    this.validarAlcance(usuario.idRol, actor);
    this.validarAlcance(dto.idRol, actor);
    asignarDefinidos(usuario, dto);
    if (dto.primerNombre !== undefined) usuario.primerNombre = capitalizarPrimeraLetra(dto.primerNombre);
    if (dto.segundoNombre !== undefined) usuario.segundoNombre = capitalizarPrimeraLetra(dto.segundoNombre);
    if (dto.primerApellido !== undefined) usuario.primerApellido = capitalizarPrimeraLetra(dto.primerApellido);
    if (dto.segundoApellido !== undefined) usuario.segundoApellido = capitalizarPrimeraLetra(dto.segundoApellido);
    usuario.idUsuario = idUsuario;
    const guardado = await this.guardarOFallarPorDuplicado(usuario);
    return { message: 'Usuario actualizado correctamente.', data: this.sanitizar(guardado) };
  }

  async remove(id: number, idUsuario: number, actor: Actor) {
    const usuario = await this.obtenerOFallar(id);
    this.validarAlcance(usuario.idRol, actor);
    await this.usuarios.update(id, { estadoRegistro: 0, idUsuario, descripcion: 'Eliminado.' });
    await this.usuarios.softDelete(id);
    return { message: 'Usuario eliminado correctamente.' };
  }

  /** Solo usuarios de roles de su nivel hacia abajo, y solo puede asignarles esos roles. */
  private validarAlcance(idRol: number | undefined, actor: Actor): void {
    exigirJerarquia(actor, idRol, TITULO, 'No puedes gestionar usuarios de un rol por encima del tuyo.');
  }

  async opciones(actor: Actor) {
    const usuarios = await this.usuarios.find({
      where: { estadoRegistro: 1, idRol: rolesVisibles(actor) },
      select: ['id', 'primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'],
      order: { primerNombre: 'ASC' },
    });
    return { data: usuarios.map((u) => ({ id: u.id, nombreCompleto: nombreCompleto(u) })) };
  }

  private sanitizar(usuario: Usuario): UsuarioPublico {
    const { password: _password, secreto: _secreto, refreshToken: _refreshToken, ...publico } = usuario;
    return publico;
  }

  private async guardarOFallarPorDuplicado(usuario: Usuario): Promise<Usuario> {
    try {
      return await this.usuarios.save(usuario);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException({ title: TITULO, message: MENSAJE_DUPLICADO });
      }
      throw error;
    }
  }

  private async obtenerOFallar(id: number): Promise<Usuario> {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) {
      throw new NotFoundException({ title: TITULO, message: 'Usuario no encontrado.' });
    }
    return usuario;
  }
}
