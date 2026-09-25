import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseTitle } from '../common/decorators/response-title.decorator.js';
import { Public } from '../common/auth/public.decorator.js';

@ApiTags('Sistema')
@Controller('health')
@ResponseTitle('Sistema')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Healthcheck del servicio' })
  check() {
    return {
      message: 'Servicio disponible.',
      data: { status: 'ok', timestamp: new Date().toISOString() },
    };
  }
}
