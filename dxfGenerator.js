/**
 * dxfGenerator.js
 * Generador Industrial de Archivos DXF ASCII R2010 (AC1024)
 * Escala 1:1 en metros ($INSUNITS = 6), Polilíneas Cerradas (LWPOLYLINE),
 * Capas organizadas, Cotas, Tabla de Fellenius y Membrete Oficial.
 * Auditoría garantizada con 0 errores para AutoCAD Civil 3D y DWG TrueView.
 * Autor: Ulianov Sabath Cuba Valencia (DNI: 72008081)
 */

import { DXF_HEADER, DXF_FOOTER } from './dxfTemplate.js';

export function generarDXFAutoCAD(modelo, config = {}) {
    const estudiante = config.estudiante || "Ulianov Sabath Cuba Valencia";
    const dni = config.dni || "72008081";
    const docente = config.docente || "Ing. E. Romoacca";
    const universidad = config.universidad || "Universidad Continental - Ingenieria Civil";
    const fecha = config.fecha || new Date().toLocaleDateString('es-PE');

    const h = modelo.h;
    const R = modelo.R;
    const m = modelo.m;
    const xO = modelo.xO;
    const yO = modelo.yO;
    const xCresta = modelo.xCresta;
    const xSalida = modelo.xSalida;
    const b = modelo.b;
    const dovelas = modelo.dovelas;
    const tieneNAF = modelo.tieneNAF;
    const FS_Fellenius = modelo.FS_Fellenius;
    const FS_Bishop = modelo.FS_Bishop;
    const sumMR = modelo.sumMR;
    const sumM = modelo.sumM;
    const sumArea = modelo.sumArea;

    let handleId = 0x200;
    function getNextHandle() {
        handleId++;
        return handleId.toString(16).toUpperCase();
    }

    function addLine(x1, y1, x2, y2, layer) {
        const handle = getNextHandle();
        return `  0\nLINE\n  5\n${handle}\n330\n17\n100\nAcDbEntity\n  8\n${layer}\n100\nAcDbLine\n 10\n${x1.toFixed(4)}\n 20\n${y1.toFixed(4)}\n 30\n0.0\n 11\n${x2.toFixed(4)}\n 21\n${y2.toFixed(4)}\n 31\n0.0\n`;
    }

    function addCircle(cx, cy, r, layer) {
        const handle = getNextHandle();
        return `  0\nCIRCLE\n  5\n${handle}\n330\n17\n100\nAcDbEntity\n  8\n${layer}\n100\nAcDbCircle\n 10\n${cx.toFixed(4)}\n 20\n${cy.toFixed(4)}\n 30\n0.0\n 40\n${r.toFixed(4)}\n`;
    }

    function addText(str, x, y, hText, layer, align = 0) {
        const handle = getNextHandle();
        let s = `  0\nTEXT\n  5\n${handle}\n330\n17\n100\nAcDbEntity\n  8\n${layer}\n100\nAcDbText\n 10\n${x.toFixed(4)}\n 20\n${y.toFixed(4)}\n 30\n0.0\n 40\n${hText.toFixed(4)}\n  1\n${str}\n`;
        if (align === 1) { // Centered
            s += ` 72\n1\n 11\n${x.toFixed(4)}\n 21\n${y.toFixed(4)}\n 31\n0.0\n100\nAcDbText\n`;
        } else if (align === 2) { // Right aligned
            s += ` 72\n2\n 11\n${x.toFixed(4)}\n 21\n${y.toFixed(4)}\n 31\n0.0\n100\nAcDbText\n`;
        } else {
            s += `100\nAcDbText\n`;
        }
        return s;
    }

    function addLWPolyline(pts, isClosed, layer) {
        const handle = getNextHandle();
        let p = `  0\nLWPOLYLINE\n  5\n${handle}\n330\n17\n100\nAcDbEntity\n  8\n${layer}\n100\nAcDbPolyline\n 90\n${pts.length}\n 70\n${isClosed ? 1 : 0}\n`;
        for (const pt of pts) {
            p += ` 10\n${pt[0].toFixed(4)}\n 20\n${pt[1].toFixed(4)}\n`;
        }
        return p;
    }

    let entStr = "";

    // =========================================================================
    // VISTA 1: TALUD Y SUBDIVISIÓN EN DOVELAS CON POLILÍNEAS CERRADAS (1:1)
    // =========================================================================
    // Perfil del terreno
    const ptsTerreno = [
        [-6.0, 0.0],
        [0.0, 0.0],
        [xCresta, h],
        [xSalida + 6.0, h]
    ];
    entStr += addLWPolyline(ptsTerreno, false, "01_TERRENO");

    // Centro O y círculo de falla
    entStr += addCircle(xO, yO, 0.25, "02_CIRCULO_FALLA");
    entStr += addLine(xO, yO + 2.5, xO, yO - (R + 3.0), "08_EJE_VERTICAL_O");
    entStr += addLine(xO, yO, 0.0, 0.0, "07_RADIOS_CENTRO");
    entStr += addLine(xO, yO, xSalida, h, "07_RADIOS_CENTRO");
    entStr += addText(`Centro O (${xO.toFixed(2)}, ${yO.toFixed(2)}) | R = ${R.toFixed(2)} m`, xO, yO + 2.8, 0.55, "07_RADIOS_CENTRO", 1);

    // Círculo de falla segmentado en alta resolución
    const nArcPts = 160;
    const ptsFalla = [];
    for (let k = 0; k <= nArcPts; k++) {
        const xCur = (k / nArcPts) * xSalida;
        const arg = Math.max(0, R * R - Math.pow(xCur - xO, 2));
        const yCur = yO - Math.sqrt(arg);
        ptsFalla.push([xCur, yCur]);
    }
    entStr += addLWPolyline(ptsFalla, false, "02_CIRCULO_FALLA");

    // Nivel Freático (si existe)
    if (tieneNAF && modelo.nafPts && modelo.nafPts.length > 1) {
        entStr += addLWPolyline(modelo.nafPts, false, "06_NIVEL_FREATICO");
        const xNafMid = (modelo.nafPts[0][0] + modelo.nafPts[modelo.nafPts.length - 1][0]) / 2;
        const yNafMid = (modelo.nafPts[0][1] + modelo.nafPts[modelo.nafPts.length - 1][1]) / 2;
        entStr += addText(`N.A.F. (Nivel Freatico) u > 0`, xNafMid, yNafMid + 0.35, 0.45, "06_NIVEL_FREATICO", 1);
    }

    // Cada Dovela como POLILÍNEA CERRADA (AREA / LIST directa en AutoCAD)
    dovelas.forEach(d => {
        entStr += addLWPolyline(d.polyPts, true, "03_DOVELAS_POLILINEAS");

        // Texto en el centroide de la dovela
        const xm = d.xmed;
        const ym = 0.5 * (d.yinf_med + d.ysup_med);
        entStr += addText(`DOV ${d.id}`, xm, ym + 0.45, 0.48, "10_TEXTOS_AREAS", 1);
        entStr += addText(`${d.A_cad.toFixed(2)} m2`, xm, ym - 0.25, 0.38, "09_COTAS_LINEALES", 1);
        if (tieneNAF && d.u > 0) {
            entStr += addText(`u=${d.u.toFixed(1)}kPa`, xm, ym - 0.75, 0.30, "06_NIVEL_FREATICO", 1);
        }

        // Línea vertical divisoria entre dovelas
        entStr += addLine(d.xder, d.yinf_der, d.xder, d.ysup_der, "03_DOVELAS_POLILINEAS");
    });

    // Cotas de la geometría
    // Cota de altura talud h
    entStr += addLine(-3.5, 0.0, -3.5, h, "09_COTAS_LINEALES");
    entStr += addLine(-4.2, 0.0, -2.8, 0.0, "09_COTAS_LINEALES");
    entStr += addLine(-4.2, h, -2.8, h, "09_COTAS_LINEALES");
    entStr += addText(`h = ${h.toFixed(2)} m`, -4.0, h / 2, 0.45, "09_COTAS_LINEALES", 2);

    // Cota ancho total B
    const yCotaB = -4.5;
    entStr += addLine(0.0, yCotaB, xSalida, yCotaB, "09_COTAS_LINEALES");
    entStr += addLine(0.0, yCotaB - 0.5, 0.0, yCotaB + 0.5, "09_COTAS_LINEALES");
    entStr += addLine(xSalida, yCotaB - 0.5, xSalida, yCotaB + 0.5, "09_COTAS_LINEALES");
    entStr += addText(`Ancho total de falla B = ${xSalida.toFixed(2)} m (${dovelas.length} dovelas)`, xSalida / 2, yCotaB - 0.9, 0.45, "09_COTAS_LINEALES", 1);

    // Cota ancho dovela b
    const yCotaB1 = -2.8;
    if (dovelas.length >= 2) {
        const x1 = dovelas[1].xizq;
        const x2 = dovelas[1].xder;
        entStr += addLine(x1, yCotaB1, x2, yCotaB1, "09_COTAS_LINEALES");
        entStr += addLine(x1, yCotaB1 - 0.35, x1, yCotaB1 + 0.35, "09_COTAS_LINEALES");
        entStr += addLine(x2, yCotaB1 - 0.35, x2, yCotaB1 + 0.35, "09_COTAS_LINEALES");
        entStr += addText(`b = ${b.toFixed(2)} m`, (x1 + x2) / 2, yCotaB1 - 0.65, 0.40, "09_COTAS_LINEALES", 1);
    }

    // Pendiente talud 1:m
    const xTri = xCresta * 0.65;
    const yTri = xTri / m;
    entStr += addLine(xTri - 2.0, yTri, xTri, yTri, "09_COTAS_LINEALES");
    entStr += addLine(xTri, yTri, xTri, yTri + (2.0 / m), "09_COTAS_LINEALES");
    entStr += addText(`${m.toFixed(1)}`, xTri - 1.0, yTri - 0.4, 0.35, "09_COTAS_LINEALES", 1);
    entStr += addText(`1.0`, xTri + 0.35, yTri + (1.0 / m), 0.35, "09_COTAS_LINEALES", 0);

    // =========================================================================
    // VISTA 2: DESGLOSE INDIVIDUALIZADO DE DOVELAS (ADICIONAL 1:1)
    // =========================================================================
    const xOffsetV2 = xSalida + 14.0;
    entStr += addText("DESGLOSE GEOMETRICO DE CADA DOVELA (POLILINEAS CERRADAS 1:1)", xOffsetV2 + (dovelas.length * 6.5) / 2, h + 8.5, 0.60, "10_TEXTOS_AREAS", 1);

    let curX = xOffsetV2;
    dovelas.forEach(d => {
        const shiftX = curX - d.xizq;
        const shiftedPts = d.polyPts.map(p => [p[0] + shiftX, p[1]]);
        entStr += addLWPolyline(shiftedPts, true, "03_DOVELAS_POLILINEAS");

        const xCenter = curX + (d.b / 2);
        entStr += addText(`DOVELA ${d.id}`, xCenter, h + 5.5, 0.45, "10_TEXTOS_AREAS", 1);
        entStr += addText(`A = ${d.A_cad.toFixed(2)} m2`, xCenter, h + 4.5, 0.40, "09_COTAS_LINEALES", 1);
        entStr += addText(`W = ${d.W.toFixed(2)} kN/m`, xCenter, h + 3.6, 0.35, "09_COTAS_LINEALES", 1);
        entStr += addText(`alpha = ${d.alpha.toFixed(2)} deg`, xCenter, h + 2.8, 0.35, "09_COTAS_LINEALES", 1);
        entStr += addText(`dl = ${d.dl.toFixed(2)} m`, xCenter, h + 2.0, 0.35, "09_COTAS_LINEALES", 1);
        entStr += addText(`h: ${d.hizq.toFixed(2)}|${d.hmed.toFixed(2)}|${d.hder.toFixed(2)}`, xCenter, -1.5, 0.32, "09_COTAS_LINEALES", 1);

        curX += d.b + 3.0;
    });

    // =========================================================================
    // TABLA OFICIAL DEL MÉTODO DE FELLENIUS Y MEMBRETE EN MODELSPACE
    // =========================================================================
    const xTabla = 0.0;
    const yTabla = -9.0;
    const rowH = 1.0;
    const colW = [2.2, 2.0, 2.4, 2.4, 3.4, 3.4, 2.2, 2.2, 3.0, 2.4, 2.4, 3.2, 3.2];
    const headers = [
        "DOVELA", "b [m]", "alpha [deg]", "dl [m]", "Ah [m2]", "Asat [m2]",
        "c' [kPa]", "phi' [deg]", "W [kN/m]", "hw [m]", "u [kPa]", "MR [kNm/m]", "M [kNm/m]"
    ];

    const totalTableW = colW.reduce((a, b) => a + b, 0);

    // Título de la tabla
    entStr += addText("CUADRO OFICIAL DEL METODO DE FELLENIUS (ESTABILIDAD DE TALUDES)", xTabla + totalTableW / 2, yTabla + 1.6, 0.65, "11_TABLA_FELLENIUS", 1);
    entStr += addText(`METODO ORDINARIO DE SUECIA (FELLENIUS) - FS = ${FS_Fellenius.toFixed(2)} | BISHOP SIMPLIFICADO - FS = ${FS_Bishop.toFixed(2)}`, xTabla + totalTableW / 2, yTabla + 0.7, 0.45, "10_TEXTOS_AREAS", 1);

    // Cabecera tabla
    let xCol = xTabla;
    for (let c = 0; c < headers.length; c++) {
        entStr += addLine(xCol, yTabla, xCol, yTabla - (dovelas.length + 2) * rowH, "11_TABLA_FELLENIUS");
        entStr += addText(headers[c], xCol + colW[c] / 2, yTabla - 0.7, 0.32, "11_TABLA_FELLENIUS", 1);
        xCol += colW[c];
    }
    entStr += addLine(xCol, yTabla, xCol, yTabla - (dovelas.length + 2) * rowH, "11_TABLA_FELLENIUS");

    entStr += addLine(xTabla, yTabla, xTabla + totalTableW, yTabla, "11_TABLA_FELLENIUS");
    entStr += addLine(xTabla, yTabla - rowH, xTabla + totalTableW, yTabla - rowH, "11_TABLA_FELLENIUS");

    // Filas de dovelas
    dovelas.forEach((d, idx) => {
        const yRow = yTabla - (idx + 1) * rowH;
        entStr += addLine(xTabla, yRow - rowH, xTabla + totalTableW, yRow - rowH, "11_TABLA_FELLENIUS");

        const vals = [
            `Dov. ${d.id}`,
            d.b.toFixed(2),
            d.alpha.toFixed(2),
            d.dl.toFixed(2),
            d.Ah.toFixed(2),
            d.Asat.toFixed(2),
            modelo.cohesion.toFixed(2),
            modelo.phi_deg.toFixed(1),
            d.W.toFixed(2),
            d.hw_prom.toFixed(2),
            d.u.toFixed(2),
            d.MR.toFixed(2),
            d.M.toFixed(2)
        ];

        let curXCol = xTabla;
        for (let c = 0; c < vals.length; c++) {
            entStr += addText(vals[c], curXCol + colW[c] / 2, yRow - 0.7, 0.32, "11_TABLA_FELLENIUS", 1);
            curXCol += colW[c];
        }
    });

    // Fila de Sumatorias
    const yTotal = yTabla - (dovelas.length + 1) * rowH;
    entStr += addText("SUMATORIAS TOTALES:", xTabla + 6.0, yTotal - 0.7, 0.36, "10_TEXTOS_AREAS", 1);
    entStr += addText(`${sumArea.toFixed(2)}`, xTabla + colW[0] + colW[1] + colW[2] + colW[3] + colW[4] / 2, yTotal - 0.7, 0.34, "10_TEXTOS_AREAS", 1);
    entStr += addText(`${sumMR.toFixed(2)}`, xTabla + totalTableW - colW[12] - colW[11] / 2, yTotal - 0.7, 0.38, "10_TEXTOS_AREAS", 1);
    entStr += addText(`${sumM.toFixed(2)}`, xTabla + totalTableW - colW[12] / 2, yTotal - 0.7, 0.38, "10_TEXTOS_AREAS", 1);

    // =========================================================================
    // MEMBRETE OFICIAL
    // =========================================================================
    const xMem = totalTableW + 4.0;
    const yMem = yTabla;
    const wMem = 22.0;
    const hMem = (dovelas.length + 2) * rowH;

    entStr += addLine(xMem, yMem, xMem + wMem, yMem, "12_MEMBRETE");
    entStr += addLine(xMem + wMem, yMem, xMem + wMem, yMem - hMem, "12_MEMBRETE");
    entStr += addLine(xMem + wMem, yMem - hMem, xMem, yMem - hMem, "12_MEMBRETE");
    entStr += addLine(xMem, yMem - hMem, xMem, yMem, "12_MEMBRETE");

    entStr += addText(universidad.toUpperCase(), xMem + wMem / 2, yMem - 1.2, 0.45, "12_MEMBRETE", 1);
    entStr += addText("MECANICA DE SUELOS II - EVALUACION C-2", xMem + wMem / 2, yMem - 2.2, 0.40, "10_TEXTOS_AREAS", 1);
    entStr += addLine(xMem + 1.0, yMem - 2.6, xMem + wMem - 1.0, yMem - 2.6, "12_MEMBRETE");

    entStr += addText(`ALUMNO: ${estudiante.toUpperCase()}`, xMem + 1.0, yMem - 3.6, 0.38, "12_MEMBRETE", 0);
    entStr += addText(`DNI: ${dni} (Digitos ab = ${dni.slice(-2)})`, xMem + 1.0, yMem - 4.5, 0.38, "12_MEMBRETE", 0);
    entStr += addText(`DOCENTE: ${docente}`, xMem + 1.0, yMem - 5.4, 0.36, "12_MEMBRETE", 0);
    entStr += addText(`FECHA: ${fecha}  |  HORARIO: 5:50 p.m. - 7:50 p.m.`, xMem + 1.0, yMem - 6.3, 0.34, "12_MEMBRETE", 0);

    entStr += addLine(xMem + 1.0, yMem - 6.8, xMem + wMem - 1.0, yMem - 6.8, "12_MEMBRETE");
    entStr += addText(`FS FELLENIUS = ${FS_Fellenius.toFixed(2)}  (${FS_Fellenius >= 1.50 ? 'ESTABLE' : 'INESTABLE'})`, xMem + 1.0, yMem - 7.6, 0.42, "10_TEXTOS_AREAS", 0);
    entStr += addText(`FS BISHOP = ${FS_Bishop.toFixed(2)}  |  ESCALA: 1:1 METRICA (m)`, xMem + 1.0, yMem - 8.5, 0.36, "12_MEMBRETE", 0);

    return DXF_HEADER + entStr + DXF_FOOTER;
}
