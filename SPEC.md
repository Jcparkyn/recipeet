# Recipeet — SPECIFICATION

An interactive, mobile-first PWA for walkthrough-style cooking. Paste a recipe as text or import from URL, get it parsed and reordered by LLM, then cook step-by-step without scrolling.

---

## 1. Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | SolidJS + TypeScript |
| Build | Vite |
| Styling | CSS Modules (mobile-first) |
| PWA | `vite-plugin-pwa` |
| Persistence | `localStorage` |
| LLM | DeepSeek (OpenAI-compatible API) — swappable |
| URL Reader | `r.jina.ai` proxy |

---

## 2. Routes & Screens

### `/` — Recipe List
- Grid of saved recipe cards (title, servings, date)
- Empty state: "No recipes yet" + CTA to import
- Tap card → `/recipe/:id`
- FAB button → `/import`

### `/import` — Import Recipe
- Tab switcher: "Paste Text" | "Import URL"
- **Paste tab**: large textarea, "Parse Recipe" button
- **URL tab**: URL input, "Fetch & Parse" button
- Loading state with spinner
- Error state with retry
- On success: navigate to `/recipe/:id`

### `/recipe/:id` — Recipe Detail / Overview
- Title, source URL (if any), original servings
- Servings scaler (range 1–32)
- Scaled ingredient list preview
- Step count
- Two CTAs: "Shopping List" → `/recipe/:id/shop` and "Start Cooking" → `/recipe/:id/cook`
- Delete recipe button (with confirmation)

### `/recipe/:id/shop` — Shopping List
- Ingredients grouped by category (produce, dairy, meat, pantry, spices, bakery, frozen, other)
- Each item: checkbox, name, **scaled** quantity + unit
- Tapping ingredient name → conversion popover with equivalent units
- "Check all" / "Uncheck all" per category
- Progress indicator

### `/recipe/:id/cook` — Cooking Mode
- One main step visible at a time (vertical pagination, no scrolling required)
- All substeps for current step shown at once
- Top bar: recipe title, "Step X of Y", progress bar
- Swipe or "Next" / "Previous" buttons to navigate between steps
- Each substep: checkbox + instruction with **inline scaled quantities**
- Checking all substeps auto-checks the step header; checking step header checks all substeps
- Completion screen on last step finished

### `/settings` — Settings
- LLM provider/API key/base URL/model configuration (stored in localStorage)
- Test connection button
- Clear all data button

---

## 3. Data Model

Three distinct layers: **parsed content** (immutable LLM output), **saved recipe** (id + metadata), and **progress** (mutable user state).

```typescript
// ── Parsed content (what the LLM returns) ──

interface RecipeContent {
  title: string;
  originalServings: number;
  ingredients: Ingredient[];
  steps: Step[];
}

interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  category?: ShoppingCategory;
}

interface Step {
  id: string;
  title: string;
  order: number;
  substeps: SubStep[];
}

interface SubStep {
  id: string;
  instruction: string;
  linkedIngredients?: LinkedIngredient[];
}

interface LinkedIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
}

type ShoppingCategory =
  | 'produce' | 'dairy' | 'meat'
  | 'pantry' | 'spices' | 'bakery'
  | 'frozen' | 'other';

// ── Saved recipe (recipe content + metadata) ──

interface Recipe {
  id: string;
  content: RecipeContent;
  sourceUrl?: string;
  createdAt: number;
  updatedAt: number;
}

// ── Progress (per-recipe user state, stored separately) ──

interface RecipeProgress {
  recipeId: string;
  currentServings: number;
  checkedShoppingItems: string[];    // ingredient ids
  checkedSteps: string[];            // step ids
  checkedSubsteps: string[];         // substep ids
  currentCookingStep: number;        // index into steps[]
}
```

### Storage Keys
- `recipeet:recipes` — `Recipe[]`
- `recipeet:progress` — `RecipeProgress[]`
- `recipeet:settings` — `{ provider, apiKey, baseUrl, model }`
- `recipeet:version` — for future migrations

---

## 4. LLM Integration

### Abstraction
A swappable `RecipeParser` interface. Default implementation: DeepSeek via OpenAI-compatible chat completions endpoint.

### System Prompt (key instructions)
```
You are a recipe parser. Given unstructured recipe text, return JSON with:
- title, originalServings
- ingredients[]: name, quantity, unit, notes?, category (ShoppingCategory)
- steps[]: title, order, substeps[]
  - Each substep: instruction (with inline quantities), linkedIngredients[]

Rules:
1. Reorder steps: prep work before cooking steps.
2. Time-sensitive prep (e.g. "cut meat before it goes in a hot pan") gets its own step
   BEFORE the cooking step that needs it.
3. Non-urgent measuring (e.g. "add 1 tsp paprika") stays inline in the cooking substep.
4. Every substep instruction must include quantities so no scrolling is needed.
5. Categorize ingredients into the ShoppingCategory enum.
6. Default to 4 servings if unspecified.
7. Convert fractions to decimals (0.5 not 1/2).
8. linkedIngredients[].ingredientIndex refers to zero-based index in ingredients[].
```

### URL Import Flow
1. Fetch `https://r.jina.ai/{url}` with `Accept: text/plain`, `X-Return-Format: markdown`
2. Pass markdown through same LLM parser
3. On failure: show error, suggest pasting text manually

---

## 5. Conversions

### Volume (to ml)
```
tsp=5, tbsp=15, fl_oz=30, cup=240, pint=480, quart=960, gallon=3840, ml=1, l=1000
```

### Weight (to g)
```
g=1, kg=1000, oz=28.35, lb=453.6
```

### Density Table
~50 common ingredients with g/ml values. Examples: all-purpose flour=0.53, butter=0.96, sugar=0.85, water=1.0, milk=1.03.

### Conversion Popover
- Volume unit ingredients → show weight equivalent using density + metric/imperial alternatives
- Weight unit ingredients → show volume equivalent + alternatives
- No density match → show only same-type conversions
- Display: "2 cups (480 ml / 254 g / 9 oz)"

---

## 6. Scaling

```
scaledQuantity = originalQuantity × (currentServings / originalServings)
```
- `currentServings` comes from `RecipeProgress`, `originalServings` from `RecipeContent`
- Round to 2 decimal places
- Drop trailing zeros (2.00 → 2)
- Applies everywhere: shopping list, cooking mode, recipe overview

---

## 7. Shopping List Behavior

- Derived from recipe content ingredients, scaled to `currentServings` in progress
- Grouped and sorted by category
- Checkbox state persisted in `checkedShoppingItems` on the progress object
- Merge ingredients with same name + unit
- "Check all" per category + global progress indicator

---

## 8. Cooking Mode Behavior

- Steps displayed in order, one step at a time, within-viewport (no scrolling)
- Current step index persisted in `currentCookingStep` on progress
- Substep and step check states persisted in `checkedSubsteps` / `checkedSteps` on progress
- Step header auto-checks when all its substeps are checked
- Checking a step header checks all its substeps
- Completion screen on finishing last step
- Touch swipe + button navigation (desktop fallback)

---

## 9. PWA

- `manifest.json` with app name "Recipeet", icons, standalone display
- Service worker via `vite-plugin-pwa`
- Cache-first for static assets, network-first for LLM calls
- Install prompt banner
- Parsed recipes work offline; import requires network

---

## 10. Non-Functional

- Mobile-first design (≤430px primary viewport), responsive to desktop
- Semantic HTML, aria-labels on interactive elements
- Graceful error handling: bad parse → show raw text + retry; no network → show saved recipes
- No telemetry; only external calls are LLM API and jina.ai
- User's API key stored in localStorage
```
