import { Component, computed, input } from '@angular/core';
import { NivelPassword, REQUISITOS_PASSWORD, nivelPassword } from '../../core/validators/password-strength';

const NIVELES: Record<NivelPassword, { etiqueta: string; segmentos: number; color: string; texto: string }> = {
  debil: { etiqueta: 'Débil', segmentos: 1, color: 'bg-red-500', texto: 'text-red-600' },
  media: { etiqueta: 'Media', segmentos: 2, color: 'bg-amber-500', texto: 'text-amber-600' },
  fuerte: { etiqueta: 'Fuerte', segmentos: 3, color: 'bg-green-500', texto: 'text-green-600' },
};

/**
 * Control visual único para todo campo de contraseña nueva: medidor Débil / Media /
 * Fuerte y la lista de requisitos, marcando en vivo cuáles se cumplen.
 */
@Component({
  selector: 'app-password-fortaleza',
  templateUrl: './password-fortaleza.component.html',
})
export class PasswordFortalezaComponent {
  readonly valor = input<string | null>('');

  protected readonly segmentos = [1, 2, 3];
  private readonly texto = computed(() => this.valor() ?? '');

  protected readonly nivel = computed(() => (this.texto() ? NIVELES[nivelPassword(this.texto())] : null));
  protected readonly requisitos = computed(() =>
    REQUISITOS_PASSWORD.map((requisito) => ({ etiqueta: requisito.etiqueta, cumple: requisito.cumple(this.texto()) })),
  );
}
