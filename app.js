/**
 * app.js
 * Motor Geotécnico de Estabilidad de Taludes (Método de Dovelas de Fellenius y Bishop)
 * Soporte completo para Nivel Freático (NAF), Medición de Áreas por 4 Métodos,
 * Visualización Reactiva SVG y Exportación a AutoCAD 1:1.
 * Autor: Ulianov Sabath Cuba Valencia (DNI: 72008081)
 */

import { generarDXFAutoCAD } from './dxfGenerator.js';

// =============================================================================
// ESTADO GLOBAL DE LA APLICACIÓN
// =============================================================================
const state = {
    // Parámetros Geotécnicos y Geométricos (Valores iniciales: Examen Ulianov C-2)
    h: 12.81,
    R: 20.81,
    m: 1.5,
    nDovelas: 6,
    gamma_h: 16.45,
    cohesion: 5.60,
    phi_deg: 29.0,

    // Nivel Freático (NAF)
    tieneNAF: false,
    nafTipo: 'horizontal', // 'horizontal' | 'inclinado'
    yNafPie: 6.0,
    yNafCresta: 8.5,
    gamma_sat: 18.50,
    gamma_w: 9.81,

    // Modo de cálculo de centro O
    modoCentro: 'romoacca', // 'romoacca' | 'angulos' | 'manual'
    xO_manual: 10.05,
    yO_manual: 18.22,
    thetaPie_deg: 30.0,
    thetaCorona_deg: 18.0,

    // Datos del Alumno y Docente
    alumno: "Ulianov Sabath Cuba Valencia",
    dni: "72008081",
    docente: "Ing. E. Romoacca",
    correoDocente: "eromoacca@continental.edu.pe",

    // Visualización
    mostrarFuerzas: true,
    mostrarCotas: true,
    mostrarRadios: true,
    zoomLevel: 1.0,
    selectedDovelaId: 1,

    // Modelo calculado
    modelo: null
};

// =============================================================================
// MOTOR MATEMÁTICO Y GEOTÉCNICO
// =============================================================================

/**
 * Resuelve el centro O(xO, yO) según la metodología seleccionada
 */
function calcularCentroO(h, R, m, nDovelas, modo) {
    if (modo === 'romoacca') {
        // En la guía Romoacca: el radio vertical separa las 2 dovelas pasivas de las 4 activas
        // => xO = 2b y xSalida - xO = 4b => xSalida = 6b
        // Ecuación exacta: 144 b^4 + 40 h^2 b^2 + (h^4 - 4 h^2 R^2) = 0
        const h2 = h * h;
        const R2 = R * R;
        const A_coeff = 144.0;
        const B_coeff = 40.0 * h2;
        const C_coeff = Math.pow(h, 4) - 4.0 * h2 * R2;

        const disc = B_coeff * B_coeff - 4.0 * A_coeff * C_coeff;
        if (disc >= 0) {
            const u = (-B_coeff + Math.sqrt(disc)) / (2.0 * A_coeff);
            if (u > 0) {
                const b = Math.sqrt(u);
                const xO = 2.0 * b;
                const yO = Math.sqrt(Math.max(0, R2 - 4.0 * b * b));
                const xSalida = 6.0 * b;
                return { xO, yO, xSalida, b, modo: 'romoacca' };
            }
        }
    } else if (modo === 'angulos') {
        // Variante con theta_pie = 30° sobre la pendiente del talud
        const beta_rad = Math.atan(1.0 / m);
        const theta_pie_rad = (state.thetaPie_deg * Math.PI) / 180.0;
        const theta_horiz = beta_rad + theta_pie_rad;
        const xO = R * Math.cos(theta_horiz);
        const yO = R * Math.sin(theta_horiz);
        const arg = Math.max(0, R * R - Math.pow(yO - h, 2));
        const xSalida = xO + Math.sqrt(arg);
        const b = xSalida / nDovelas;
        return { xO, yO, xSalida, b, modo: 'angulos' };
    }

    // Modo Manual o fallback
    const xO = state.xO_manual;
    const yO = state.yO_manual;
    const arg = Math.max(0, R * R - Math.pow(yO - h, 2));
    const xSalida = xO + Math.sqrt(arg);
    const b = xSalida / nDovelas;
    return { xO, yO, xSalida, b, modo: 'manual' };
}

/**
 * Calcula la cota de la superficie del terreno y de la falla en una abscisa x
 */
function getTerrenoY(x, h, m) {
    if (x <= 0) return 0.0;
    const xCresta = m * h;
    if (x >= xCresta) return h;
    return x / m;
}

function getFallaY(x, xO, yO, R) {
    const dx = x - xO;
    const arg = Math.max(0, R * R - dx * dx);
    return yO - Math.sqrt(arg);
}

function getNafY(x, xSalida) {
    if (!state.tieneNAF) return -9999.0;
    if (state.nafTipo === 'horizontal') {
        return state.yNafPie;
    } else {
        const t = Math.max(0, Math.min(1, x / xSalida));
        return state.yNafPie + t * (state.yNafCresta - state.yNafPie);
    }
}

/**
 * Calcula el área exacta por integración numérica compuesta (trapecios de alta resolución)
 */
function calcularAreaExacta(x1, x2, h, m, xO, yO, R, nPasos = 500) {
    const dx = (x2 - x1) / nPasos;
    let suma = 0.0;
    for (let i = 0; i <= nPasos; i++) {
        const x = x1 + i * dx;
        const ySup = getTerrenoY(x, h, m);
        const yInf = getFallaY(x, xO, yO, R);
        const alt = Math.max(0, ySup - yInf);
        const weight = (i === 0 || i === nPasos) ? 0.5 : 1.0;
        suma += weight * alt;
    }
    return suma * dx;
}

/**
 * Calcula el área saturada Asat (bajo el NAF y sobre la superficie de falla)
 */
function calcularAreaSaturada(x1, x2, h, m, xO, yO, R, xSalida, nPasos = 500) {
    if (!state.tieneNAF) return 0.0;
    const dx = (x2 - x1) / nPasos;
    let suma = 0.0;
    for (let i = 0; i <= nPasos; i++) {
        const x = x1 + i * dx;
        const ySup = getTerrenoY(x, h, m);
        const yInf = getFallaY(x, xO, yO, R);
        const yNaf = getNafY(x, xSalida);

        const yTechoSat = Math.min(ySup, Math.max(yInf, yNaf));
        const altSat = Math.max(0, yTechoSat - yInf);
        const weight = (i === 0 || i === nPasos) ? 0.5 : 1.0;
        suma += weight * altSat;
    }
    return suma * dx;
}

/**
 * Construye polígono de la dovela para dibujo SVG y exportación DXF
 */
