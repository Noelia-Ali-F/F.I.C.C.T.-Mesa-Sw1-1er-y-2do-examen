# 🎨 Manual del Sistema de Diseño Premium (SaaS Spec)

Este documento contiene las directrices, clases CSS globales y fichas del **Sistema de Diseño Estilizado y Minimalista** implementado para unificar la estética de toda la familia de componentes del Workflow Corporativo, eliminando el estilo tosco ("gordo") y homogeneizando cabeceras, entradas y botones.

---

## 💎 Directrices Estéticas de Alta Fidelidad

1. **Tipografía Sutil y Ligera (`h1`, `h2`):**
   * Los títulos principales (`h1`) abandonan las negritas pesadas de plantilla genérica. Ahora utilizan un peso tipográfico ultra-ligero (`font-weight: 300`) y tracking estrecho (`tracking-tight`), lo que da una apariencia premium e institucional.
   * Los títulos de sección (`h2`) y tarjetas (`h3`) están reducidos proporcionalmente en tamaño (`1.25rem` y `1.05rem` respectivamente) con espaciados calculados en base a `font-sans` (Manrope).

2. **Componentes Delgados ("Slim & Svelte Layouts"):**
   * Se redujo el tamaño de fuente base general (`html { font-size: 15px }`) para que los cuadros no ocupen espacio de pantalla excesivo ni se sientan toscos.
   * Se redujeron los radios de borde a valores más finos (`--wf-radius: 0.85rem` y `--wf-radius-sm: 0.55rem`), aportando mayor nitidez a las tarjetas.

3. **Políticas de Margen y Espacio (Concentración Distracción-Free):**
   * Todo componente de contenido complejo debe respirar, usando márgenes y rellenos controlados (`p-4` o `p-5` en lugar de paddings masivos o amontonados).

---

## 🛠️ Clases Globales Estandarizadas (`styles.css`)

Utilice estas clases para mantener la cohesión en las futuras vistas del sistema:

### 1. Cabeceras de Página (`.wf-view-head`)
Crea un encabezado flotante con efecto cristal (`backdrop-filter`) y sombras sutiles:
```html
<header class="wf-view-head">
  <div>
    <h1 class="wf-view-head__title">Título de la Vista</h1>
    <p class="wf-view-head__subtitle">Breve subtítulo descriptivo o metadatos de contexto.</p>
  </div>
</header>
```

### 2. Tarjetas Premium (`.wf-card-premium`)
Reemplaza los contenedores pesados por tarjetas con bordes ultra-finos y transiciones suaves en hover:
```html
<div class="wf-card-premium">
  <h3>Título de la Ficha</h3>
  <p>Contenido explicativo interno de la tarjeta.</p>
</div>
```

### 3. Botones Corporativos Estilizados
* **Botón Primario (`.wf-btn-premium-primary`):** Con gradiente corporativo Teal a Teal-claro, sombreado fino y escalado al presionar.
* **Botón Secundario (`.wf-btn-premium-secondary`):** Borde sutil, fondo blanco con hover interactivo de color Teal.

```html
<button class="wf-btn-premium-primary">
  Guardar Cambios
</button>

<button class="wf-btn-premium-secondary">
  Cancelar
</button>
```

### 4. Entradas de Datos Distracción-Free (Inputs standard a través de `@layer base`)
Todos los inputs (`input[type="text"]`, `select`, `textarea`) tienen bordes ultra-delgados de `1px` y una transición de foco limpia con sombra Teal de `1px`:
```html
<input type="text" placeholder="Ingresa datos..." />
```

### 5. Tablas Slim (`.wf-table-premium-header` & `.wf-table-premium-row`)
Diseño de filas ligeras de una sola grilla con transiciones de color de fondo al pasar el mouse:
```html
<div class="wf-table-premium-header grid-cols-3">
  <span>Código</span>
  <span>Asunto</span>
  <span>Estado</span>
</div>
<div class="wf-table-premium-row grid-cols-3">
  <span class="font-bold">#WF-109</span>
  <span>Aprobación Pliego</span>
  <span class="wf-badge wf-badge-teal">Pendiente</span>
</div>
```

---

## 🌟 Avance y Mantenimiento

* **Global Styles:** Completamente portado a Tailwind v4 e integrado en `styles.css`.
* **Sinergia:** Todas las vistas (incluyendo el nuevo Editor Colaborativo de Enfoque y el Visor de PDFs) heredan y aplican estas reglas de manera nativa e inmediata.
