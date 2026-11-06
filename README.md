# GeoTalud Dovelas Pro 🏔️📐
### Suite Geotécnica para Análisis de Estabilidad de Taludes (Métodos de Fellenius y Bishop) con Nivel Freático y Exportación Automatizada a AutoCAD 1:1 (DWG / DXF)

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-success?style=for-the-badge&logo=github)](https://72008081-pixel.github.io/estabilidad-taludes-dovelas/)
[![AutoCAD Ready](https://img.shields.io/badge/AutoCAD-Escala%201%3A1%20(DXF%2FDWG)-blue?style=for-the-badge&logo=autodesk)](https://72008081-pixel.github.io/estabilidad-taludes-dovelas/)
[![Author](https://img.shields.io/badge/Autor-Ulianov%20Cuba%20Valencia-amber?style=for-the-badge)](https://github.com/72008081-pixel)

---

## 🌐 Enlace de la Aplicación en Vivo (Web App)
Puedes acceder y utilizar la aplicación directamente desde cualquier navegador web (móvil, tablet o PC) sin instalar nada:

👉 **[https://72008081-pixel.github.io/estabilidad-taludes-dovelas/](https://72008081-pixel.github.io/estabilidad-taludes-dovelas/)**

---

## 👤 Información del Estudiante y Asignatura
* **Estudiante:** Ulianov Sabath Cuba Valencia
* **DNI:** `72008081` (Dígitos $\overline{ab} = \mathbf{81}$)
* **Universidad:** Universidad Continental
* **Facultad:** Ingeniería Civil
* **Asignatura:** Mecánica de Suelos II
* **Docente:** Ing. E. Romoacca (`eromoacca@continental.edu.pe`)
* **Evaluación:** Consolidado 2 (C-2 Individual)

---

## 🚀 Características Principales

1. **Entrada de Datos Simplificada e Intuitiva:**
   * Sliders y cajas de texto numéricas sincronizadas para altura del talud ($h$), pendiente ($H:1V$), radio de falla circular ($R$), cohesión ($c'$), fricción ($\phi'$) y pesos unitarios ($\gamma_h, \gamma_{\text{sat}}$).
   * Botones de preconfiguración (Presets) a 1-clic:
     * 🎯 **Examen C2 Ulianov (DNI: 72008081 - ab=81):** $h = 12.81\text{ m}, R = 20.81\text{ m}, 1.5H:1V$, sin nivel freático.
     * 💧 **Talud con Nivel Freático Intermedio:** $y_{\text{NAF}} = 7.50\text{ m}, \gamma_{\text{sat}} = 18.5\text{ kN/m}^3$.
     * 📑 **Discretización Refinada en 9 Dovelas:** según cuaderno de apuntes.
     * 🏔️ **Presa de Tierra:** $h = 24\text{ m}, R = 42\text{ m}, 2.5H:1V$.

2. **Cálculo de Áreas por 4 Metodologías en Tiempo Real:**
   * **Método 1 – AutoCAD Exacto (Polilínea Cerrada / Integral Numérica):**
     $$A_{\text{CAD}, i} = \int_{x_{i-1}}^{x_i} \left[ y_{\text{terreno}}(x) - y_{\text{falla}}(x) \right] dx$$
   * **Método 2 – Método Gráfico Trapezoidal:**
     $$A_{\text{trap}, i} = \frac{1}{2} (h_{\text{izq}, i} + h_{\text{der}, i}) \cdot b$$
   * **Método 3 – Método de la Ordenada Media:**
     $$A_{\text{med}, i} = h_{\text{med}, i} \cdot b$$
   * **Método 4 – Método Parabólico de Simpson 1/3:**
     $$A_{\text{simp}, i} = \frac{b}{6} (h_{\text{izq}, i} + 4 h_{\text{med}, i} + h_{\text{der}, i})$$
   * Tabla comparativa instantánea mostrando el error relativo de cada método respecto a AutoCAD.

3. **Manejo Completo del Nivel Freático (NAF):**
   * **Interruptor ON/OFF:** Si está en **OFF** (como en el examen C-2), todos los campos de agua ($A_{\text{sat}}, \gamma_{\text{sat}}, h_w, u$) se fijan automáticamente en **`0.00`** por indicación del docente.
   * Si está en **ON**:
     * Calcula la altura del agua izquierda ($h_{w(i)}$), derecha ($h_{w(d)}$) y promedio ($h_{w(\text{prom})}$).
     * Presión de poros en la base: $u_i = h_{w(\text{prom})} \cdot \gamma_w$.
     * Área saturada ($A_{\text{sat}, i}$) y área húmeda no saturada ($A_{h, i} = A_{\text{total}} - A_{\text{sat}}$).
     * Peso total de la dovela: $W_i = A_{h, i} \cdot \gamma_h + A_{\text{sat}, i} \cdot \gamma_{\text{sat}}$.

4. **Factores de Seguridad Simultáneos:**
   * **Método Ordinario de Fellenius:**
     $$FS_{\text{Fellenius}} = \frac{\sum \left[ c' \cdot \Delta l_i + \left( W_i \cos\alpha_i - u_i \Delta l_i \cos^2\alpha_i \right) \tan\phi' \right]}{\sum W_i \sin\alpha_i}$$
   * **Método Simplificado de Bishop (Iterativo con convergencia automática):**
     $$FS_{\text{Bishop}} = \frac{\sum \frac{c' b + (W_i - u_i b) \tan\phi'}{m_{\alpha, i}}}{\sum W_i \sin\alpha_i} \quad \text{donde} \quad m_{\alpha, i} = \cos\alpha_i \left( 1 + \frac{\tan\alpha_i \tan\phi'}{FS} \right)$$

5. **Visualizador SVG Interactivo de Alta Fidelidad:**
   * Renderizado vectorial con escala métrica real y rejilla milimétrica tipo CAD.
   * Diferenciación cromática: **Cuña Pasiva** (ámbar suave, estabilizadora con $\alpha < 0$) y **Zona Activa** (verde suave, desestabilizadora con $\alpha > 0$).
   * Toggles para mostrar/ocultar vectores de fuerzas ($W_i, S_i$), cotas y radios.
   * Inspector de dovela: haz clic en cualquier dovela para ver sus propiedades aisladas.

6. **Exportación Automatizada a AutoCAD (Escala 1:1, DXF / DWG):**
   * Genera un archivo nativo `.dxf` en texto ASCII (AutoCAD R2010 métrico, `$INSUNITS = 6`).
   * **Cada dovela es una `LWPOLYLINE` cerrada (`close=True`)** con sombreado `HATCH` (`ANSI31`). Al seleccionar cualquier dovela en AutoCAD y ejecutar el comando `AREA` (Object) o `LIST`, reporta el área idéntica a la aplicación.
   * Incluye Vista 1 (Talud general), Vista 2 (Desglose individual de cada dovela), Cuadro Oficial de Fellenius dibujado vectorialmente y Membrete Oficial con datos del estudiante.

7. **Excel Automatizado (.XLSX) con Fórmulas Simples y Colores Pasteles:**
   * Archivo Excel nativo preconfigurado para el examen de Ulianov Cuba Valencia: [`ESTABILIDAD_TALUD_DOVELAS_ULIANOV_CUBA_72008081.xlsx`](./ESTABILIDAD_TALUD_DOVELAS_ULIANOV_CUBA_72008081.xlsx).
   * **Diseño 100% Humano:** Estructurado en "cuadritos" limpios de ingeniería civil con encabezados en tonos pasteles suaves (celeste, crema, menta, durazno) y **todas las letras estrictamente en color negro** (sin fondos oscuros ni letras blancas).
   * **Fórmulas Básicas Universales:** Utiliza únicamente fórmulas elementales (`SUMA`, `SENO`, `COS`, `ASENO`, `RADIANES`, `RAIZ`, `SI`, `REDONDEAR`) para que cualquier docente o alumno pueda auditar paso a paso los cálculos.
   * **Automatizado para cualquier talud:** Cambias la altura $h$, el radio $R$ o el suelo en el Cuadro 2 y toda la hoja se recalcula instantáneamente.
   * Incluye 2 hojas completas:
     1. *Hoja 1:* Cálculo de Talud, Geometría del Centro, Cuadro Oficial de Fellenius y Diagnóstico Geotécnico.
     2. *Hoja 2:* Comparativa detallada de 4 métodos de áreas con cálculo de error porcentual.

8. **Otras Exportaciones:**
   * **Excel / CSV:** Descarga la tabla completa para procesar en hojas de cálculo.
   * **Script AutoCAD (.SCR):** Automatización batch en AutoCAD.
   * **PDF / Memoria de Cálculo:** Vista `@media print` optimizada para generar el informe técnico con 1 clic.
   * **Modal de Correo Institucional:** Formato redactado listo para enviar a `eromoacca@continental.edu.pe`.

---

## 🛠️ Cómo Ejecutar Localmente

No se requiere ninguna instalación de Node.js ni paquetes externos:
1. Clona el repositorio:
   ```bash
   git clone https://github.com/72008081-pixel/estabilidad-taludes-dovelas.git
   ```
2. Entra a la carpeta y abre `index.html` en tu navegador favorito:
   ```bash
   cd estabilidad-taludes-dovelas
   start index.html
   ```

---

## 📐 Apertura y Verificación en AutoCAD

1. Descarga el archivo generado haciendo clic en **"Descargar AutoCAD (.DXF 1:1)"** dentro de la aplicación.
2. Abre AutoCAD (cualquier versión: 2010 a 2026, Civil 3D, TrueView).
3. Haz doble clic en el archivo `.dxf`.
4. Ejecuta el comando `ZOOM` $\rightarrow$ `E` (*Extents*).
5. Selecciona cualquier dovela y escribe `AREA` $\rightarrow$ `Object`. Verás que el área reportada por AutoCAD coincide al $100\%$ con la tabla de cálculo.
6. Guarda como `.dwg` con `Ctrl + S`.

---

Desarrollado con dedicación técnica y rigor geotécnico por **Ulianov Sabath Cuba Valencia** (DNI: 72008081).
