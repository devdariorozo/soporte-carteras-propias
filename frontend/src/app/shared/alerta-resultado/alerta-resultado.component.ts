import { Component, computed, input, output } from '@angular/core';

export type TipoAlerta = 'exito' | 'error' | 'advertencia' | 'info';

/**
 * Fondo sólido del color del tipo (verde éxito, rojo error, amarillo advertencia, azul info) y
 * contenido claro encima, para que el mensaje se distinga del resto de la pantalla. Igual en
 * tema claro y oscuro.
 */
/** `boton`: mismo color en un tono más claro, y más claro aún al pasar el mouse. */
const ESTILOS: Record<TipoAlerta, { icono: string; caja: string; boton: string }> = {
  exito: {
    icono: 'pi-check-circle',
    caja: 'border-green-700 bg-green-600',
    boton: 'border-green-300 bg-green-500 hover:bg-green-400',
  },
  error: {
    icono: 'pi-times-circle',
    caja: 'border-red-700 bg-red-600',
    boton: 'border-red-300 bg-red-500 hover:bg-red-400',
  },
  advertencia: {
    icono: 'pi-exclamation-triangle',
    caja: 'border-yellow-700 bg-yellow-600',
    boton: 'border-yellow-300 bg-yellow-500 hover:bg-yellow-400',
  },
  info: {
    icono: 'pi-info-circle',
    caja: 'border-blue-700 bg-blue-600',
    boton: 'border-blue-300 bg-blue-500 hover:bg-blue-400',
  },
};

/**
 * Resultado de una acción: ícono principal centrado arriba y el mensaje debajo. La primera
 * línea del mensaje se muestra como título (los mensajes del backend separan título y detalle con "\n").
 */
@Component({
  selector: 'app-alerta-resultado',
  template: `
    <div class="relative flex flex-col items-center gap-2 rounded-lg border p-4 text-center text-white" [class]="estilo().caja" role="alert">
      @if (copiable()) {
        <button
          type="button"
          class="absolute right-2 top-2 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium text-white shadow-sm transition-colors duration-200 ease-out"
          [class]="estilo().boton"
          aria-label="Copiar mensaje"
          (click)="copiar.emit(mensaje() ?? '')"
        >
          <i class="pi pi-copy"></i> Copiar
        </button>
      }
      <i class="pi text-4xl text-white/95" [class]="estilo().icono + (copiable() ? ' mt-6' : '')"></i>
      @if (titulo()) {
        <p class="font-semibold">{{ titulo() }}</p>
      }
      @if (detalle()) {
        <p class="whitespace-pre-line text-sm text-white/90">{{ detalle() }}</p>
      }
    </div>
  `,
})
export class AlertaResultadoComponent {
  readonly tipo = input.required<TipoAlerta>();
  readonly mensaje = input<string | null>('');
  /** Muestra el ícono Copiar arriba a la derecha; quien usa la alerta decide qué hacer en `copiar`. */
  readonly copiable = input(false);
  readonly copiar = output<string>();

  protected readonly estilo = computed(() => ESTILOS[this.tipo()]);
  private readonly lineas = computed(() => (this.mensaje() ?? '').split('\n'));
  protected readonly titulo = computed(() => (this.lineas().length > 1 ? this.lineas()[0] : ''));
  protected readonly detalle = computed(() => (this.lineas().length > 1 ? this.lineas().slice(1).join('\n') : this.lineas()[0]));
}
