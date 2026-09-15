/**
 * js/engine/ColorCodeEngine.js
 * Motor de Conversión y Decodificación de Código de Colores de Resistores (Norma EIA-RS-279).
 * 
 * Soporta cálculo bidireccional:
 * - Valor en Ohmios (Ω) ➔ 4 Bandas de Color (Dígito 1, Dígito 2, Multiplicador, Tolerancia)
 * - 4 Bandas de Color ➔ Valor en Ohmios y rango de tolerancia
 */

export const COLOR_TABLE = {
  black:  { name: 'Negro',    digit: 0, mult: 1,      multExp: 0,  hex: '#18181b', textDark: false },
  brown:  { name: 'Marrón',   digit: 1, mult: 10,     multExp: 1,  hex: '#854d0e', textDark: false },
  red:    { name: 'Rojo',     digit: 2, mult: 100,    multExp: 2,  hex: '#dc2626', textDark: false },
  orange: { name: 'Naranja',  digit: 3, mult: 1000,   multExp: 3,  hex: '#ea580c', textDark: false },
  yellow: { name: 'Amarillo', digit: 4, mult: 10000,  multExp: 4,  hex: '#eab308', textDark: true },
  green:  { name: 'Verde',    digit: 5, mult: 100000, multExp: 5,  hex: '#16a34a', textDark: false },
  blue:   { name: 'Azul',     digit: 6, mult: 1000000,multExp: 6,  hex: '#2563eb', textDark: false },
  violet: { name: 'Violeta',  digit: 7, mult: 10000000,multExp: 7, hex: '#9333ea', textDark: false },
  gray:   { name: 'Gris',     digit: 8, mult: 100000000,multExp: 8,hex: '#64748b', textDark: false },
  white:  { name: 'Blanco',   digit: 9, mult: 1000000000,multExp: 9,hex: '#f8fafc',textDark: true },
  gold:   { name: 'Dorado',   digit: null, mult: 0.1, multExp: -1, tol: 5,  hex: '#d97706', textDark: false },
  silver: { name: 'Plateado', digit: null, mult: 0.01,multExp: -2, tol: 10, hex: '#94a3b8', textDark: false }
};

export class ColorCodeEngine {
  /**
   * Convierte un valor de resistencia en Ohmios a sus 4 bandas de color normalizadas.
   * @param {number} ohms - Resistencia en Ohmios
   * @param {number} [tolerance=5] - Tolerancia porcentual (5% dorado por defecto)
   * @returns {Object} Desglose con dígitos, multiplicador, nombres y colores HEX
   */
  static getBandsFromValue(ohms, tolerance = 5) {
    const val = Math.max(0.1, Number(ohms) || 10);
    
    // Normalizar a notación científica: N.NNN x 10^exp
    const strVal = val.toExponential(1); // ej. "1.0e+1" para 10
    const [mantissaStr, expStr] = strVal.split('e');
    const mantissa = parseFloat(mantissaStr);
    const totalExp = parseInt(expStr, 10);

    // Los dos primeros dígitos significativos
    const mantissaTwoDigits = Math.round(mantissa * 10); // ej. 1.0 * 10 = 10
    const d1 = Math.floor(mantissaTwoDigits / 10);
    const d2 = mantissaTwoDigits % 10;
    const multExp = totalExp - 1; // Multiplicador de potencia

    // Encontrar colores
    const digitKeys = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray', 'white'];
    
    const band1Key = digitKeys[d1] || 'black';
    const band2Key = digitKeys[d2] || 'black';
    
    let band3Key = 'black';
    if (multExp === -1) band3Key = 'gold';
    else if (multExp === -2) band3Key = 'silver';
    else if (multExp >= 0 && multExp <= 9) band3Key = digitKeys[multExp];
    else band3Key = 'black';

    let band4Key = tolerance === 10 ? 'silver' : (tolerance === 1 ? 'brown' : 'gold');

    const b1 = COLOR_TABLE[band1Key];
    const b2 = COLOR_TABLE[band2Key];
    const b3 = COLOR_TABLE[band3Key];
    const b4 = COLOR_TABLE[band4Key];

    return {
      ohms: val,
      d1,
      d2,
      multExp,
      tolerance,
      bands: [
        { position: 1, role: '1er Dígito', key: band1Key, name: b1.name, hex: b1.hex, value: d1 },
        { position: 2, role: '2do Dígito', key: band2Key, name: b2.name, hex: b2.hex, value: d2 },
        { position: 3, role: 'Multiplicador', key: band3Key, name: b3.name, hex: b3.hex, value: `x10^${multExp}` },
        { position: 4, role: 'Tolerancia', key: band4Key, name: b4.name, hex: b4.hex, value: `±${tolerance}%` }
      ],
      hexColors: [b1.hex, b2.hex, b3.hex, b4.hex],
      formattedValue: ColorCodeEngine.formatOhms(val)
    };
  }

  /**
   * Convierte 4 bandas seleccionadas a valor en Ohmios.
   * @param {string} b1Key - Clave de color 1
   * @param {string} b2Key - Clave de color 2
   * @param {string} b3Key - Clave de color 3
   * @param {string} b4Key - Clave de color 4 (tolerancia)
   */
  static getValueFromBands(b1Key, b2Key, b3Key, b4Key = 'gold') {
    const c1 = COLOR_TABLE[b1Key] || COLOR_TABLE.black;
    const c2 = COLOR_TABLE[b2Key] || COLOR_TABLE.black;
    const c3 = COLOR_TABLE[b3Key] || COLOR_TABLE.black;
    const c4 = COLOR_TABLE[b4Key] || COLOR_TABLE.gold;

    const d1 = c1.digit !== null ? c1.digit : 0;
    const d2 = c2.digit !== null ? c2.digit : 0;
    const baseVal = d1 * 10 + d2;
    const mult = c3.mult !== undefined ? c3.mult : 1;
    const ohms = baseVal * mult;
    const tol = c4.tol || 5;

    const minVal = ohms * (1 - tol / 100);
    const maxVal = ohms * (1 + tol / 100);

    return {
      ohms,
      tolerancePercent: tol,
      minOhms: Number(minVal.toFixed(2)),
      maxOhms: Number(maxVal.toFixed(2)),
      formattedValue: ColorCodeEngine.formatOhms(ohms),
      hexColors: [c1.hex, c2.hex, c3.hex, c4.hex]
    };
  }

  /**
   * Formatea un valor numérico a sufijos de ingeniería (Ω, kΩ, MΩ).
   * @param {number} ohms 
   * @returns {string}
   */
  static formatOhms(ohms) {
    if (ohms >= 1e6) {
      return `${(ohms / 1e6).toFixed(ohms % 1e6 === 0 ? 0 : 2)} MΩ`;
    }
    if (ohms >= 1e3) {
      return `${(ohms / 1e3).toFixed(ohms % 1e3 === 0 ? 0 : 2)} kΩ`;
    }
    return `${ohms.toFixed(ohms % 1 === 0 ? 0 : 2)} Ω`;
  }
}
