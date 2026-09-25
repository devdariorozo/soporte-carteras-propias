import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * En móvil (< 768px, ver `.tabla-responsiva` en styles.scss) cada fila de la tabla se muestra
 * como tarjeta "Columna: valor" en vez de obligar a desplazarse a lo ancho. Para eso copia el
 * título de cada columna (`thead th`) en el `data-label` de su celda, y lo repite cada vez que
 * cambian las filas (paginación, filtros, fila expandida).
 */
@Directive({
  selector: 'p-table[appTablaResponsiva]',
  host: { class: 'tabla-responsiva' },
})
export class TablaResponsivaDirective implements AfterViewInit, OnDestroy {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private observador?: MutationObserver;

  ngAfterViewInit(): void {
    this.etiquetar();
    // Solo cambios de nodos: poner `data-label` (atributo) no vuelve a disparar el observador.
    this.observador = new MutationObserver(() => this.etiquetar());
    this.observador.observe(this.elemento.nativeElement, { childList: true, subtree: true });
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  private etiquetar(): void {
    const raiz = this.elemento.nativeElement;
    const titulos = Array.from(raiz.querySelectorAll('thead th'), (th) => th.textContent?.trim() ?? '');
    raiz.querySelectorAll('tbody > tr').forEach((fila) => {
      Array.from(fila.children).forEach((celda, indice) => {
        // Una celda que ocupa varias columnas (fila expandida, "sin registros") no lleva título.
        const titulo = celda.hasAttribute('colspan') ? '' : (titulos[indice] ?? '');
        if (celda.getAttribute('data-label') !== titulo) {
          celda.setAttribute('data-label', titulo);
        }
      });
    });
  }
}
