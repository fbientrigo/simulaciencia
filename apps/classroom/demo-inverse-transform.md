---
theme: default
title: 'SimulaCiencia — Inverse transform sampling and population decay'
info: |
  Demonstration lesson for an introductory Statistical Simulation course.
  Every figure is generated live from a seeded engine; nothing is a screenshot.
class: text-left
transition: fade
mdc: true
drawings:
  persist: false
---

<TitleSlide
  subtitle="From a uniform random number to an exponential lifetime"
  course="Statistical Simulation · demonstration lesson"
/>

<!--
Opening line: everything you are about to see is computed in the browser from a
seed you can read off the screen. Nothing here is a recorded video.
-->

---

# The question

A computer can hand us one thing: numbers spread evenly on $(0,1)$.

Almost nothing in science is distributed that way. Waiting times, component
lifetimes, and the time until a nucleus decays all follow

$$ f(x) = \lambda e^{-\lambda x}, \qquad x \ge 0. $$

<Panel kind="definition" label="The problem">

Given a stream of $U \sim \mathrm{Uniform}(0,1)$, how do we produce a stream of
$X \sim \mathrm{Exponential}(\lambda)$ — exactly, not approximately?

</Panel>

<v-click>

<Panel kind="warning">

"Approximately" is not good enough. If the transformation is subtly wrong, the
histogram still _looks_ exponential; only the tail and the variance give it away.
We will check both.

</Panel>

</v-click>

---

# Inverse transform sampling

For a continuous, strictly increasing CDF $F$, the random variable

$$ X = F^{-1}(U), \qquad U \sim \mathrm{Uniform}(0,1) $$

has exactly the distribution $F$. The proof is one line:

$$ P(X \le x) = P\bigl(F^{-1}(U) \le x\bigr) = P\bigl(U \le F(x)\bigr) = F(x). $$

<v-click>

For the exponential distribution,

$$ F(x) = 1 - e^{-\lambda x} ;\Longrightarrow; u = 1 - e^{-\lambda x}
   \;\Longrightarrow\; x = -\frac{\ln(1-u)}{\lambda}. $$

</v-click>

<v-click>

<Panel kind="equation">

$$ X = -\frac{\ln(1 - U)}{\lambda} $$

</Panel>

</v-click>

<v-click>

Since $1 - U \in (0, 1]$, the result is always finite and non-negative. That is
a property of the formula, not of luck — and it is one of the unit tests.

</v-click>

---
layout: full
---

# Watch the transform act

<ExplorerSlide :seed="20260801" :rate="1.5" :sample-count="1200" />

<!--
Step one draw at a time first. Point at a U near 0.99 and watch where it lands.
Then hit "Draw all" and let the histogram fill in.
Then change the seed and note that the picture changes but the shape does not.
-->

---
layout: full
---

# The same sampler, a physical question

<DecaySlide :seed="20260801" :initial-count="400" :rate="0.35" />

<!--
Each object gets ONE exponential lifetime at t = 0. Nothing is decided later.
That is why the survivor count can never go back up, and why pausing, changing
the speed, or resizing the window cannot alter the outcome.
-->

---

# Why the survivor count is exponential

Each of the $N_0$ objects independently carries a lifetime
$T_i \sim \mathrm{Exponential}(\lambda)$. The number still present at time $t$ is

$$ N(t) = \#\{\, i : T_i > t \,\} \sim \mathrm{Binomial}\bigl(N_0,\, e^{-\lambda t}\bigr), $$

so

$$ \mathbb{E}[N(t)] = N_0 e^{-\lambda t}, \qquad
   \mathrm{sd}\bigl(N(t)\bigr) = \sqrt{N_0 e^{-\lambda t}\bigl(1 - e^{-\lambda t}\bigr)}. $$

<v-click>

<Panel kind="result">

The half-life $t_{1/2} = \ln 2 / \lambda$ is a property of a *single* object's
distribution. The smooth curve $N_0 e^{-\lambda t}$ is what the average
population does — an individual run wobbles around it by roughly
$\sqrt{N_0}/N_0 = 1/\sqrt{N_0}$ in relative terms.

</Panel>

</v-click>

---

# Empirical versus theoretical

Computed live, seed `20260801`, $\lambda = 1.5$ (so $1/\lambda = 0.6\overline{6}$,
$1/\lambda^2 = 0.4\overline{4}$):

<ValidationSlide :seed="20260801" :rate="1.5" />

<v-click>

Errors shrink like $1/\sqrt{n}$: a hundredfold increase in $n$ buys one extra
decimal place. That, not the shape of the histogram, is the honest measure of
convergence.

</v-click>

---

# Your turn

<Panel kind="exercise" label="Exercise">

1. Set $\lambda = 0.5$ in the explorer. Predict the mean *before* drawing, then
   check it against the table.
2. With $n = 100$, run four different seeds. Record the four sample means. Is
   the spread you observe consistent with the reported standard error?
3. In the decay chamber, set $N_0 = 40$ and then $N_0 = 4000$ at the same
   $\lambda$. The half-life does not change — explain why the *curve* looks so
   much noisier in the first case.
4. Explain in one sentence why $X = -\ln(U)/\lambda$ also works, and say what
   would break if the generator could return exactly $0$.

</Panel>

<v-click>

<Panel kind="warning" label="Hand in">

Report the seed with every number you write down. A result without its seed is
not reproducible, and in this course that means it is not a result.

</Panel>

</v-click>

---
layout: center
class: text-center
---

# What we established

<div class="sc-root" style="text-align: left; max-width: 46rem; margin-inline: auto">

<Panel kind="result" label="Summary">

- $F^{-1}(U)$ turns uniform noise into **any** distribution whose CDF we can invert.
- For the exponential, $X = -\ln(1-U)/\lambda$ — finite and non-negative by construction.
- One exponential lifetime per object reproduces the decay law $N_0 e^{-\lambda t}$.
- A seed plus a parameter set reproduces a simulation **exactly**; simulation time
  is independent of frame rate.
- Convergence is measured, not eyeballed: mean, variance and $\sup|\hat F - F|$.

</Panel>

</div>

<div class="sc-root" style="margin-top: 1.5rem">
  <p class="sc-caption">Next: rejection sampling, for the distributions we cannot invert.</p>
</div>
$$
