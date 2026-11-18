// PRUEBA DE RESISTENCIA (soak / endurance test)
// Objetivo: mantener carga constante para detectar problemas acumulativos que pueden
// no aparecer en una prueba corta: crecimiento de memoria o colas y degradación gradual.
//
// La duración de clase predeterminada es 10 minutos; en un entorno real suele
// prolongarse bastante más para aumentar la probabilidad de observar tendencias.
//
// Ejecutar:               k6 run k6/04-resistencia.js
// Más tiempo:             k6 run -e DURACION=30m k6/04-resistencia.js

// Usa el mismo flujo y auxiliares de preparación, monitorización, cierre y resumen.
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { SLO, ESCENARIO_MONITOR, TREND_STATS } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

// Variables configurables desde la línea de comandos. DURACION debe tener
// formato reconocido por k6 (por ejemplo, 10m); VUS es la concurrencia estable.
const DURACION = __ENV.DURACION || '10m';
const VUS = parseInt(__ENV.VUS || '30', 10);

export const options = {
  // Solicita percentiles que ayudan a comparar latencias entre el inicio y el final.
  summaryTrendStats: TREND_STATS,
  scenarios: {
    viajeros: {
      // Mantiene el mismo número de VUs durante toda la duración, sin rampa
      // de carga: así se facilita observar cambios que aparecen con el tiempo.
      executor: 'constant-vus',
      vus: VUS,
      duration: DURACION,
    },
    // Muestrea la salud del servidor durante el mismo periodo de la prueba.
    monitor: { ...ESCENARIO_MONITOR, duration: DURACION },
  },
  thresholds: {
    // Además del conjunto de SLO, establece un límite específico de memoria.
    ...SLO,
    // Si la métrica muestreada supera este valor, el umbral falla al finalizar.
    // Es un límite observado durante el test, no una instrucción para detenerlo.
    servidor_heap_mb: ['value<150'],
  },
};

// Verifica que la API responda y limpia las métricas del servidor antes de medir.
export function setup() {
  return prepararPrueba();
}

export default function () {
  // Explora un rango amplio de páginas para producir búsquedas variadas y claves
  // distintas en la caché. La pausa habitual evita convertir la prueba en una
  // carga de máxima intensidad; el número concurrente se controla con VUS.
  viajero({ paginasBusqueda: 500, pausa: [1, 2] });
}

// Función llamada por el escenario auxiliar de monitorización.
export { monitorServidor };

// Compara al cierre los datos capturados antes de la carga con el estado final.
export function teardown(datos) {
  cerrarPrueba(datos);
}

// Guarda resumen y evidencia con el nombre "resistencia".
export const handleSummary = crearResumen('resistencia');
