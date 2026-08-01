---
theme: default
title: 'SimulaCiencia — Clase 01 — Conteos aleatorios y distribución de Poisson'
info: |
  Clase 01 de un curso introductorio de Simulación Estadística.
  Cada figura se calcula en vivo a partir de una semilla; nada es una captura.
class: text-left
transition: fade
mdc: true
drawings:
  persist: false
---

<TitleSlide
  subtitle="Clase 01 — Conteos aleatorios y distribución de Poisson"
  course="Simulación Estadística · semilla 20260801"
/>

<!--
Qué hacer: señalar la semilla 20260801 en la portada y decir que todo lo que se
verá se calcula en el navegador a partir de ella. No hay ningún vídeo grabado ni
ninguna imagen pegada.
Qué preguntar: «¿quién ha contado alguna vez algo que llegaba a su propio ritmo?»
— llamadas, gotas, correos, partículas. Recoger dos o tres ejemplos.
Idea estadística visible: todos esos ejemplos son el mismo problema, y por eso
una sola distribución va a servir para todos.
-->

---
layout: full
---

# El fenómeno

<PoissonSlide stage="scene" :initial-windows="0" />

<Panel kind="definition" label="La pregunta">

¿Cuántos eventos observaremos durante una ventana de tiempo?

</Panel>

<!--
Qué hacer: no tocar nada todavía. Sólo el detector en pantalla.
Qué preguntar: «si abrimos el detector durante Δt, ¿cuántos eventos veremos?».
Recoger tres respuestas distintas de la clase y anotarlas en la pizarra.
Idea estadística visible: aún no hay ningún número, y eso es deliberado. La
pregunta no tiene una respuesta única: tiene una distribución.
-->

---
layout: full
---

# Una ventana

<PoissonSlide stage="manual" :initial-windows="0" />

<!--
Qué hacer: pulsar «Simular una ventana» una sola vez y dejar que la clase vea
llegar las partículas y encenderse las interacciones.
Qué preguntar: «¿cuántas contaron?». Que alguien diga el número en voz alta
antes de mostrarlo.
Idea estadística visible: una ventana es un experimento completo. El conteo
todavía está oculto a propósito, para que la clase cuente y no lea.
-->

---
layout: full
---

# La variable aleatoria

<PoissonSlide stage="counter" :initial-windows="1" />

<v-click>

<Panel kind="definition" label="Definición">

Llamamos $K$ al número de eventos observados en una ventana de duración
$\Delta t$. Cada repetición del experimento produce **un entero no negativo**:

$$ K \in \{0, 1, 2, 3, \dots\} $$

</Panel>

</v-click>

<!--
Qué hacer: ya se ve K de la primera ventana. Pulsar «Simular una ventana» dos o
tres veces más y señalar que el número cambia cada vez.
Qué preguntar: «¿puede salir 0? ¿puede salir 50?».
Idea estadística visible: K es una variable aleatoria discreta, no un error de
medición. La variabilidad es el fenómeno, no ruido que haya que quitar.
-->

---
layout: full
---

# Repetir el experimento

<PoissonSlide stage="automatic" :initial-windows="5" />

<!--
Qué hacer: pulsar «Reproducir» y dejar correr unos segundos; luego «Pausar».
Bajar la velocidad a 0,5× si la clase pierde el hilo. «Simular una ventana»
sigue disponible: usarla cuando alguien pida repetir una observación concreta.
Qué preguntar: «¿ven algún valor que se repita más que los otros?».
Idea estadística visible: una observación es impredecible, pero el historial ya
empieza a agruparse alrededor de un valor central.
-->

---
layout: full
---

# La distribución aparece

<PoissonSlide stage="histogram" :initial-windows="40" />

<!--
Qué hacer: nada al principio. Dejar que la clase mire las 40 observaciones ya
recogidas. Después pulsar «Reproducir» para llegar a un centenar.
Qué preguntar: «¿qué forma están dibujando las barras? ¿es simétrica? ¿dónde
está el máximo? ¿por qué no hay barras a la izquierda del cero?».
Idea estadística visible: la forma es estable aunque cada barra concreta
tiemble. Todavía NO se ha mencionado ninguna fórmula.
-->

---
layout: full
---

# Modelo de Poisson

<PoissonSlide stage="theory" :initial-windows="40" />

<Panel kind="equation">

$$ P(K = k) = \frac{e^{-\mu}\,\mu^{k}}{k!}, \qquad \mu = \lambda\,\Delta t $$

</Panel>

