import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: '1111111111', description: 'Número de documento (usuario de login).' })
  @IsString()
  @IsNotEmpty()
  usuario: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
