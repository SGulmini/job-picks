// Server-side polyfills for pdfjs-dist when running in Node/serverless (e.g. Vercel).
// pdfjs-dist/legacy/build/pdf.mjs creates DOMMatrix instances at module init time.
// If DOMMatrix is missing, importing pdfjs-dist will crash before our route handlers run.

export {};

(() => {
  const g: any = globalThis as any;
  if (g.DOMMatrix) return;

  class DOMMatrixPolyfill {
    a: number; b: number; c: number; d: number; e: number; f: number;
    is2D = true;

    constructor(init?: any) {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
      if (!init) return;

      if (Array.isArray(init) || ArrayBuffer.isView(init)) {
        const arr = Array.from(init as any);
        if (arr.length >= 6) {
          this.a = Number(arr[0]) || 1;
          this.b = Number(arr[1]) || 0;
          this.c = Number(arr[2]) || 0;
          this.d = Number(arr[3]) || 1;
          this.e = Number(arr[4]) || 0;
          this.f = Number(arr[5]) || 0;
        }
        return;
      }

      if (typeof init === "object") {
        this.a = Number(init.a ?? this.a);
        this.b = Number(init.b ?? this.b);
        this.c = Number(init.c ?? this.c);
        this.d = Number(init.d ?? this.d);
        this.e = Number(init.e ?? this.e);
        this.f = Number(init.f ?? this.f);
      }
    }

    private _mul(o: DOMMatrixPolyfill) {
      const a = this.a * o.a + this.c * o.b;
      const b = this.b * o.a + this.d * o.b;
      const c = this.a * o.c + this.c * o.d;
      const d = this.b * o.c + this.d * o.d;
      const e = this.a * o.e + this.c * o.f + this.e;
      const f = this.b * o.e + this.d * o.f + this.f;
      this.a = a; this.b = b; this.c = c; this.d = d; this.e = e; this.f = f;
    }

    multiplySelf(other: any) {
      const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      this._mul(o);
      return this;
    }

    preMultiplySelf(other: any) {
      const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      const out = new DOMMatrixPolyfill(o);
      out._mul(this);
      this.a = out.a; this.b = out.b; this.c = out.c; this.d = out.d; this.e = out.e; this.f = out.f;
      return this;
    }

    translateSelf(tx = 0, ty = 0) {
      return this.multiplySelf({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });
    }

    scaleSelf(sx = 1, sy?: number) {
      const _sy = typeof sy === "number" ? sy : sx;
      return this.multiplySelf({ a: sx, b: 0, c: 0, d: _sy, e: 0, f: 0 });
    }
  }

  g.DOMMatrix = DOMMatrixPolyfill;
  g.DOMMatrixReadOnly = DOMMatrixPolyfill;
})();