<!--
Qué hacer: estas son EXACTAMENTE las mismas 40 observaciones de la lámina
anterior, con la misma semilla y los mismos parámetros. Lo único nuevo es la
curva teórica superpuesta. Decirlo en voz alta: no se ha vuelto a simular nada.
Qué preguntar: «μ = λΔt = 3 · 1 = 3. ¿Coincide con dónde está el máximo?».
Idea estadística visible: el modelo no se ajustó a los datos; se calculó a
partir de λ y Δt antes de mirarlos.
-->

---
layout: full
---

# Verificar, no sólo mirar

<PoissonSlide stage="diagnostics" :initial-windows="400" />

<!--
Qué hacer: señalar la tabla, no el dibujo. Con 400 ventanas y semilla 20260801:
media 3,063, varianza 3,131, Fano 1,023.
Qué preguntar: «¿qué distribución conocen en la que la varianza sea igual a la
media?». Después: «si el factor de Fano saliera 3, ¿qué significaría?».
Idea estadística visible: «se parece» no es un resultado. Media ≈ μ,
varianza ≈ μ y Fano ≈ 1 son tres afirmaciones comprobables, y el panel avisa
cuando hay demasiado pocas ventanas para afirmar nada.
-->

---

# Conexión con la exponencial

Nada en la simulación llama a un generador de Poisson. Lo único que se sortea
son **tiempos de espera exponenciales**, con el mismo método inverso de la
lección anterior:

$$ E_i = -\frac{\ln(1-U)}{\lambda}, \qquad U \sim \mathrm{Uniforme}(0,1). $$

<v-click>

Se acumulan hasta salirse de la ventana, y el número de llegadas que caben
dentro es el conteo:

$$ K = \max\Bigl\{\, n : \sum_{i=1}^{n} E_i \le \Delta t \,\Bigr\}. $$

</v-click>

<v-click>

<Panel kind="result" label="Resultado">

Si los tiempos entre llegadas son exponenciales e independientes, entonces el
número de llegadas en una ventana fija es de Poisson con $\mu = \lambda\Delta t$.
Las dos distribuciones son dos vistas del mismo proceso: una mira **cuándo**,
la otra mira **cuántos**.

</Panel>

</v-click>

<!--
Qué hacer: volver una lámina atrás si hace falta y recordar que en la clase
anterior ya se sorteaban tiempos exponenciales con exactamente esta fórmula.
Qué preguntar: «¿por qué el conteo no puede ser negativo?» y «si λ se duplica,
¿qué le pasa a μ?».
Idea estadística visible: no hicimos falta ninguna herramienta nueva. El
generador exponencial de la lección 1 produce Poisson gratis.
-->

---
layout: full
---

# Ejercicio interactivo

<PoissonSlide stage="diagnostics" :initial-windows="0" show-parameters />

<Panel kind="exercise" label="Ejercicio">

1. Cambia $\lambda$ o $\Delta t$ y **predice $\mu = \lambda\Delta t$ antes** de
   simular nada. Anótalo.
2. Recoge al menos 200 ventanas con «Reproducir».
3. Compara media, varianza y factor de Fano con tu predicción.
4. Repite con otra semilla y explica qué cambió y qué no.

</Panel>

<!--
Qué hacer: dejar que un estudiante elija λ y Δt en pantalla. Exigir la
predicción de μ en voz alta ANTES de pulsar «Reproducir».
Qué preguntar: «¿cuántas ventanas necesitamos para que el panel se atreva a
decir algo?» (treinta) y «¿por qué con cinco ventanas una simulación correcta
parece rota?».
Idea estadística visible: el error de estimación baja como 1/√n. La forma se
reconoce pronto; los números tardan más.
-->

---
layout: center
class: text-center
---

# Cierre

<div class="sc-root" style="text-align: left; max-width: 46rem; margin-inline: auto">

<Panel kind="result" label="Resumen">

- Una observación es **impredecible**: no sabemos cuánto valdrá el próximo $K$.
- La distribución es **predecible**: sabemos qué forma tendrá el histograma.
- $\mu = \lambda\Delta t$ fija a la vez la media y la varianza; por eso el
  factor de Fano vale 1.
- Tiempos entre llegadas exponenciales $\Rightarrow$ conteos de Poisson.
- La **reproducibilidad** exige semilla y parámetros: un resultado sin semilla
  no es un resultado.

</Panel>

</div>

<div class="sc-root" style="margin-top: 1.5rem">
  <p class="sc-caption">
    Siguiente clase: qué ocurre cuando la varianza NO es igual a la media.
  </p>
</div>

<!--
Qué hacer: cerrar volviendo a la pizarra del principio, donde están las tres
respuestas que dio la clase a «¿cuántos eventos veremos?». Ninguna era la
respuesta; todas eran valores posibles.
Qué preguntar: «¿qué tienen que anotar para que otra persona reproduzca hoy
exactamente esta lámina?». Respuesta: semilla, λ, Δt y número de ventanas.
-->