function construirPoligonoDovela(x1, x2, h, m, xO, yO, R, nArc = 60) {
    const pts = [];
    const xCresta = m * h;

    // 1. Arco inferior (de izquierda a derecha)
    for (let k = 0; k <= nArc; k++) {
        const x = x1 + (k / nArc) * (x2 - x1);
        const y = getFallaY(x, xO, yO, R);
        pts.push([x, y]);
    }

    // 2. Techo superior (de derecha a izquierda)
    pts.push([x2, getTerrenoY(x2, h, m)]);
    if (x1 < xCresta && xCresta < x2) {
        pts.push([xCresta, h]);
    }
    pts.push([x1, getTerrenoY(x1, h, m)]);

    return pts;
}

/**
 * Ejecuta el análisis geotécnico completo
 */
export function calcularModeloCompleto() {
    const h = parseFloat(state.h);
    const R = parseFloat(state.R);
    const m = parseFloat(state.m);
    const nDovelas = parseInt(state.nDovelas);
    const gamma_h = parseFloat(state.gamma_h);
    const gamma_sat = state.tieneNAF ? parseFloat(state.gamma_sat) : 0.0;
    const cohesion = parseFloat(state.cohesion);
    const phi_deg = parseFloat(state.phi_deg);
    const phi_rad = (phi_deg * Math.PI) / 180.0;
    const gamma_w = parseFloat(state.gamma_w);

    const xCresta = m * h;
    const geomCentro = calcularCentroO(h, R, m, nDovelas, state.modoCentro);
    const xO = geomCentro.xO;
    const yO = geomCentro.yO;
    const xSalida = geomCentro.xSalida;
    const B = xSalida;
    const b = B / nDovelas;

    const dovelas = [];
    let sumArea = 0.0;
    let sumW = 0.0;
    let sumMR = 0.0;
    let sumM = 0.0;

    for (let i = 0; i < nDovelas; i++) {
        const id = i + 1;
        const xizq = i * b;
        const xder = (i + 1) * b;
        const xmed = (xizq + xder) / 2.0;

        // Brazo ai respecto al centro O (Fórmula Romoacca / cuaderno de clase)
        let ai;
        if (state.modoCentro === 'romoacca' && nDovelas === 6) {
            ai = (i - 1.5) * b;
        } else {
            ai = xmed - xO;
        }

        const sinAlpha = Math.max(-0.9999, Math.min(0.9999, ai / R));
        const alpha_rad = Math.asin(sinAlpha);
        const alpha_deg = (alpha_rad * 180.0) / Math.PI;
        const cosAlpha = Math.cos(alpha_rad);
        const dl = b / cosAlpha;

        // Alturas laterales y central
        const yinf_izq = getFallaY(xizq, xO, yO, R);
        const ysup_izq = getTerrenoY(xizq, h, m);
        const hizq = Math.max(0, ysup_izq - yinf_izq);

        const yinf_med = getFallaY(xmed, xO, yO, R);
        const ysup_med = getTerrenoY(xmed, h, m);
        const hmed = Math.max(0, ysup_med - yinf_med);

        const yinf_der = getFallaY(xder, xO, yO, R);
        const ysup_der = getTerrenoY(xder, h, m);
        const hder = Math.max(0, ysup_der - yinf_der);

        // Áreas por 4 métodos
        const A_cad = calcularAreaExacta(xizq, xder, h, m, xO, yO, R);
        const A_trap = 0.5 * (hizq + hder) * b;
        const A_med = hmed * b;
        const A_simp = (b / 6.0) * (hizq + 4.0 * hmed + hder);

        // Nivel Freático y Presión de Poros
        let Asat = 0.0;
        let Ah = A_cad;
        let hw_izq = 0.0;
        let hw_der = 0.0;
        let hw_prom = 0.0;
        let u = 0.0;

        if (state.tieneNAF) {
            Asat = calcularAreaSaturada(xizq, xder, h, m, xO, yO, R, xSalida);
            Ah = Math.max(0, A_cad - Asat);

            const yNaf_i = getNafY(xizq, xSalida);
            const yNaf_d = getNafY(xder, xSalida);
            hw_izq = Math.max(0, Math.min(ysup_izq, yNaf_i) - yinf_izq);
            hw_der = Math.max(0, Math.min(ysup_der, yNaf_d) - yinf_der);
            hw_prom = 0.5 * (hw_izq + hw_der);
            u = hw_prom * gamma_w;
        }

        // Peso de la dovela
        const W = Ah * gamma_h + Asat * gamma_sat;

        // Método de Fellenius (Guía del Docente)
        // MR = [c * dl + (W * cos(alpha) - u * dl * cos^2(alpha)) * tan(phi)]
        const u_term = u * dl * Math.pow(cosAlpha, 2);
        const N_eff = Math.max(0, W * cosAlpha - u_term);
        const MR = cohesion * dl + N_eff * Math.tan(phi_rad);
        const M = W * Math.sin(alpha_rad);

        const polyPts = construirPoligonoDovela(xizq, xder, h, m, xO, yO, R);

        dovelas.push({
            id,
            xizq, xder, xmed,
            yinf_izq, ysup_izq,
            yinf_med, ysup_med,
            yinf_der, ysup_der,
            hizq, hmed, hder,
            b, ai, alpha: alpha_deg, alpha_rad, dl,
            A_cad, A_trap, A_med, A_simp,
            Ah, Asat,
            hw_izq, hw_der, hw_prom, u,
            W, N_eff,
            MR, M,
            polyPts
        });

        sumArea += A_cad;
        sumW += W;
        sumMR += MR;
        sumM += M;
    }

    // Factor de Seguridad Fellenius
    const FS_Fellenius = sumM > 0 ? sumMR / sumM : 999.0;

    // Factor de Seguridad Bishop Simplificado (Iterativo)
    let FS_Bishop = FS_Fellenius;
    for (let iter = 0; iter < 40; iter++) {
        let numerador = 0.0;
        for (const d of dovelas) {
            const ub = d.u * d.b;
            const tanAlpha = Math.tan(d.alpha_rad);
            const m_alpha = Math.cos(d.alpha_rad) * (1.0 + (tanAlpha * Math.tan(phi_rad)) / FS_Bishop);
            if (m_alpha > 0.001) {
                numerador += (cohesion * d.b + (d.W - ub) * Math.tan(phi_rad)) / m_alpha;
            }
        }
        const FS_nuevo = sumM > 0 ? numerador / sumM : 999.0;
        if (Math.abs(FS_nuevo - FS_Bishop) < 0.0005) {
            FS_Bishop = FS_nuevo;
            break;
        }
        FS_Bishop = 0.5 * (FS_Bishop + FS_nuevo);
    }

    // Puntos de la línea del NAF para dibujo
    let nafPts = [];
    if (state.tieneNAF) {
        const xNafStart = 0;
        const xNafEnd = xSalida + 3.0;
        nafPts = [
            [xNafStart, getNafY(xNafStart, xSalida)],
            [xSalida, getNafY(xSalida, xSalida)],
            [xNafEnd, getNafY(xNafEnd, xSalida)]
        ];
    }

    const modelo = {
        h, R, m, nDovelas,
        gamma_h, gamma_sat, cohesion, phi_deg, phi_rad, gamma_w,
        xCresta, xSalida, B, b,
        xO, yO,
        dovelas,
        sumArea, sumW, sumMR, sumM,
        FS_Fellenius,
        FS_Bishop,
        tieneNAF: state.tieneNAF,
        nafPts
    };

    state.modelo = modelo;
    return modelo;
}

