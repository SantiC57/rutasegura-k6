// PRUEBA DE PICOS (spike test)
// Objetivo: observar el efecto de una llegada repentina de muchos usuarios, cuánto
// se degrada el servicio durante el pico y cómo se comporta después de reducirlo.
//
// Ejecutar:  k6 run k6/03-picos.js
// Pico distinto: k6 run -e PICO=250 k6/03-picos.js

// Reutiliza flujo, monitorización, SLO y creación del resumen compartidos.
import { viajero, monitorServidor, prepararPrueba, cerrarPrueba } from './lib/flujo.js';
import { SLO, ESCENARIO_MONITOR, TREND_STATS } from './lib/config.js';
import { crearResumen } from './lib/resumen.js';

// Número de VUs objetivo durante el pico; se puede cambiar al ejecutar con -e PICO=...
const PICO = parseInt(__ENV.PICO || '150', 10);

export const options = {
  // Incluye percentiles altos para detectar aumentos de latencia en una parte
  // de las peticiones, aunque el promedio no parezca elevado.
  summaryTrendStats: TREND_STATS,
  scenarios: {
    viajeros: {
      // Es un perfil de concurrencia: los VUs aumentan y disminuyen según las
      // etapas, y cada uno ejecuta el flujo de usuario.
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 5 }, // establece una línea base de baja concurrencia
        { duration: '10s', target: PICO }, // incremento abrupto hasta el pico
        { duration: '1m', target: PICO }, // mantiene el pico para observar su impacto
        { duration: '10s', target: 5 }, // reduce abruptamente a la línea base
        { duration: '2m', target: 5 }, // periodo para observar si se recuperan las métricas
      ],
      // Permite que los VUs que se retiran completen su iteración brevemente.
      gracefulRampDown: '10s',
    },
    // El perfil de viajeros suma 4m20s; el monitor dura 4m30s para muestrear
    // también el cierre del pico y la recuperación.
    monitor: { ...ESCENARIO_MONITOR, duration: '4m30s' },
  },
  // Registra los SLO globales y por endpoint para evaluar tanto el pico como
  // la línea base y el periodo posterior; no se configuran abortos tempranos.
  thresholds: SLO,
};

// Preparación común: revisa salud de la API, reinicia métricas y captura valores iniciales.
export function setup() {
  return prepararPrueba();
}

export default function () {
  // Usa el comportamiento normal del viajero; la intensidad del pico la controla
  // el número de VUs de las etapas, no una variante del flujo.
  viajero();
}

// Función llamada cada 5 s por el escenario auxiliar de monitorización.
export { monitorServidor };

// Imprime métricas iniciales y finales para valorar si el sistema se recuperó.
export function teardown(datos) {
  cerrarPrueba(datos);
}

// Genera los archivos de evidencia identificados como "picos".
export const handleSummary = crearResumen('picos');
