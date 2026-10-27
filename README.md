# Presupuesto Comunitario

Calculadora local de presupuestos en soles (PEN), con céntimos enteros, categorías, contingencia explícita y saldo disponible. Versión inicial 0.1.0. Los importes de demostración son ficticios: no representan precios de mercado o financiación real.

## Usar

Node 22 o 24, sin dependencias externas o conexión de red.

```sh
git clone https://github.com/Richardsch1/presupuesto-comunitario.git
cd presupuesto-comunitario
npm ci --ignore-scripts
node bin/cli.js calculate --input examples/presupuesto.json
node bin/cli.js calculate --input examples/presupuesto.json --format csv
```

Los resultados se escriben a stdout. El JSON original no cambia. Para guardar una salida, redirígela a un archivo nuevo. No se envía información, se consultan cuentas ni se mueve dinero.

## Contrato y redondeo

La raíz requiere exactamente `title`, `currency: "PEN"`, `fundingPEN`, `contingencyBps` e `items`. Cada rubro incluye `id`, `description`, `category`, `quantity` y `unitPricePEN`. Consulta [el ejemplo](examples/presupuesto.json).

- Importes y cantidades son **cadenas**, como `"12.30"` y `"1.5"`; no se aceptan números JSON, comas o notación científica.
- Los precios y fondos admiten hasta dos decimales y nueve dígitos enteros.
- Las cantidades son positivas, hasta un millón y tres decimales.
- Se calcula cada rubro con BigInt y se redondea al céntimo, con mitades hacia arriba. Después se suman los rubros.
- La contingencia usa puntos básicos: 1000 significa 10 %. Se calcula sobre el subtotal y se redondea de la misma forma. No hay impuestos automáticos.
- El resultado JSON expresa los céntimos como cadenas para no perder precisión. Incluye saldo, posible déficit y totales por categoría.

Un máximo de doscientos rubros y archivos de hasta un MiB. Categorías: `materiales`, `servicios`, `transporte`, `otros`. Identificadores únicos. El CSV incluye totales y neutraliza posibles fórmulas de hoja de cálculo.

```js
import { calculateBudget, formatPEN } from './src/index.js';
// input sigue el contrato del ejemplo; no uses datos bancarios o personales.
const result = calculateBudget(input);
console.log(formatPEN(result.totalCents));
```

## Límites

Es aritmética sobre datos proporcionados. No verifica cotizaciones, disponibilidad, aportes, contratos o requisitos contables. No es asesoría financiera, fiscal ni de contratación. Revisa unidades, cantidades, redondeo y precios antes de tomar decisiones.

No introduzcas nombres, datos bancarios, DNI o recibos. Se rechazan campos adicionales y algunos patrones sensibles; eso no garantiza detectar todos los datos personales. Los archivos y salidas son locales y no están cifrados.

## Verificación

```sh
npm run check
npm test
```

Pruebas de decimales, cantidades fraccionarias, redondeo, contingencia, déficit, importes grandes, CSV y CLI. CI en Node 22 y 24. [MIT](LICENSE), [contribuir](CONTRIBUTING.md), [seguridad](SECURITY.md). No se afirma uso o impacto validado ni elegibilidad garantizada para Claude for OSS.
