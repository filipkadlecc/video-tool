// Parameter schemas for the branded snippet library.
//
// Each snippet's source file (remotion/scenes/branded/<Id>.tsx) keeps its
// user-editable values as top-of-file `const NAME = "...";` declarations.
// The schemas below describe those parameters so the form renderer
// (components/SnippetParamsForm.tsx) can collect input and the substituter
// (lib/snippet-template.ts) can produce a customized scene without involving
// the AI at all.
//
// Param keys MUST match the snippet's constant name exactly — the substituter
// uses them in line-anchored regex matches.

export interface StringParam {
  kind: "string";
  label: string;
  default: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
}

export interface BooleanParam {
  kind: "boolean";
  label: string;
  default: boolean;
  description?: string;
}

export interface EnumParam {
  kind: "enum";
  label: string;
  default: string;
  options: { value: string; label: string }[];
}

export interface NumberParam {
  kind: "number";
  label: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
}

export type ArrayItemParam = StringParam | BooleanParam | EnumParam | NumberParam;

export interface ArrayParam {
  kind: "array";
  label: string;
  addLabel: string;
  // For arrays of primitive strings, set `itemSchema` to a single-field schema
  // with a conventional key of `value`. The substituter detects this shape and
  // emits a flat string array. Otherwise items are rendered as object literals.
  itemSchema: Record<string, ArrayItemParam>;
  default: Record<string, unknown>[];
  min?: number;
  max?: number;
}

// Image uploads. The form reads picked files as data URIs (no server round-trip)
// and stores them as a string[]; the substituter emits a `const KEY: string[]`
// literal of those data URIs, so the scene stays self-contained.
export interface ImagesParam {
  kind: "images";
  label: string;
  default: string[];
  max?: number;
  description?: string;
}

export type Param = StringParam | BooleanParam | EnumParam | NumberParam | ArrayParam | ImagesParam;

export interface SnippetSchema {
  params: Record<string, Param>;
  // Predicate-based visibility. If a key is present here, the field renders
  // only when the predicate returns true against the current values map.
  // Hidden fields keep their values so toggling back restores them.
  showIf?: Record<string, (values: Record<string, unknown>) => boolean>;
}

