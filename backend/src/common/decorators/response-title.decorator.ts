import { SetMetadata } from '@nestjs/common';

export const RESPONSE_TITLE_KEY = 'response_title';

export const ResponseTitle = (title: string): MethodDecorator & ClassDecorator =>
  SetMetadata(RESPONSE_TITLE_KEY, title);
