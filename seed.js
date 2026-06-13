// seed.js — Terma Coffee catalog.
// Beans, Powder and two brewing tools (Moka Pot & French Press).
// All prices in whole NPR rupees.

export const seedProducts = [
  // ---------------- COFFEE BEANS ----------------
  {
    name: "Terma Highland Roasted Beans",
    category: "beans",
    tagline: "Whole bean · Medium-dark roast",
    emoji: "🫘",
    gradient: "linear-gradient(135deg,#6f4a2f,#3a2417)",
    description:
      "Single-origin Arabica grown in the lush hills of Nuwakot and roasted to a smooth medium-dark profile. Notes of dark chocolate, toasted almond and a gentle caramel sweetness. Roasted in small batches for freshness.",
    specs: {
      Origin: "Nuwakot, Nepal",
      Variety: "Arabica",
      "Roast level": "Medium-dark",
      "Tasting notes": "Dark chocolate, almond, caramel",
      Grind: "Whole bean",
    },
    variants: [
      { label: "100 g", price: 245 },
      { label: "200 g", price: 490 },
      { label: "250 g", price: 612 },
      { label: "500 g", price: 1225 },
      { label: "1 KG", price: 2450 },
    ],
  },

  // ---------------- COFFEE POWDER ----------------
  {
    name: "Terma Premium Fine Grind",
    category: "powder",
    tagline: "Ground coffee · Ready to brew",
    emoji: "☕",
    gradient: "linear-gradient(135deg,#8a5a36,#43291a)",
    description:
      "Our Highland beans, freshly ground to a fine, even powder — perfect for espresso machines, moka pots and filter brewing. Sealed for aroma so every cup tastes like it was just ground.",
    specs: {
      Origin: "Nuwakot, Nepal",
      Variety: "Arabica",
      "Roast level": "Medium-dark",
      Grind: "Fine powder",
      "Best for": "Espresso, moka pot, filter",
    },
    variants: [
      { label: "100 g", price: 240 },
      { label: "200 g", price: 480 },
      { label: "250 g", price: 600 },
      { label: "500 g", price: 1200 },
      { label: "1 KG", price: 2400 },
    ],
  },

  // ---------------- BREWING EQUIPMENT ----------------
  {
    name: "Terma Moka Pot",
    category: "brewing",
    tagline: "Stovetop espresso · Italian classic",
    emoji: "🫖",
    gradient: "linear-gradient(135deg,#2a2a2a,#161616)",
    description:
      "The classic Italian stovetop maker that brews rich, strong, espresso-style coffee right on your gas or electric hob — no electricity needed. Cast aluminium body with a heat-resistant handle and a safety pressure valve. Just add water, fill with Terma Premium Fine Grind, and in minutes you have a bold, aromatic brew with a velvety crema. Choose your size and colour below.",
    specs: {
      Sizes: "3 / 6 / 9 cups",
      Material: "Cast aluminium",
      Compatibility: "Gas & electric stovetop",
      Style: "Italian moka",
      Colours: "Black · White · Red",
      Warranty: "1 year",
    },
    colors: ["Black", "White", "Red"],
    variants: [
      { label: "3 cups", price: 2200 },
      { label: "6 cups", price: 2800 },
      { label: "9 cups", price: 3500 },
    ],
  },
  {
    name: "Terma French Press",
    category: "brewing",
    tagline: "Full-bodied immersion brew",
    emoji: "🫗",
    gradient: "linear-gradient(135deg,#2a2a2a,#161616)",
    description:
      "Brew smooth, full-bodied coffee with this classic French press. The thick borosilicate glass carafe sits in a sturdy stainless-steel frame, and the fine three-part mesh filter presses out every drop of flavour while keeping your cup clean. No paper filters, no electricity — just coarse-ground Terma coffee, hot water, four minutes, and press. Choose your size below.",
    specs: {
      Sizes: "3 / 6 / 9 cups",
      Material: "Borosilicate glass + stainless steel",
      Filter: "3-part fine mesh",
      Method: "Immersion brew",
      "Best with": "Terma coarse-ground beans",
      Warranty: "1 year",
    },
    variants: [
      { label: "3 cups", price: 1800 },
      { label: "6 cups", price: 2200 },
      { label: "9 cups", price: 2800 },
    ],
  },
];