// =============================================================================
// Per-snippet schemas
// =============================================================================

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const SNIPPET_SCHEMAS: Record<string, SnippetSchema> = {
  IntroCard: {
    params: {
      HEADLINE_LEAD: { kind: "string", label: "Headline — lead text", default: "Real-time web data for" },
      HEADLINE_HIGHLIGHT: {
        kind: "string",
        label: "Highlighted phrase",
        default: "social media monitoring",
        placeholder: "the orange-pill phrase",
      },
      HEADLINE_TAIL: {
        kind: "string",
        label: "Headline — tail text",
        default: "and lead generation.",
      },
      SUBHEAD: {
        kind: "string",
        label: "Subhead",
        default: "Your one-line subhead — keep it under 80 characters.",
        multiline: true,
      },
    },
  },

  StatCallout: {
    params: {
      VALUE: { kind: "number", label: "Big number value", default: 200, min: 0 },
      PREFIX: { kind: "string", label: "Prefix (optional)", default: "", placeholder: "e.g. $" },
      SUFFIX: { kind: "string", label: "Suffix (orange pill)", default: "M", placeholder: "e.g. M, K, +" },
      HEADLINE: { kind: "string", label: "Headline", default: "Actor runs in a single month" },
      CAPTION: {
        kind: "string",
        label: "Caption",
        default: "Made possible by every creator building on Apify",
        multiline: true,
      },
    },
  },

  ListReveal: {
    params: {
      HEADLINE_LEAD: { kind: "string", label: "Headline — lead", default: "Why teams pick" },
      HEADLINE_HIGHLIGHT: { kind: "string", label: "Highlighted phrase", default: "Apify" },
      HEADLINE_TAIL: { kind: "string", label: "Headline — tail", default: "" },
      ITEMS: {
        kind: "array",
        label: "Checklist items",
        addLabel: "Add item",
        itemSchema: {
          label: { kind: "string", label: "Label", default: "Feature name" },
          descriptor: {
            kind: "string",
            label: "Descriptor (optional)",
            default: "",
            placeholder: "Short supporting line",
          },
        },
        default: [
          { label: "Lead generation", descriptor: "B2B prospect lists from public web sources" },
          { label: "Competitive intelligence", descriptor: "Pricing, ads, and feature tracking" },
          { label: "AI search monitoring", descriptor: "Track how your brand appears in LLM answers" },
          { label: "Social media monitoring", descriptor: "Mentions, sentiment, and trend signals" },
        ],
      },
    },
  },

  PathReveal: {
    params: {
      TITLE: { kind: "string", label: "Title", default: "Drawn in motion" },
      SUBTITLE: { kind: "string", label: "Subtitle", default: "Programmable video, built on web tech" },
    },
  },

  EndCard: {
    params: {
      CTA_HEADLINE: { kind: "string", label: "CTA headline", default: "Try Apify for free" },
      CTA_URL: { kind: "string", label: "CTA URL / button label", default: "apify.com/store" },
      PROMO_LINE: { kind: "string", label: "Promo line", default: "Get $100 prepaid usage" },
      PROMO_CODE: { kind: "string", label: "Promo code", default: "PLGTM25" },
    },
  },

  CalloutBanner: {
    params: {
      LEAD: { kind: "string", label: "Headline — lead", default: "Build something" },
      HIGHLIGHT: { kind: "string", label: "Highlighted phrase", default: "people actually use." },
      SUBHEAD: { kind: "string", label: "Subhead", default: "Ship in minutes — without owning the infra." },
    },
  },

  QuoteCard: {
    params: {
      QUOTE: {
        kind: "string",
        label: "Quote",
        default: "From 10 emails per day to a database of 400 in just one week.",
        multiline: true,
      },
      AUTHOR: { kind: "string", label: "Author", default: "Marketing Lead" },
      COMPANY: { kind: "string", label: "Company / role detail", default: "CMS at Stoneup House" },
    },
  },

  LowerThird: {
    params: {
      NAME: { kind: "string", label: "Name", default: "Speaker Name", placeholder: "e.g. Josef Vecernik" },
      TITLE: { kind: "string", label: "Title / role", default: "Speaker Role", placeholder: "e.g. Make" },
      ALIGN: { kind: "enum", label: "Anchor corner", default: "left", options: ALIGN_OPTIONS },
      DUAL: {
        kind: "boolean",
        label: "Two speakers",
        default: false,
        description: "Render a second card on the opposite corner.",
      },
      PARTNER_NAME: { kind: "string", label: "Partner name", default: "Partner Name" },
      PARTNER_TITLE: { kind: "string", label: "Partner title / role", default: "Partner Role" },
    },
    showIf: {
      PARTNER_NAME: (v) => v.DUAL === true,
      PARTNER_TITLE: (v) => v.DUAL === true,
    },
  },

  LogoBumper: {
    // No editable params — just a logo reveal. Inserter skips the form.
    params: {},
  },

  SymbolBug: {
    params: {
      URL_TEXT: { kind: "string", label: "URL label", default: "apify.com" },
    },
  },

  AccountCTA: {
    params: {
      HEADLINE: { kind: "string", label: "Headline", default: "Create a free Apify account" },
      URL_TEXT: { kind: "string", label: "URL label", default: "apify.com" },
      CTA_LABEL: { kind: "string", label: "Button label", default: "Start free" },
      ALIGN: { kind: "enum", label: "Anchor corner", default: "left", options: ALIGN_OPTIONS },
    },
  },

  CodeSnippet: {
    params: {
      FILENAME: { kind: "string", label: "Filename", default: "main.ts" },
      LINES: {
        kind: "array",
        label: "Code lines",
        addLabel: "Add line",
        // Single-`value` itemSchema → emitted as a flat string[] literal.
        itemSchema: { value: { kind: "string", label: "Line", default: "" } },
        default: [
          { value: "import { Actor } from \"apify\";" },
          { value: "" },
          { value: "await Actor.init();" },
          { value: "" },
          { value: "const input = await Actor.getInput();" },
          { value: " console.log(\"Hello, \", input.name);" },
          { value: "" },
          { value: "await Actor.exit();" },
        ],
      },
    },
  },

  RisingStarsList: {
    params: {
      EYEBROW: { kind: "string", label: "Eyebrow", default: "Rising Stars" },
      HEADLINE: { kind: "string", label: "Headline", default: "New Actors worth your attention" },
      ROWS: {
        kind: "array",
        label: "Actor rows",
        addLabel: "Add Actor",
        itemSchema: {
          name: { kind: "string", label: "Name", default: "Actor name" },
          author: { kind: "string", label: "Author", default: "by author" },
        },
        default: [
          { name: "1688.com Products Scraper", author: "by devcake" },
          { name: "Insta Comment Bot", author: "by lumora" },
          { name: "LinkedIn Leads Finder", author: "by apify-labs" },
          { name: "Threads Mention Tracker", author: "by petr.b" },
        ],
      },
    },
  },

  LogoGridStrip: {
    params: {
      EYEBROW: { kind: "string", label: "Eyebrow", default: "Works with" },
      HEADLINE: { kind: "string", label: "Headline", default: "Your favorite tools for AI" },
      LOGOS: {
        kind: "array",
        label: "Logos",
        addLabel: "Add logo",
        itemSchema: {
          src: {
            kind: "string",
            label: "Asset path",
            default: "assets/logos/Claude_Logo.svg",
            placeholder: "assets/logos/...",
          },
          label: { kind: "string", label: "Label", default: "Brand name" },
        },
        default: [
          { src: "assets/logos/Claude_Logo.svg", label: "Claude" },
          { src: "assets/logos/Codex_Logo.png", label: "Codex" },
          { src: "assets/logos/Cusror_Logo.png", label: "Cursor" },
          { src: "assets/logos/Antigravity_Logo.png", label: "Antigravity" },
        ],
      },
    },
  },

  FourQuadrant: {
    params: {
      HEADLINE: { kind: "string", label: "Headline", default: "One Apify, four superpowers" },
      CARDS: {
        kind: "array",
        label: "Cards",
        addLabel: "Add card",
        itemSchema: {
          rank: { kind: "string", label: "Rank letter", default: "A" },
          title: { kind: "string", label: "Title", default: "Card title" },
          body: { kind: "string", label: "Body", default: "One-line description.", multiline: true },
        },
        default: [
          { rank: "A", title: "Scrape any site", body: "5,000+ pre-built Actors plus a low-code SDK for the rest." },
          { rank: "B", title: "Automate browsers", body: "Headless Chrome, stealth proxies, CAPTCHA bypass — handled." },
          { rank: "C", title: "Schedule + monitor", body: "Cron triggers, alerts, retries. Your team sleeps; the bot runs." },
          { rank: "D", title: "Ship to anywhere", body: "Webhooks, S3, Snowflake, Postgres. Pipe results in seconds." },
        ],
      },
    },
  },

  BeforeAfter: {
    params: {
      HEADLINE_LEAD: { kind: "string", label: "Headline — lead", default: "Scrape and verify" },
      HEADLINE_HIGHLIGHT: { kind: "string", label: "Highlighted phrase", default: "in one run" },
      BEFORE_LABEL: { kind: "string", label: "Before label", default: "Before" },
      BEFORE_ROWS: {
        kind: "array",
        label: "Before rows",
        addLabel: "Add row",
        itemSchema: { value: { kind: "string", label: "Row", default: "row text" } },
        default: [
          { value: "raw@email.io" },
          { value: "support@no-mx.example" },
          { value: "ceo@startup.io" },
          { value: "info@unknown.dev" },
        ],
      },
      AFTER_LABEL: { kind: "string", label: "After label", default: "After" },
      AFTER_ROWS: {
        kind: "array",
        label: "After rows",
        addLabel: "Add row",
        itemSchema: { value: { kind: "string", label: "Row", default: "row text" } },
        default: [
          { value: "✓ raw@email.io · MX ok" },
          { value: "✗ support@no-mx.example · invalid" },
          { value: "✓ ceo@startup.io · MX ok" },
          { value: "✓ info@unknown.dev · catch-all" },
        ],
      },
    },
  },

  EventCard: {
    params: {
      EYEBROW: { kind: "string", label: "Date / venue eyebrow", default: "May 11 · San Francisco" },
      TITLE_LEAD: { kind: "string", label: "Title — line 1", default: "OpenClaw" },
      TITLE_HIGHLIGHT: { kind: "string", label: "Title — line 2 (highlighted)", default: "agentic night" },
      SPONSOR_LINE: { kind: "string", label: "Sponsor line", default: "Hosted with" },
    },
  },

  ActorStoreCard: {
    params: {
      ACTOR_TITLE: { kind: "string", label: "Actor title", default: "Dentist & Doctor Lead Scraper" },
      ACTOR_HANDLE: { kind: "string", label: "Handle (author/actor)", default: "samstorm/dentist-lead-scraper" },
      ACTOR_DESC: {
        kind: "string",
        label: "Description",
        default: "Scrape dentist, doctor & clinic contacts from Google Maps with verified emails, phones & socials.",
        multiline: true,
      },
      AUTHOR_NAME: { kind: "string", label: "Author name", default: "Sam Kleespies" },
      AUTHOR_INITIAL: { kind: "string", label: "Author avatar initial", default: "S", maxLength: 2 },
      ICON_GLYPH: { kind: "string", label: "Icon tile glyph", default: "🦷", placeholder: "emoji or 1–2 chars" },
    },
  },

  EventContour: {
    params: {
      EYEBROW: { kind: "string", label: "Date / venue eyebrow", default: "July 2, 2026 · European Startup Embassy, SF" },
      HEADLINE_LEAD: { kind: "string", label: "Headline — line 1", default: "AI Engineer World's Fair" },
      HEADLINE_HIGHLIGHT: { kind: "string", label: "Headline — line 2 (highlighted)", default: "Rooftop Afterparty" },
      SUBHEAD: {
        kind: "string",
        label: "Subhead",
        default: "Drinks, demos, and the people building the agentic web.",
        multiline: true,
      },
    },
  },

  HiringCard: {
    params: {
      HEADLINE_LEAD: { kind: "string", label: "Headline — lead", default: "Hiring in" },
      HEADLINE_HIGHLIGHT: { kind: "string", label: "Highlighted phrase", default: "September" },
      TAGS: {
        kind: "array",
        label: "Category tags",
        addLabel: "Add tag",
        itemSchema: { value: { kind: "string", label: "Tag", default: "Engineering" } },
        default: [{ value: "Engineering" }, { value: "GTM" }],
      },
      ROLES: {
        kind: "array",
        label: "Open roles",
        addLabel: "Add role",
        itemSchema: {
          name: { kind: "string", label: "Role", default: "Role title" },
          dept: { kind: "string", label: "Department", default: "Engineering" },
        },
        default: [
          { name: "Senior Backend Engineer", dept: "Engineering" },
          { name: "Engineering Manager", dept: "Engineering" },
          { name: "Creator Growth Lead", dept: "GTM" },
          { name: "Product Marketing Manager", dept: "GTM" },
          { name: "Senior Product Marketing Manager", dept: "GTM" },
        ],
      },
      CTA: { kind: "string", label: "CTA label", default: "apply here" },
    },
  },

  ChartReveal: {
    params: {
      EYEBROW: { kind: "string", label: "Eyebrow", default: "Benchmark" },
      HEADLINE_LEAD: { kind: "string", label: "Headline — lead", default: "How to run a" },
      HEADLINE_HIGHLIGHT: { kind: "string", label: "Highlighted phrase", default: "content gap analysis" },
    },
  },

  PromptBox: {
    params: {
      PROMPT_TEXT: {
        kind: "string",
        label: "Prompt text",
        default:
          "Based on these 2 analysis tasks, please prepare four concrete video ideas — each with a working title, format, length, and the data point that supports it.",
        multiline: true,
      },
      MODEL_LABEL: { kind: "string", label: "Model label", default: "Opus 4.7" },
      MODE_LABEL: { kind: "string", label: "Mode label", default: "Extra" },
      TYPING_SECONDS: { kind: "number", label: "Typing duration (s)", default: 2.4, min: 0.2, step: 0.1 },
      HOLD_SECONDS: { kind: "number", label: "Hold after typing (s)", default: 1.2, min: 0, step: 0.1 },
    },
  },

  AiChat: {
    params: {
      PROMPT: {
        kind: "string",
        label: "Prompt (the user message)",
        default: "Track my competitor's prices on Amazon.",
        multiline: true,
        placeholder: "What you asked the AI…",
      },
      ANSWER_MODE: {
        kind: "enum",
        label: "Answer as",
        default: "text",
        options: [
          { value: "text", label: "Text" },
          { value: "images", label: "Screenshots" },
        ],
      },
      ANSWER_TEXT: {
        kind: "string",
        label: "Answer — text",
        default:
          "Paste the AI's answer here — plain text is fine. It types out line by line, keeping your paragraph breaks.",
        multiline: true,
        placeholder: "Paste the AI's answer text…",
      },
      ANSWER_IMAGES: {
        kind: "images",
        label: "Answer — screenshots",
        default: [],
        max: 8,
        description: "Add screenshots of the AI's output (top to bottom). They scroll in like a chat.",
      },
      SHOW_LOGO: {
        kind: "boolean",
        label: "Apify logo outro",
        default: true,
        description: "End on the Apify wordmark. Turn off to end on the answer.",
      },
    },
    showIf: {
      ANSWER_TEXT: (v) => v.ANSWER_MODE !== "images",
      ANSWER_IMAGES: (v) => v.ANSWER_MODE === "images",
    },
  },
};

export function getSnippetSchema(id: string): SnippetSchema | undefined {
  return SNIPPET_SCHEMAS[id];
}

export function buildDefaultValues(schema: SnippetSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, param] of Object.entries(schema.params)) {
    out[key] = param.default;
  }
  return out;
}

export function isFieldVisible(
  schema: SnippetSchema,
  key: string,
  values: Record<string, unknown>,
): boolean {
  const predicate = schema.showIf?.[key];
  return predicate ? predicate(values) : true;
}