// =============================================================================
// RENDERIZADOR SVG REACTIVO DE ALTA RESOLUCIÓN
// =============================================================================

export function renderizarSVG() {
    const svgEl = document.getElementById('taludSvg');
    if (!svgEl || !state.modelo) return;

    const m = state.modelo;
    const h = m.h;
    const xSalida = m.xSalida;
    const xO = m.xO;
    const yO = m.yO;
    const R = m.R;

    // Definición de límites y sistema de coordenadas
    const xMin = -7.0;
    const xMax = Math.max(xSalida + 8.0, 36.0);
    const yMin = -6.5;
    const yMax = Math.max(yO + 4.5, h + 8.0);

    const worldW = xMax - xMin;
    const worldH = yMax - yMin;

    const svgW = 1000;
    const svgH = 580;

    // Transformación mundo a pixeles SVG
    function toSvgX(x) {
        return ((x - xMin) / worldW) * svgW;
    }

    function toSvgY(y) {
        return svgH - ((y - yMin) / worldH) * svgH;
    }

    let inner = '';

    // 1. REJILLA TÉCNICA SUAVE (GRID ESTILO CAD)
    inner += `<defs>
        <pattern id="gridCad" width="${toSvgX(xMin + 2) - toSvgX(xMin)}" height="${toSvgY(yMin) - toSvgY(yMin + 2)}" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 100 0 100 100 0 100 Z" fill="none" stroke="#f1f5f9" stroke-width="0.8"/>
        </pattern>
        <marker id="arrowRed" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
        <marker id="arrowBlue" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
        </marker>
        <marker id="arrowGreen" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#16a34a" />
        </marker>
    </defs>`;

    inner += `<rect width="${svgW}" height="${svgH}" fill="#ffffff"/>`;
    inner += `<rect width="${svgW}" height="${svgH}" fill="url(#gridCad)" />`;

    // 2. DOVELAS CON ACHURADO Y COLORES DIFERENCIADOS
    m.dovelas.forEach(d => {
        const isPassive = d.ai < 0;
        const isSelected = d.id === state.selectedDovelaId;

        let fillColor;
        if (isSelected) {
            fillColor = 'rgba(234, 179, 8, 0.45)';
        } else if (isPassive) {
            fillColor = 'rgba(245, 158, 11, 0.18)'; // Ámbar suave (cuña pasiva)
        } else {
            fillColor = 'rgba(16, 185, 129, 0.16)'; // Esmeralda suave (zona activa)
        }

        const ptsStr = d.polyPts.map(p => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');

        inner += `<polygon points="${ptsStr}" fill="${fillColor}" stroke="${isSelected ? '#b45309' : '#334155'}" stroke-width="${isSelected ? '2.5' : '1.2'}" class="cursor-pointer transition-all hover:opacity-80" data-dovela-id="${d.id}"/>`;

        // Si hay NAF, dibujar relleno acuático saturado en la parte inferior
        if (m.tieneNAF && d.Asat > 0) {
            const ptsSat = [];
            // base de falla
            for (let k = 0; k <= 30; k++) {
                const x = d.xizq + (k / 30) * (d.xder - d.xizq);
                ptsSat.push([x, getFallaY(x, xO, yO, R)]);
            }
            // techo de agua
            ptsSat.push([d.xder, Math.min(getTerrenoY(d.xder, h, m.m), getNafY(d.xder, xSalida))]);
            ptsSat.push([d.xizq, Math.min(getTerrenoY(d.xizq, h, m.m), getNafY(d.xizq, xSalida))]);

            const ptsSatStr = ptsSat.map(p => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
            inner += `<polygon points="${ptsSatStr}" fill="rgba(59, 130, 246, 0.25)" stroke="#3b82f6" stroke-width="0.8" stroke-dasharray="3,2" pointer-events="none"/>`;
        }

        // Línea divisoria vertical
        inner += `<line x1="${toSvgX(d.xder)}" y1="${toSvgY(d.yinf_der)}" x2="${toSvgX(d.xder)}" y2="${toSvgY(d.ysup_der)}" stroke="#475569" stroke-width="1.2"/>`;

        // Texto Dovela en el centroide
        const xmSvg = toSvgX(d.xmed);
        const ymSvg = toSvgY(0.5 * (d.yinf_med + d.ysup_med));
        inner += `<text x="${xmSvg}" y="${ymSvg - 6}" font-size="12" font-weight="700" text-anchor="middle" fill="${isPassive ? '#b45309' : '#047857'}">D${d.id}</text>`;
        inner += `<text x="${xmSvg}" y="${ymSvg + 10}" font-size="10.5" font-weight="600" text-anchor="middle" fill="#1e293b">${d.A_cad.toFixed(2)}m²</text>`;
    });

    // 3. ARCO DE FALLA CIRCULAR (ROJO GEOTÉCNICO)
    let fallaD = `M ${toSvgX(0)} ${toSvgY(0)}`;
    for (let k = 1; k <= 80; k++) {
        const x = (k / 80) * xSalida;
        fallaD += ` L ${toSvgX(x)} ${toSvgY(getFallaY(x, xO, yO, R))}`;
    }
    inner += `<path d="${fallaD}" fill="none" stroke="#dc2626" stroke-width="3" />`;

    // 4. PERFIL DEL TERRENO (LÍNEA CONTINUA NEGRA GRUESA)
    const ptsTerreno = [
        toSvgX(-6.0), toSvgY(0.0),
        toSvgX(0.0), toSvgY(0.0),
        toSvgX(m.xCresta), toSvgY(h),
        toSvgX(xSalida + 5.0), toSvgY(h)
    ];
    inner += `<polyline points="${ptsTerreno[0]},${ptsTerreno[1]} ${ptsTerreno[2]},${ptsTerreno[3]} ${ptsTerreno[4]},${ptsTerreno[5]} ${ptsTerreno[6]},${ptsTerreno[7]}" fill="none" stroke="#0f172a" stroke-width="3.5"/>`;

    // 5. NIVEL FREÁTICO (NAF)
    if (m.tieneNAF && m.nafPts && m.nafPts.length > 1) {
        const x1 = toSvgX(m.nafPts[0][0]);
        const y1 = toSvgY(m.nafPts[0][1]);
        const x2 = toSvgX(m.nafPts[1][0]);
        const y2 = toSvgY(m.nafPts[1][1]);
        const x3 = toSvgX(m.nafPts[2][0]);
        const y3 = toSvgY(m.nafPts[2][1]);

        inner += `<polyline points="${x1},${y1} ${x2},${y2} ${x3},${y3}" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-dasharray="6,4"/>`;
        inner += `<text x="${toSvgX(xSalida * 0.75)}" y="${toSvgY(getNafY(xSalida * 0.75, xSalida)) - 8}" font-size="11" font-weight="700" fill="#2563eb">▼ N.A.F.</text>`;
    }

    // 6. CENTRO DE GIRO O Y RADIOS
    if (state.mostrarRadios) {
        const xOSvg = toSvgX(xO);
        const yOSvg = toSvgY(yO);
        const xPieSvg = toSvgX(0);
        const yPieSvg = toSvgY(0);
        const xSalidaSvg = toSvgX(xSalida);
        const ySalidaSvg = toSvgY(h);

        inner += `<line x1="${xOSvg}" y1="${yOSvg}" x2="${xPieSvg}" y2="${yPieSvg}" stroke="#1d4ed8" stroke-width="1.4" stroke-dasharray="4,3"/>`;
        inner += `<line x1="${xOSvg}" y1="${yOSvg}" x2="${xSalidaSvg}" y2="${ySalidaSvg}" stroke="#1d4ed8" stroke-width="1.4" stroke-dasharray="4,3"/>`;
        inner += `<line x1="${xOSvg}" y1="${toSvgY(yO + 2.5)}" x2="${xOSvg}" y2="${toSvgY(-3.5)}" stroke="#0284c7" stroke-width="1.4" stroke-dasharray="8,4,2,4"/>`;

        inner += `<circle cx="${xOSvg}" cy="${yOSvg}" r="5" fill="#dc2626" stroke="#ffffff" stroke-width="1.8"/>`;
        inner += `<text x="${xOSvg}" y="${yOSvg - 10}" font-size="12" font-weight="700" text-anchor="middle" fill="#1e3a8a">Centro O (${xO.toFixed(2)}, ${yO.toFixed(2)})</text>`;
        inner += `<text x="${(xOSvg + xPieSvg) / 2 - 15}" y="${(yOSvg + yPieSvg) / 2}" font-size="11" font-weight="600" fill="#1e3a8a">R = ${R.toFixed(2)} m</text>`;
    }

    // 7. VECTORES DE FUERZA (PESO W Y RESISTENCIA AL CORTE S)
    if (state.mostrarFuerzas) {
        m.dovelas.forEach(d => {
            const xmSvg = toSvgX(d.xmed);
            const ymSvg = toSvgY(0.5 * (d.yinf_med + d.ysup_med));
            const wLen = Math.min(45, Math.max(18, (d.W / m.sumW) * 160));

            // Vector Peso Wi (hacia abajo)
            inner += `<line x1="${xmSvg}" y1="${ymSvg}" x2="${xmSvg}" y2="${ymSvg + wLen}" stroke="#dc2626" stroke-width="1.8" marker-end="url(#arrowRed)"/>`;

            // Vector Fuerza Tangencial / Corte en la base
            const xBaseSvg = toSvgX(d.xmed);
            const yBaseSvg = toSvgY(d.yinf_med);
            const tLen = 22;
            const dxT = tLen * Math.cos(d.alpha_rad);
            const dyT = tLen * Math.sin(d.alpha_rad);

            inner += `<line x1="${xBaseSvg - dxT / 2}" y1="${yBaseSvg + dyT / 2}" x2="${xBaseSvg + dxT / 2}" y2="${yBaseSvg - dyT / 2}" stroke="#16a34a" stroke-width="1.6" marker-end="url(#arrowGreen)"/>`;
        });
    }

    // 8. COTAS LINEALES
    if (state.mostrarCotas) {
        // Cota de altura talud h
        const xCotaH = toSvgX(-3.5);
        const yCotaH0 = toSvgY(0);
        const yCotaH1 = toSvgY(h);
        inner += `<line x1="${xCotaH}" y1="${yCotaH0}" x2="${xCotaH}" y2="${yCotaH1}" stroke="#475569" stroke-width="1.3"/>`;
        inner += `<line x1="${xCotaH - 6}" y1="${yCotaH0}" x2="${xCotaH + 6}" y2="${yCotaH0}" stroke="#475569" stroke-width="1.3"/>`;
        inner += `<line x1="${xCotaH - 6}" y1="${yCotaH1}" x2="${xCotaH + 6}" y2="${yCotaH1}" stroke="#475569" stroke-width="1.3"/>`;
        inner += `<text x="${xCotaH - 10}" y="${(yCotaH0 + yCotaH1) / 2 + 4}" font-size="11.5" font-weight="700" text-anchor="end" fill="#334155">h = ${h.toFixed(2)} m</text>`;

        // Cota de ancho total B
        const yCotaB = toSvgY(-4.5);
        const xCotaB0 = toSvgX(0);
        const xCotaB1 = toSvgX(xSalida);
        inner += `<line x1="${xCotaB0}" y1="${yCotaB}" x2="${xCotaB1}" y2="${yCotaB}" stroke="#1e3a8a" stroke-width="1.4"/>`;
        inner += `<line x1="${xCotaB0}" y1="${yCotaB - 5}" x2="${xCotaB0}" y2="${yCotaB + 5}" stroke="#1e3a8a" stroke-width="1.4"/>`;
        inner += `<line x1="${xCotaB1}" y1="${yCotaB - 5}" x2="${xCotaB1}" y2="${yCotaB + 5}" stroke="#1e3a8a" stroke-width="1.4"/>`;
        inner += `<text x="${(xCotaB0 + xCotaB1) / 2}" y="${yCotaB + 16}" font-size="12" font-weight="700" text-anchor="middle" fill="#1e3a8a">Ancho total B = ${xSalida.toFixed(2)} m (b = ${m.b.toFixed(2)} m)</text>`;
    }

    svgEl.innerHTML = inner;

    // Agregar event listener para clicks en dovelas
    svgEl.querySelectorAll('polygon[data-dovela-id]').forEach(poly => {
        poly.addEventListener('click', (e) => {
            const dovId = parseInt(e.currentTarget.getAttribute('data-dovela-id'));
            seleccionarDovela(dovId);
        });
    });
}

/**
 * Selecciona una dovela y actualiza el inspector
 */
export function seleccionarDovela(id) {
    state.selectedDovelaId = id;
    renderizarSVG();
    actualizarInspectorDovela();
}

/**
 * Actualiza la tarjeta del Inspector de Dovela Individual
 */
function actualizarInspectorDovela() {
    const cardEl = document.getElementById('dovelaCard');
    if (!cardEl || !state.modelo) return;

    const d = state.modelo.dovelas.find(x => x.id === state.selectedDovelaId) || state.modelo.dovelas[0];
    if (!d) return;

    const errorTrap = Math.abs((d.A_trap - d.A_cad) / d.A_cad * 100).toFixed(1);
    const errorMed = Math.abs((d.A_med - d.A_cad) / d.A_cad * 100).toFixed(1);
    const errorSimp = Math.abs((d.A_simp - d.A_cad) / d.A_cad * 100).toFixed(1);

    cardEl.innerHTML = `
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${d.ai < 0 ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}">
                    Dovela N.° ${d.id} (${d.ai < 0 ? 'Cuña Pasiva' : 'Zona Activa'})
                </span>
                <span class="text-xs text-slate-500 ml-2">x: [${d.xizq.toFixed(2)} m → ${d.xder.toFixed(2)} m]</span>
            </div>
            <span class="text-sm font-black text-slate-800">${d.A_cad.toFixed(2)} m²</span>
        </div>

        <div class="grid grid-cols-3 gap-2 mt-3 text-center">
            <div class="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-[10px] text-slate-500 uppercase font-semibold">h. Izquierda</div>
                <div class="text-sm font-bold text-slate-800">${d.hizq.toFixed(2)} m</div>
            </div>
            <div class="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-[10px] text-slate-500 uppercase font-semibold">h. Media</div>
                <div class="text-sm font-bold text-amber-600">${d.hmed.toFixed(2)} m</div>
            </div>
            <div class="p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-[10px] text-slate-500 uppercase font-semibold">h. Derecha</div>
                <div class="text-sm font-bold text-slate-800">${d.hder.toFixed(2)} m</div>
            </div>
        </div>

        <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-100">
                <span class="text-slate-600">Brazo aᵢ al centro:</span>
                <span class="font-bold font-mono ${d.ai < 0 ? 'text-amber-700' : 'text-slate-800'}">${d.ai.toFixed(3)} m</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
                <span class="text-slate-600">Ángulo base αᵢ:</span>
                <span class="font-bold font-mono text-slate-800">${d.alpha.toFixed(2)}°</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
                <span class="text-slate-600">Longitud de base Δlᵢ:</span>
                <span class="font-bold font-mono text-slate-800">${d.dl.toFixed(2)} m</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100">
                <span class="text-slate-600">Peso total Wᵢ:</span>
                <span class="font-bold font-mono text-red-600">${d.W.toFixed(2)} kN/m</span>
            </div>
            ${state.tieneNAF ? `
            <div class="flex justify-between py-1 border-b border-slate-100 bg-blue-50/60 px-1.5 rounded">
                <span class="text-blue-700 font-semibold">Presión de poros uᵢ:</span>
                <span class="font-bold font-mono text-blue-800">${d.u.toFixed(2)} kPa (hw=${d.hw_prom.toFixed(2)}m)</span>
            </div>
            <div class="flex justify-between py-1 border-b border-slate-100 bg-blue-50/40 px-1.5 rounded">
                <span class="text-blue-600">Área sat. / húmeda:</span>
                <span class="font-bold font-mono text-blue-900">${d.Asat.toFixed(2)} m² / ${d.Ah.toFixed(2)} m²</span>
            </div>` : `
            <div class="flex justify-between py-1 border-b border-slate-100 bg-emerald-50 px-1.5 rounded">
                <span class="text-emerald-700 font-semibold">Nivel Freático:</span>
                <span class="font-bold font-mono text-emerald-800">NO HAY (u = 0.00 kPa, Asat = 0)</span>
            </div>`}
            <div class="flex justify-between py-1 border-b border-slate-100">
                <span class="text-slate-600">Momento Resistente M_R:</span>
                <span class="font-bold font-mono text-emerald-700">${d.MR.toFixed(2)} kN·m/m</span>
            </div>
            <div class="flex justify-between py-1">
                <span class="text-slate-600">Momento Actuante Mᵢ:</span>
                <span class="font-bold font-mono ${d.M < 0 ? 'text-amber-700' : 'text-red-700'}">${d.M.toFixed(2)} kN·m/m</span>
            </div>
        </div>

        <div class="mt-3.5 pt-3 border-t border-slate-200">
            <div class="text-[11px] font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Comparativa de Áreas:</div>
            <div class="grid grid-cols-2 gap-1.5 text-[11px]">
                <div class="p-1.5 bg-slate-100/80 rounded flex justify-between">
                    <span class="text-slate-600">AutoCAD Exacta:</span>
                    <span class="font-bold text-slate-900">${d.A_cad.toFixed(2)} m²</span>
                </div>
                <div class="p-1.5 bg-slate-50 rounded flex justify-between">
                    <span class="text-slate-600">Trapecio:</span>
                    <span class="font-mono">${d.A_trap.toFixed(2)} <span class="text-[10px] text-slate-400">(${errorTrap}%)</span></span>
                </div>
                <div class="p-1.5 bg-slate-50 rounded flex justify-between">
                    <span class="text-slate-600">Ord. Media:</span>
                    <span class="font-mono">${d.A_med.toFixed(2)} <span class="text-[10px] text-slate-400">(${errorMed}%)</span></span>
                </div>
                <div class="p-1.5 bg-purple-50 rounded flex justify-between border border-purple-200">
                    <span class="text-purple-700 font-semibold">Simpson 1/3:</span>
                    <span class="font-bold text-purple-900">${d.A_simp.toFixed(2)} <span class="text-[10px] text-purple-500">(${errorSimp}%)</span></span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Actualiza la Tabla Oficial de Fellenius en el DOM
 */
export function actualizarTablaDOM() {
    const tableBody = document.getElementById('tablaFelleniusBody');
    const tableFoot = document.getElementById('tablaFelleniusFoot');
    if (!tableBody || !state.modelo) return;

    const m = state.modelo;

    let rowsHtml = '';
    m.dovelas.forEach(d => {
        const isPass = d.ai < 0;
        rowsHtml += `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-200/80 ${d.id === state.selectedDovelaId ? 'bg-amber-50/60 font-semibold' : ''}">
                <td class="px-2.5 py-2 text-center font-bold ${isPass ? 'text-amber-800' : 'text-slate-800'}">
                    Dov. ${d.id}
                </td>
                <td class="px-2 py-2 text-center font-mono">${d.b.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono ${isPass ? 'text-amber-700' : 'text-slate-800'}">${d.alpha.toFixed(2)}°</td>
                <td class="px-2 py-2 text-center font-mono">${d.dl.toFixed(2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-slate-900">${d.Ah.toFixed(2)}</td>
                <td class="px-2 py-2 text-right font-mono ${d.Asat > 0 ? 'text-blue-700 font-bold' : 'text-slate-400'}">${d.Asat.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono text-slate-700">${m.gamma_h.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono ${m.tieneNAF ? 'text-blue-700 font-bold' : 'text-slate-400'}">${m.gamma_sat.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono">${m.cohesion.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono">${m.phi_deg.toFixed(1)}°</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-red-700">${d.W.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono ${d.hw_prom > 0 ? 'text-blue-700' : 'text-slate-400'}">${d.hw_prom.toFixed(2)}</td>
                <td class="px-2 py-2 text-center font-mono ${d.u > 0 ? 'text-blue-700 font-bold bg-blue-50/50' : 'text-slate-400'}">${d.u.toFixed(2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold text-emerald-700">${d.MR.toFixed(2)}</td>
                <td class="px-2.5 py-2 text-right font-mono font-bold ${d.M < 0 ? 'text-amber-700' : 'text-red-700'}">${d.M.toFixed(2)}</td>
            </tr>
        `;
    });
    tableBody.innerHTML = rowsHtml;

    if (tableFoot) {
        tableFoot.innerHTML = `
            <tr class="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                <td colspan="4" class="px-3 py-2.5 text-right uppercase tracking-wider text-xs">Sumatorias Totales:</td>
                <td class="px-2.5 py-2.5 text-right font-mono text-slate-900">${m.sumArea.toFixed(2)} m²</td>
                <td class="px-2 py-2.5 text-right font-mono text-blue-700">${m.dovelas.reduce((a, b) => a + b.Asat, 0).toFixed(2)}</td>
                <td colspan="4" class="px-2 py-2.5"></td>
                <td class="px-2.5 py-2.5 text-right font-mono text-red-700">${m.sumW.toFixed(2)}</td>
                <td colspan="2" class="px-2 py-2.5"></td>
                <td class="px-2.5 py-2.5 text-right font-mono text-emerald-700 text-sm">${m.sumMR.toFixed(2)}</td>
                <td class="px-2.5 py-2.5 text-right font-mono text-red-700 text-sm">${m.sumM.toFixed(2)}</td>
            </tr>
        `;
    }

    // Actualizar KPI Cards
    const kpiFsFell = document.getElementById('kpiFsFell');
    const kpiBadge = document.getElementById('kpiFsBadge');
    const kpiFsBishop = document.getElementById('kpiFsBishop');
    const kpiSumMR = document.getElementById('kpiSumMR');
    const kpiSumM = document.getElementById('kpiSumM');
    const kpiAreaTotal = document.getElementById('kpiAreaTotal');

    if (kpiFsFell) kpiFsFell.textContent = m.FS_Fellenius.toFixed(2);
    if (kpiFsBishop) kpiFsBishop.textContent = m.FS_Bishop.toFixed(2);
    if (kpiSumMR) kpiSumMR.textContent = m.sumMR.toFixed(2);
    if (kpiSumM) kpiSumM.textContent = m.sumM.toFixed(2);
    if (kpiAreaTotal) kpiAreaTotal.textContent = `${m.sumArea.toFixed(2)} m²`;

    if (kpiBadge) {
        if (m.FS_Fellenius >= 1.50) {
            kpiBadge.textContent = "ESTABLE (FS ≥ 1.50)";
            kpiBadge.className = "px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300";
        } else if (m.FS_Fellenius >= 1.00) {
            kpiBadge.textContent = "MARGINAL (1.00 ≤ FS < 1.50)";
            kpiBadge.className = "px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300";
        } else {
            kpiBadge.textContent = "INESTABLE (FS < 1.00)";
            kpiBadge.className = "px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 border border-red-300";
        }
    }
}

/**
 * Actualiza la tabla de comparación de métodos de área
 */
export function actualizarTablaAreasDOM() {
    const bodyEl = document.getElementById('tablaAreasBody');
    if (!bodyEl || !state.modelo) return;

    const m = state.modelo;
    let html = '';

    let sumCad = 0, sumTrap = 0, sumMed = 0, sumSimp = 0;

    m.dovelas.forEach(d => {
        sumCad += d.A_cad;
        sumTrap += d.A_trap;
        sumMed += d.A_med;
        sumSimp += d.A_simp;

        const errTrap = ((d.A_trap - d.A_cad) / d.A_cad * 100).toFixed(2);
        const errMed = ((d.A_med - d.A_cad) / d.A_cad * 100).toFixed(2);
        const errSimp = ((d.A_simp - d.A_cad) / d.A_cad * 100).toFixed(2);

        html += `
            <tr class="border-b border-slate-200 text-xs hover:bg-slate-50">
                <td class="py-2 px-3 font-bold text-center">Dovela ${d.id}</td>
                <td class="py-2 px-3 font-mono text-center font-bold text-slate-900">${d.A_cad.toFixed(2)} m²</td>
                <td class="py-2 px-3 font-mono text-center">${d.A_trap.toFixed(2)} <span class="text-[10px] text-slate-400 font-sans">(${errTrap > 0 ? '+' : ''}${errTrap}%)</span></td>
                <td class="py-2 px-3 font-mono text-center">${d.A_med.toFixed(2)} <span class="text-[10px] text-slate-400 font-sans">(${errMed > 0 ? '+' : ''}${errMed}%)</span></td>
                <td class="py-2 px-3 font-mono text-center font-semibold text-purple-700 bg-purple-50/40">${d.A_simp.toFixed(2)} <span class="text-[10px] text-purple-500 font-sans">(${errSimp > 0 ? '+' : ''}${errSimp}%)</span></td>
            </tr>
        `;
    });

    const totErrTrap = ((sumTrap - sumCad) / sumCad * 100).toFixed(2);
    const totErrMed = ((sumMed - sumCad) / sumCad * 100).toFixed(2);
    const totErrSimp = ((sumSimp - sumCad) / sumCad * 100).toFixed(2);

    html += `
        <tr class="bg-slate-100 font-black text-xs text-slate-900">
            <td class="py-2.5 px-3 text-center uppercase tracking-wider">TOTAL ($\sum A_i$)</td>
            <td class="py-2.5 px-3 font-mono text-center text-red-700 text-sm">${sumCad.toFixed(2)} m²</td>
            <td class="py-2.5 px-3 font-mono text-center">${sumTrap.toFixed(2)} m² (${totErrTrap}%)</td>
            <td class="py-2.5 px-3 font-mono text-center">${sumMed.toFixed(2)} m² (${totErrMed}%)</td>
            <td class="py-2.5 px-3 font-mono text-center text-purple-800 text-sm bg-purple-100/60">${sumSimp.toFixed(2)} m² (${totErrSimp}%)</td>
        </tr>
    `;

    bodyEl.innerHTML = html;
}

// =============================================================================
// ACCIONES DE EXPORTACIÓN Y DESCARGA
// =============================================================================

export function exportarAutoCAD_DXF() {
    if (!state.modelo) calcularModeloCompleto();

    const dxfContent = generarDXFAutoCAD(state.modelo, {
        estudiante: state.alumno,
        dni: state.dni,
        docente: state.docente
    });

    const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TALUD_DOVELAS_${state.dni}_ESCALA_1a1.dxf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function exportarCSV() {
    if (!state.modelo) return;
    const m = state.modelo;

    let csv = "Dovela,Ancho_b_m,Alpha_deg,Delta_l_m,Ah_m2,Asat_m2,gamma_h_kNm3,gamma_sat_kNm3,cohesion_kPa,phi_deg,Peso_W_kNm,hw_prom_m,u_kPa,MR_kNmm,M_kNmm\n";
    m.dovelas.forEach(d => {
        csv += `${d.id},${d.b.toFixed(3)},${d.alpha.toFixed(2)},${d.dl.toFixed(3)},${d.Ah.toFixed(3)},${d.Asat.toFixed(3)},${m.gamma_h.toFixed(2)},${m.gamma_sat.toFixed(2)},${m.cohesion.toFixed(2)},${m.phi_deg.toFixed(1)},${d.W.toFixed(2)},${d.hw_prom.toFixed(2)},${d.u.toFixed(2)},${d.MR.toFixed(2)},${d.M.toFixed(2)}\n`;
    });
    csv += `TOTALES,${m.b.toFixed(3)},,,${m.sumArea.toFixed(3)},,,,,${m.sumW.toFixed(2)},,,${m.sumMR.toFixed(2)},${m.sumM.toFixed(2)}\n`;
    csv += `FS_FELLENIUS,${m.FS_Fellenius.toFixed(4)}\n`;
    csv += `FS_BISHOP,${m.FS_Bishop.toFixed(4)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estabilidad_Taludes_Fellenius_${state.dni}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function generarScriptAutoCAD() {
    if (!state.modelo) return;
    const m = state.modelo;

    // Script de AutoCAD (.SCR) para dibujar en batch
    let scr = "_-COLOR 7\n";
    scr += "_-LAYER _M 01_TERRENO _C 7 01_TERRENO \n";
    scr += `_PLINE -6,0 0,0 ${m.xCresta},${m.h} ${m.xSalida + 6},${m.h} \n`;

    scr += "_-LAYER _M 02_CIRCULO_FALLA _C 1 02_CIRCULO_FALLA \n";
    scr += `_CIRCLE ${m.xO},${m.yO} ${m.R}\n`;

    scr += "_-LAYER _M 03_DOVELAS _C 3 03_DOVELAS \n";
    m.dovelas.forEach(d => {
        const ptsStr = d.polyPts.map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(' ');
        scr += `_PLINE ${ptsStr} _C\n`;
    });

    scr += "_ZOOM _E\n";

    const blob = new Blob([scr], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dibujar_Talud_Dovelas_${state.dni}.scr`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// =============================================================================
// PRESETS DE CONFIGURACIÓN
// =============================================================================
export function cargarPreset(tipo) {
    if (tipo === 'examen') {
        state.h = 12.81;
        state.R = 20.81;
        state.m = 1.5;
        state.nDovelas = 6;
        state.gamma_h = 16.45;
        state.cohesion = 5.60;
        state.phi_deg = 29.0;
        state.tieneNAF = false;
        state.modoCentro = 'romoacca';
    } else if (tipo === 'freatico') {
        state.h = 12.81;
        state.R = 20.81;
        state.m = 1.5;
        state.nDovelas = 6;
        state.gamma_h = 16.45;
        state.gamma_sat = 18.50;
        state.cohesion = 5.60;
        state.phi_deg = 29.0;
        state.tieneNAF = true;
        state.nafTipo = 'horizontal';
        state.yNafPie = 7.50;
        state.modoCentro = 'romoacca';
    } else if (tipo === '9dovelas') {
        state.h = 12.81;
        state.R = 20.81;
        state.m = 1.5;
        state.nDovelas = 9;
        state.gamma_h = 16.45;
        state.cohesion = 5.60;
        state.phi_deg = 29.0;
        state.tieneNAF = false;
        state.modoCentro = 'romoacca';
    } else if (tipo === 'presa') {
        state.h = 24.0;
        state.R = 42.0;
        state.m = 2.5;
        state.nDovelas = 10;
        state.gamma_h = 17.50;
        state.gamma_sat = 19.80;
        state.cohesion = 12.0;
        state.phi_deg = 25.0;
        state.tieneNAF = true;
        state.nafTipo = 'inclinado';
        state.yNafPie = 8.0;
        state.yNafCresta = 18.0;
        state.modoCentro = 'romoacca';
    }

    sincronizarInputsUI();
    actualizarApp();
}

/**
 * Sincroniza los controles del DOM con el estado interno
 */
function sincronizarInputsUI() {
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    setVal('inputH', state.h);
    setVal('inputR', state.R);
    setVal('inputM', state.m);
    setVal('inputNDovelas', state.nDovelas);
    setVal('sliderNDovelas', state.nDovelas);
    setVal('inputGammaH', state.gamma_h);
    setVal('inputCohesion', state.cohesion);
    setVal('inputPhi', state.phi_deg);

    const toggleNaf = document.getElementById('toggleNaf');
    if (toggleNaf) toggleNaf.checked = state.tieneNAF;

    const panelNaf = document.getElementById('panelNafCampos');
    const bannerSinNaf = document.getElementById('bannerSinNaf');
    if (panelNaf && bannerSinNaf) {
        if (state.tieneNAF) {
            panelNaf.classList.remove('hidden');
            bannerSinNaf.classList.add('hidden');
        } else {
            panelNaf.classList.add('hidden');
            bannerSinNaf.classList.remove('hidden');
        }
    }

    setVal('inputYNafPie', state.yNafPie);
    setVal('inputGammaSat', state.gamma_sat);
    setVal('selectModoCentro', state.modoCentro);
}

/**
 * Recalcula y re-renderiza toda la interfaz
 */
export function actualizarApp() {
    calcularModeloCompleto();
    renderizarSVG();
    actualizarTablaDOM();
    actualizarTablaAreasDOM();
    actualizarInspectorDovela();
}

// =============================================================================
// INICIALIZACIÓN DE EVENTOS EN EL DOM
// =============================================================================
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Sincronizar inputs
        sincronizarInputsUI();
        actualizarApp();

        // Listeners para cambios de valores en inputs
        const bindInput = (id, prop, isFloat = true) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                state[prop] = isFloat ? parseFloat(e.target.value) || 0 : e.target.value;
                actualizarApp();
            });
        };

        bindInput('inputH', 'h');
        bindInput('inputR', 'R');
        bindInput('inputM', 'm');
        bindInput('inputGammaH', 'gamma_h');
        bindInput('inputCohesion', 'cohesion');
        bindInput('inputPhi', 'phi_deg');
        bindInput('inputYNafPie', 'yNafPie');
        bindInput('inputGammaSat', 'gamma_sat');

        // Slider y number de número de dovelas sincronizados
        const inputNDov = document.getElementById('inputNDovelas');
        const sliderNDov = document.getElementById('sliderNDovelas');
        if (inputNDov && sliderNDov) {
            inputNDov.addEventListener('input', (e) => {
                state.nDovelas = parseInt(e.target.value) || 6;
                sliderNDov.value = state.nDovelas;
                actualizarApp();
            });
            sliderNDov.addEventListener('input', (e) => {
                state.nDovelas = parseInt(e.target.value) || 6;
                inputNDov.value = state.nDovelas;
                actualizarApp();
            });
        }

        // Toggle Nivel Freático
        const toggleNaf = document.getElementById('toggleNaf');
        if (toggleNaf) {
            toggleNaf.addEventListener('change', (e) => {
                state.tieneNAF = e.target.checked;
                sincronizarInputsUI();
                actualizarApp();
            });
        }

        // Modo de cálculo de centro
        const selectModo = document.getElementById('selectModoCentro');
        if (selectModo) {
            selectModo.addEventListener('change', (e) => {
                state.modoCentro = e.target.value;
                actualizarApp();
            });
        }

        // Presets
        document.getElementById('btnPresetExamen')?.addEventListener('click', () => cargarPreset('examen'));
        document.getElementById('btnPresetFreatico')?.addEventListener('click', () => cargarPreset('freatico'));
        document.getElementById('btnPreset9Dov')?.addEventListener('click', () => cargarPreset('9dovelas'));
        document.getElementById('btnPresetPresa')?.addEventListener('click', () => cargarPreset('presa'));

        // Botones de Exportación
        document.getElementById('btnExportDXF')?.addEventListener('click', exportarAutoCAD_DXF);
        document.getElementById('btnExportCSV')?.addEventListener('click', exportarCSV);
        document.getElementById('btnExportSCR')?.addEventListener('click', generarScriptAutoCAD);
        document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

        // Toggles de visualización
        document.getElementById('toggleFuerzas')?.addEventListener('change', (e) => {
            state.mostrarFuerzas = e.target.checked;
            renderizarSVG();
        });
        document.getElementById('toggleCotas')?.addEventListener('change', (e) => {
            state.mostrarCotas = e.target.checked;
            renderizarSVG();
        });
        document.getElementById('toggleRadios')?.addEventListener('change', (e) => {
            state.mostrarRadios = e.target.checked;
            renderizarSVG();
        });

        // Modal de Correo para el Docente
        const btnCorreo = document.getElementById('btnOpenCorreoModal');
        const modalCorreo = document.getElementById('modalCorreo');
        const btnCloseModal = document.getElementById('btnCloseModal');
        const btnCopyCorreo = document.getElementById('btnCopyCorreo');

        if (btnCorreo && modalCorreo) {
            btnCorreo.addEventListener('click', () => {
                const m = state.modelo;
                const cuerpo = `Estimado(a) Ing. E. Romoacca,
Docente del curso de Mecánica de Suelos II:

Por medio de la presente, yo, ${state.alumno.toUpperCase()}, identificado con DNI N.° ${state.dni} (últimos dígitos ab = ${state.dni.slice(-2)}), hago entrega formal de la Resolución Individual de la Evaluación Consolidado 2 (C-2) sobre Estabilidad de Taludes por el Método de Dovelas (Metodología de Fellenius y Bishop).

RESUMEN TÉCNICO DE PARÁMETROS Y RESULTADOS:
-----------------------------------------------------------------
• Altura del talud (h): ${m.h.toFixed(2)} m (según DNI ab = ${state.dni.slice(-2)})
• Radio de falla (R): ${m.R.toFixed(2)} m (según DNI ab = ${state.dni.slice(-2)})
• Pendiente del talud: 1.5H : 1V (beta = 33.69°)
• Condición Freática: NO EXISTE NIVEL FREÁTICO (NAF). Por su indicación expresa, todos los recuadros de saturación y presión de poros (Asat, gammasat, hw, u) se completaron con cero (0).
• Propiedades del Suelo: gamma_h = ${m.gamma_h.toFixed(2)} kN/m³, c' = ${m.cohesion.toFixed(2)} kN/m², phi' = ${m.phi_deg.toFixed(1)}°
• Ancho total de falla (B): ${m.xSalida.toFixed(2)} m (subdividido en ${m.nDovelas} dovelas de b = ${m.b.toFixed(2)} m)
• Centro de giro O: (${m.xO.toFixed(2)} m, ${m.yO.toFixed(2)} m)

ÁREAS EXACTAS DE CADA DOVELA EN AUTOCAD (LWPOLYLINE CERRADA):
${m.dovelas.map(d => `• Dovela ${d.id}: A_${d.id} = ${d.A_cad.toFixed(2)} m² (W_${d.id} = ${d.W.toFixed(2)} kN/m, alpha_${d.id} = ${d.alpha.toFixed(2)}°)`).join('\n')}
• Área Total Deslizante: ${m.sumArea.toFixed(2)} m²

MOMENTOS Y FACTOR DE SEGURIDAD (FELLENIUS):
• Sumatoria de Momentos Resistentes (Sum MR): ${m.sumMR.toFixed(2)} kN·m/m
• Sumatoria de Momentos Actuantes (Sum M): ${m.sumM.toFixed(2)} kN·m/m
• Factor de Seguridad Final: FS = ${m.FS_Fellenius.toFixed(2)} (${m.FS_Fellenius >= 1.50 ? 'ESTABLE' : 'INESTABLE'})
• Factor de Seguridad Bishop: FS_Bishop = ${m.FS_Bishop.toFixed(2)}

Se adjuntan al presente correo:
1. Memoria de cálculo completa en PDF (compilada en LaTeX, 4 páginas).
2. Plano nativo de AutoCAD (.DXF a escala 1:1) con polilíneas cerradas verificables con los comandos AREA y LIST.

Agradezco de antemano su revisión y quedo atento a cualquier comentario.

Atentamente,
${state.alumno}
DNI: ${state.dni}
Universidad Continental`;

                document.getElementById('correoBodyText').value = cuerpo;
                modalCorreo.classList.remove('hidden');
            });

            btnCloseModal?.addEventListener('click', () => modalCorreo.classList.add('hidden'));

            btnCopyCorreo?.addEventListener('click', () => {
                const txt = document.getElementById('correoBodyText').value;
                navigator.clipboard.writeText(txt).then(() => {
                    btnCopyCorreo.textContent = "¡Copiado con éxito!";
                    setTimeout(() => { btnCopyCorreo.textContent = "Copiar Texto Completo"; }, 2000);
                });
            });
        }
    });
}
