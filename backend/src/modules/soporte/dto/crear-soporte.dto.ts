import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { MotorSoporte } from '../soporte.entity.js';

export class CrearSoporteDto {
  @ApiProperty({ example: 'PEPE PEREZ' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cliente: string;

  @ApiProperty({ description: 'Id de la novedad (catálogo) que categoriza el caso.', example: 1 })
  @IsInt()
  idNovedad: number;

  @ApiProperty({ example: 'Buenas tardes, mi promesa de pago no se refleja en el aplicativo.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  mensajeWhatsapp: string;

  @ApiProperty({ enum: MotorSoporte, description: 'Conexión (configuracion.nombre) contra la que se ejecuta la sentencia.', example: MotorSoporte.MYSQL })
  @IsEnum(MotorSoporte)
  motor: MotorSoporte;

  @ApiProperty({
    description:
      'Sentencia SQL tal cual se va a ejecutar, ya calificada con esquema.tabla: solo UPDATE con WHERE o solo INSERT INTO tabla (columnas) VALUES (...), sin mezclarlos.',
    example: "UPDATE miosv2_falabella_2024.promises SET estado = 'pagada' WHERE id = 123;",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(5000)
  sentencia: string;
}
