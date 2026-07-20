# 💎 Manual de Diseño Premium: Estética "Slim & Svelte"

Este documento define el lenguaje visual y los estándares de diseño para el ecosistema de aplicaciones "Workflow Corporativo". El objetivo es mantener una interfaz **ligera, profesional y de alta fidelidad**, evitando elementos toscos y priorizando la legibilidad y el flujo de trabajo sin distracciones.

---

## 🎨 Paleta de Colores Corporativa

Se basa en una combinación de **Teal profundo** (profesionalismo) y **Amber** (energía/atención), sobre una base de **Slate** (limpieza).

| Categoría | Variable | Valor Hex | Uso Principal |
| :--- | :--- | :--- | :--- |
| **Primario** | `--theme-primary-color` | `#0F766E` | Botones principales, estados activos, branding. |
| **Primario Hover** | `--theme-primary-hover-color` | `#0D9488` | Interacción en elementos primarios. |
| **Secundario** | `--theme-secondary-color` | `#F59E0B` | Llamadas a la acción secundarias, alertas, acentos. |
| **Fondo Base** | `body-bg` | `#F8FAFC` | Fondo general de la aplicación. |
| **Superficie** | `--theme-surface-color` | `#FFFFFF` | Fondo de tarjetas y paneles. |
| **Texto Titular** | `--theme-border-text-color` | `#0F172A` | Títulos y texto de alto contraste. |
| **Texto Cuerpo** | `text-slate-500` | `#64748B` | Párrafos y metadatos. |
| **Borde** | `--theme-element-border-color` | `rgba(226, 232, 240, 0.7)` | Divisores y contornos de componentes. |

---

## ✍️ Tipografía y Jerarquía

Se utiliza la fuente **Manrope** por su claridad geométrica y modernidad.

*   **Fuente:** `'Manrope Variable', sans-serif`.
*   **Base:** `15px` (ajustable a `16px` en pantallas 4K).
*   **H1 (Títulos de página):** `1.65rem`, `font-weight: 300` (Ultra-ligero), `letter-spacing: -0.035em`.
*   **H2 (Secciones):** `1.25rem`, `font-weight: 400`.
*   **H3 (Tarjetas):** `1.05rem`, `font-weight: 600`.
*   **Cuerpo:** `0.8125rem`, `line-height: 1.5`.

---

## 🍱 Componentes de Interfaz (UI)

### 1. Tarjeta Premium (`.wf-card`)
La pieza fundamental del diseño. Debe sentirse ligera pero definida.
*   **Fondo:** Blanco sólido o ligeramente translúcido (`rgba(255, 255, 255, 0.95)`).
*   **Borde:** `1px solid rgba(226, 232, 240, 0.7)`.
*   **Radio:** `0.85rem` (Elegante, no muy redondo).
*   **Sombra:** `0 4px 12px -2px rgba(15, 23, 42, 0.04)`.
*   **Interacción:** Al hacer hover, el borde se vuelve `rgba(15, 118, 110, 0.2)` y sube ligeramente `-1px`.

### 2. Botones Estilizados
*   **Primario:** Gradiente de `#0F766E` a `#0D9488`. Texto blanco. Sin bordes. Sombra suave Teal.
*   **Secundario:** Fondo blanco, borde Slate claro. Al hover, el texto y borde cambian a Teal.
*   **Tamaño "Slim":** Padding vertical reducido (`0.55rem`) para mantener la esbeltez.

### 3. Cabecera de Vista Flotante (`.wf-view-head`)
Inspirado en tableros de control modernos.
*   **Efecto:** Glassmorphism (`backdrop-filter: blur(12px)`).
*   **Layout:** Flexbox con título a la izquierda y acciones a la derecha.
*   **Marca:** Un pequeño cuadrado (`2.05rem`) con gradiente primario y las iniciales del módulo.

### 4. Entradas de Datos (`.wf-input`)
*   **Borde:** `1px` muy fino.
*   **Foco:** Anillo de `1px` color Teal, sin "glow" excesivo.
*   **Placeholder:** Color Slate 400 (`#94A3B8`).

---

## 🏗️ Layout y Estructura Dashboard

1.  **Sidebar (Navegación):**
    *   Ancho: `16.5rem` (Desktop), `5rem` (Compacto).
    *   Estilo: Fondo blanco con ligero desenfoque de fondo.
    *   Links: Sin fondo por defecto, fondo Teal muy suave (`opacity 0.05`) al estar activo.

2.  **Top Bar:**
    *   Altura fija: `3.5rem`.
    *   Función: Breadcrumbs, estado de conexión (presencia) y perfil de usuario.

3.  **Contenido:**
    *   Grid de KPIs en la parte superior (4 columnas).
    *   Panel principal a la izquierda (Lista o Diagrama).
    *   Panel lateral derecho (`26.5rem`) para detalles rápidos o "Radar" de alertas.

---

## ✨ Micro-detalles que marcan la diferencia

*   **Scrollbars:** Ultra-finos (`5px`) y redondeados, color Slate translúcido.
*   **Badges:** Pills redondeados con colores pastel y texto fuerte (ej: Fondo Teal 8% + Texto Teal 700).
*   **Animaciones:** Todas las entradas de página deben usar un `fade-in` con un ligero desplazamiento hacia arriba (`8px`) en `300ms`.
*   **Iconos:** Utilizar `Material Symbols Rounded` con peso `500` para una apariencia suave.

---

> **Filosofía de Diseño:** "Si no aporta información o claridad, es ruido. Reduce el peso visual, aumenta la precisión".
