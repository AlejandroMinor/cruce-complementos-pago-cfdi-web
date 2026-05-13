Herramienta web para cruzar facturas CFDI 4.0 con sus complementos de pago.

**[Abrir herramienta](https://alejandrominor.github.io/cruce-complementos-pago-cfdi-web/)**

Simple y directo. Todo corre en el navegador, sin almacenar nada en nubes ni servidores externos.

## El problema

Tienes tus facturas en una carpeta y los complementos de pago en otra. No sabes cuál factura ya tiene su complemento y cuál no. Esta herramienta hace el cruce por ti y te muestra qué factura corresponde a qué complemento.


## Notas

- **Los archivos se procesan en tu computadora — no se suben a ningún servidor.**
- El repo Python con la versión CLI está en [cruce-complementos-pago-cfdi](https://github.com/alejandrominor/cruce-complementos-pago-cfdi).
- Las facturas deben ser tipo `I` (Ingreso) y los complementos tipo `P` (Pago).
- Tipos de comprobante: catálogo `c_TipoDeComprobante` del Anexo 20 SAT → sección "Catálogos CFDI versión 4.0" → Excel → hoja `c_TipoDeComprobante`
  http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm
