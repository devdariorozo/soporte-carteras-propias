import { Body, Controller, Headers, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../../common/decorators/response-title.decorator.js';
import { Public } from '../../common/auth/public.decorator.js';
import { Roles } from '../../common/auth/roles.decorator.js';
import { AllowDuringForcedPasswordChange } from '../../common/auth/allow-password-change.decorator.js';
import { CurrentUser } from '../../common/auth/current-user.decorator.js';
import type { AccessTokenPayload } from '../../common/auth/jwt-payload.interface.js';
import { NombreRol } from '../roles/rol.entity.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { CambiarPasswordDto } from './dto/cambiar-password.dto.js';
import { RecuperarPasswordDto } from './dto/recuperar-password.dto.js';
import { ResetearPasswordAsistidoDto } from './dto/resetear-password-asistido.dto.js';

@ApiTags('Login')
@Controller('auth')
@ResponseTitle('Login')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión con usuario (documento) y contraseña.' })
  @ApiHeader({
    name: 'user-agent',
    required: false,
    description: 'La envía el navegador automáticamente — no hace falta completarla a mano (se usa para registrar tipo de equipo/navegador/SO del login).',
  })
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto, userAgent);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renueva el access token a partir de un refresh token vigente.' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('recuperar-password')
  @ApiOperation({ summary: 'Recupera la contraseña cruzando usuario + secreto.' })
  recuperarPassword(@Body() dto: RecuperarPasswordDto) {
    return this.authService.recuperarPassword(dto);
  }

  @AllowDuringForcedPasswordChange()
  @ApiBearerAuth()
  @Post('cambiar-password')
  @ApiOperation({ summary: 'Cambia la contraseña (obligatorio en primer acceso o tras un reseteo asistido).' })
  cambiarPassword(@CurrentUser() user: AccessTokenPayload, @Body() dto: CambiarPasswordDto) {
    return this.authService.cambiarPassword(user.sub, dto);
  }

  @Roles(NombreRol.SUPER_ADMINISTRADOR, NombreRol.ADMINISTRADOR)
  @ApiBearerAuth()
  @Post('resetear-password/:idUsuario')
  @ApiOperation({ summary: 'Reseteo asistido: asigna una contraseña temporal (solo Super Administrador/Administrador).' })
  resetearPasswordAsistido(
    @CurrentUser() admin: AccessTokenPayload,
    @Param('idUsuario', ParseIntPipe) idUsuario: number,
    @Body() dto: ResetearPasswordAsistidoDto,
  ) {
    return this.authService.resetearPasswordAsistido(idUsuario, dto.passwordTemporal, admin.sub, admin);
  }

  @AllowDuringForcedPasswordChange()
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Cierra la sesión activa (invalida el JWT de inmediato).' })
  logout(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.logout(user.sub);
  }
}
