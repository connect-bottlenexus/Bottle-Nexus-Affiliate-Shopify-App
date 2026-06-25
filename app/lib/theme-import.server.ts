type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

type AdminGraphqlJson = {
  errors?: Array<{ message: string }>;
  data?: {
    theme?: {
      files?: {
        nodes?: Array<{
          filename?: string;
          body?: {
            content?: string;
          };
        }>;
        userErrors?: Array<{
          code?: string;
          filename?: string;
        }>;
      };
    };
    themeFilesUpsert?: {
      userErrors?: Array<{ message: string }>;
    };
  };
};

export type ThemeInfo = {
  id: string;
  name: string;
  role: string;
  processing?: boolean;
};

export type ThemeImportStatus = {
  activeTheme: ThemeInfo | null;
  isDawnActive: boolean;
  themes: ThemeInfo[];
};

export type ThemeActionResult = {
  ok: boolean;
  message: string;
  files?: string[];
};

export type ThemeSectionKey =
  | "hero"
  | "weekly-deals"
  | "brand-logos"
  | "best-selling"
  | "faq";

export type ThemeSectionDefinition = {
  key: ThemeSectionKey;
  title: string;
  copy: string;
  filename: string;
  body: string;
};

const homepageTemplateFilename = "templates/index.json";
const homepageSectionOrder = [
  { id: "bn_hero", type: "bn-hero", section: createThemeSection("bn-hero") },
  {
    id: "bn_weekly_deals",
    type: "bn-weekly-deals",
    section: createThemeSection("bn-weekly-deals", {
      blocks: {
        deal_1: { type: "deal", settings: {} },
        deal_2: { type: "deal", settings: {} },
        deal_3: { type: "deal", settings: {} },
      },
      block_order: ["deal_1", "deal_2", "deal_3"],
    }),
  },
  {
    id: "bn_brand_logos",
    type: "bn-brand-logos",
    section: createThemeSection("bn-brand-logos", {
      blocks: {
        logo_1: { type: "logo", settings: {} },
        logo_2: { type: "logo", settings: {} },
        logo_3: { type: "logo", settings: {} },
        logo_4: { type: "logo", settings: {} },
        logo_5: { type: "logo", settings: {} },
      },
      block_order: ["logo_1", "logo_2", "logo_3", "logo_4", "logo_5"],
    }),
  },
  {
    id: "bn_faq",
    type: "bn-faq",
    section: createThemeSection("bn-faq", {
      blocks: {
        question_1: {
          type: "question",
          settings: {
            question: "Do you ship nationwide?",
            answer:
              "<p>Aye, almost everywhere the Captain's map stretches.</p>",
          },
        },
        question_2: {
          type: "question",
          settings: {
            question: "How long will it take to get my orders?",
            answer:
              "<p>Most orders are processed quickly, and delivery timing depends on carrier service and destination.</p>",
          },
        },
        question_3: {
          type: "question",
          settings: {
            question: "What if my order arrives damaged?",
            answer:
              "<p>Contact customer support with clear photos of the package and product so the team can help review the issue.</p>",
          },
        },
        question_4: {
          type: "question",
          settings: {
            question: "What's your customer support response time?",
            answer:
              "<p>The support team aims to respond as quickly as possible during normal business hours.</p>",
          },
        },
      },
      block_order: ["question_1", "question_2", "question_3", "question_4"],
    }),
  },
] as const;

export async function getThemeImportStatus(
  admin: AdminClient,
): Promise<ThemeImportStatus> {
  const response = await admin.graphql(`#graphql
    query ThemeImportStatus {
      themes(first: 20) {
        nodes {
          id
          name
          role
          processing
        }
      }
    }`);
  const json = await response.json();
  const themes = (json.data?.themes?.nodes ?? []) as ThemeInfo[];
  const activeTheme =
    themes.find((theme) => ["MAIN", "main"].includes(theme.role)) ?? null;

  return {
    activeTheme,
    isDawnActive: Boolean(activeTheme?.name.toLowerCase().includes("dawn")),
    themes,
  };
}

export async function importBottleNexusSections(
  admin: AdminClient,
  themeId: string,
  sectionKey?: string,
): Promise<ThemeActionResult> {
  const files = sectionKey
    ? getThemeSectionFiles().filter((file) => file.key === sectionKey)
    : getThemeSectionFiles();

  if (!files.length) {
    return { ok: false, message: "Choose a valid section to import." };
  }

  const result = await adminGraphqlJson(
    admin,
    `#graphql
      mutation ImportBottleNexusSections(
        $themeId: ID!
        $files: [OnlineStoreThemeFilesUpsertFileInput!]!
      ) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        themeId,
        files: files.map((file) => ({
          filename: file.filename,
          body: {
            type: "TEXT",
            value: file.body,
          },
        })),
      },
    },
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const json = result.json;
  const graphQlErrors = (json.errors ?? [])
    .map((error: { message: string }) => error.message)
    .filter(Boolean);
  const userErrors = (
    json.data?.themeFilesUpsert?.userErrors ?? []
  ).map((error: { message: string }) => error.message);
  const errors = [...graphQlErrors, ...userErrors];

  if (errors.length) {
    const message = errors.join("; ");
    return { ok: false, message };
  }

  if (!sectionKey) {
    const placementResult = await placeBottleNexusSectionsOnHomepage(
      admin,
      themeId,
    );
    if (!placementResult.ok) {
      return {
        ok: false,
        files: files.map((file) => file.filename),
        message: `Sections were imported, but homepage placement failed: ${placementResult.message}`,
      };
    }

    return {
      ok: true,
      files: [...files.map((file) => file.filename), homepageTemplateFilename],
      message:
        "Bottle Nexus theme pack imported and added to the homepage.",
    };
  }

  return {
    ok: true,
    files: files.map((file) => file.filename),
    message:
      files.length === 1
        ? `${files[0].title} section imported into Dawn.`
        : `${files.length} Bottle Nexus sections imported into Dawn.`,
  };
}

async function placeBottleNexusSectionsOnHomepage(
  admin: AdminClient,
  themeId: string,
): Promise<ThemeActionResult> {
  const templateResult = await readThemeFileText(
    admin,
    themeId,
    homepageTemplateFilename,
  );
  if (!templateResult.ok) {
    return templateResult;
  }

  let updatedTemplate: string;
  try {
    updatedTemplate = buildHomepageTemplate(templateResult.content);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : `${homepageTemplateFilename} could not be updated.`,
    };
  }
  const result = await adminGraphqlJson(
    admin,
    `#graphql
      mutation UpsertHomepageTemplate(
        $themeId: ID!
        $files: [OnlineStoreThemeFilesUpsertFileInput!]!
      ) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        themeId,
        files: [
          {
            filename: homepageTemplateFilename,
            body: {
              type: "TEXT",
              value: updatedTemplate,
            },
          },
        ],
      },
    },
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const json = result.json;
  const errors = [
    ...extractGraphQlErrors(json.errors),
    ...extractUserErrors(json.data?.themeFilesUpsert?.userErrors),
  ];

  if (errors.length) {
    const message = errors.join("; ");
    return { ok: false, message };
  }

  return {
    ok: true,
    files: [homepageTemplateFilename],
    message: "Homepage template updated.",
  };
}

async function readThemeFileText(
  admin: AdminClient,
  themeId: string,
  filename: string,
): Promise<
  | { ok: true; content: string; message: string }
  | { ok: false; message: string }
> {
  const result = await adminGraphqlJson(
    admin,
    `#graphql
      query ThemeFile($themeId: ID!, $filenames: [String!]!) {
        theme(id: $themeId) {
          files(filenames: $filenames) {
            nodes {
              filename
              body {
                ... on OnlineStoreThemeFileBodyText {
                  content
                }
                ... on OnlineStoreThemeFileBodyBase64 {
                  contentBase64
                }
                ... on OnlineStoreThemeFileBodyUrl {
                  url
                }
              }
            }
            userErrors {
              code
              filename
            }
          }
        }
      }`,
    {
      variables: {
        themeId,
        filenames: [filename],
      },
    },
  );
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const json = result.json;
  const errors = [
    ...extractGraphQlErrors(json.errors),
    ...((json.data?.theme?.files?.userErrors ?? []) as Array<{
      code?: string;
      filename?: string;
    }>).map((error) =>
      [error.filename, error.code].filter(Boolean).join(": "),
    ),
  ].filter(Boolean);

  if (errors.length) {
    return { ok: false, message: errors.join("; ") };
  }

  const file = json.data?.theme?.files?.nodes?.find(
    (node: { filename?: string }) => node.filename === filename,
  );
  const content = file?.body?.content;

  if (typeof content !== "string") {
    return {
      ok: false,
      message: `${filename} could not be read as a text theme file.`,
    };
  }

  return { ok: true, content, message: `${filename} read.` };
}

function buildHomepageTemplate(content: string) {
  const template = parseJsonObject(content);
  const sections = parseSections(template.sections);
  const existingOrder = Array.isArray(template.order)
    ? template.order.filter((item): item is string => typeof item === "string")
    : [];
  const orderedBottleNexusIds = homepageSectionOrder.map((placement) => {
    const existingId = findSectionIdByType(sections, placement.type);
    const sectionId = existingId ?? placement.id;

    if (!sections[sectionId]) {
      sections[sectionId] = placement.section;
    }

    return sectionId;
  });
  const bottleNexusTypes = new Set<string>(
    homepageSectionOrder.map((placement) => placement.type),
  );
  const remainingOrder = existingOrder.filter((sectionId) => {
    const sectionType = sections[sectionId]?.type;

    return (
      !orderedBottleNexusIds.includes(sectionId) &&
      !bottleNexusTypes.has(sectionType)
    );
  });

  return `${JSON.stringify(
    {
      ...template,
      sections,
      order: [...orderedBottleNexusIds, ...remainingOrder],
    },
    null,
    2,
  )}\n`;
}

function parseJsonObject(content: string): Record<string, unknown> {
  const parsed = JSON.parse(stripJsonComments(content)) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${homepageTemplateFilename} is not a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

function stripJsonComments(content: string) {
  let result = "";
  let inString = false;
  let isEscaped = false;
  let index = 0;

  while (index < content.length) {
    const character = content[index];
    const nextCharacter = content[index + 1];

    if (inString) {
      result += character;
      if (isEscaped) {
        isEscaped = false;
      } else if (character === "\\") {
        isEscaped = true;
      } else if (character === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      index += 1;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      index += 2;
      while (
        index < content.length &&
        !(content[index] === "*" && content[index + 1] === "/")
      ) {
        index += 1;
      }
      index += 2;
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      index += 2;
      while (index < content.length && content[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    result += character;
    index += 1;
  }

  return result;
}

function parseSections(value: unknown): Record<string, ThemeJsonSection> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, ThemeJsonSection>;
}

function findSectionIdByType(
  sections: Record<string, ThemeJsonSection>,
  type: string,
) {
  return Object.entries(sections).find(
    ([, section]) => section?.type === type,
  )?.[0];
}

type ThemeJsonSection = {
  type: string;
  settings?: Record<string, unknown>;
  blocks?: Record<string, { type: string; settings?: Record<string, unknown> }>;
  block_order?: string[];
};

function createThemeSection(
  type: string,
  extras: Partial<ThemeJsonSection> = {},
): ThemeJsonSection {
  return {
    type,
    settings: {},
    ...extras,
  };
}

function extractGraphQlErrors(errors: Array<{ message: string }> | undefined) {
  return (errors ?? []).map((error) => error.message).filter(Boolean);
}

function extractUserErrors(errors: Array<{ message: string }> | undefined) {
  return (errors ?? []).map((error) => error.message).filter(Boolean);
}

async function adminGraphqlJson(
  admin: AdminClient,
  query: string,
  options?: { variables?: Record<string, unknown> },
): Promise<
  { ok: true; json: AdminGraphqlJson } | { ok: false; message: string }
> {
  try {
    const response = await admin.graphql(query, options);

    return { ok: true, json: (await response.json()) as AdminGraphqlJson };
  } catch (error) {
    return { ok: false, message: formatGraphqlClientError(error) };
  }
}

function formatGraphqlClientError(error: unknown) {
  const graphQlErrors = (
    error as {
      errors?: {
        graphQLErrors?: Array<{ message?: string }>;
        message?: string;
      };
    }
  ).errors;
  const graphQlMessages = graphQlErrors?.graphQLErrors
    ?.map((graphQlError) => graphQlError.message)
    .filter((message): message is string => Boolean(message));
  const message =
    graphQlMessages?.length
      ? graphQlMessages.join("; ")
      : graphQlErrors?.message ||
        (error instanceof Error ? error.message : "Shopify returned an unknown GraphQL error.");

  if (isThemeFileAccessDenied(message)) {
    return `${message} This app is requesting write_themes correctly, but Shopify has not enabled the protected Theme API exemption for this public app/API yet. Ask Shopify to verify Theme API protected access for Partner app 357169070081 and GraphQL themeFilesUpsert.`;
  }

  return message;
}

function isThemeFileAccessDenied(message: string) {
  return /themeFilesUpsert|access denied|write_themes|write_theme/i.test(
    message,
  );
}

export function getThemeSectionFiles(): ThemeSectionDefinition[] {
  return [
    {
      key: "hero",
      title: "Hero",
      copy: "Image background, overlay heading, and CTA button.",
      filename: "sections/bn-hero.liquid",
      body: heroSection,
    },
    {
      key: "weekly-deals",
      title: "Weekly Deals",
      copy: "Heading, subtitle, live countdown, and three editable product deal cards.",
      filename: "sections/bn-weekly-deals.liquid",
      body: weeklyDealsSection,
    },
    {
      key: "brand-logos",
      title: "Brand Logos",
      copy: "Shop By Brand heading, subtitle, and clickable brand logo blocks.",
      filename: "sections/bn-brand-logos.liquid",
      body: brandLogosSection,
    },
    {
      key: "best-selling",
      title: "Best Selling",
      copy: "Collection-powered product grid with a Best Selling title.",
      filename: "sections/bn-best-selling.liquid",
      body: bestSellingSection,
    },
    {
      key: "faq",
      title: "FAQ",
      copy: "Need help heading, FAQ title, and editable collapsible questions.",
      filename: "sections/bn-faq.liquid",
      body: faqSection,
    },
  ];
}

const heroSection = String.raw`{% assign heading_font = section.settings.heading_font %}
{{ heading_font | font_face: font_display: 'swap' }}
<section class="bn-hero" style="{% if section.settings.background != blank %}background-image: linear-gradient(rgba(0,0,0,{{ section.settings.overlay_opacity | divided_by: 100.0 }}), rgba(0,0,0,{{ section.settings.overlay_opacity | divided_by: 100.0 }})), url('{{ section.settings.background | image_url: width: 2400 }}');{% endif %}">
  <div class="bn-hero__content">
    <h1>{{ section.settings.heading }}</h1>
    {% if section.settings.button_label != blank %}
      <a class="bn-hero__button" href="{{ section.settings.button_link }}">{{ section.settings.button_label }}</a>
    {% endif %}
  </div>
</section>

{% style %}
  .bn-hero {
    min-height: {{ section.settings.height }}px;
    display: grid;
    place-items: center;
    background: linear-gradient(120deg, #0b1824, #1f3b46);
    background-size: cover;
    background-position: center;
    color: {{ section.settings.heading_color }};
    text-align: center;
  }
  .bn-hero__content { max-width: 980px; padding: 80px 24px; }
  .bn-hero h1 { margin: 0 0 34px; color: {{ section.settings.heading_color }}; font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }}; font-size: clamp(32px, 5vw, {{ section.settings.heading_size }}px); line-height: 1.12; letter-spacing: {{ section.settings.letter_spacing | divided_by: 100.0 }}em; font-weight: 400; }
  .bn-hero__button { display: inline-flex; align-items: center; min-height: 52px; padding: 0 34px; border-radius: {{ section.settings.button_radius }}px; background: {{ section.settings.button_background }}; color: {{ section.settings.button_text }}; text-decoration: none; letter-spacing: .16em; }
{% endstyle %}

{% schema %}
{
  "name": "BN Hero",
  "settings": [
    { "type": "image_picker", "id": "background", "label": "Background image" },
    { "type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "helvetica_n4" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Build your own bundle guided by the Captain's picks." },
    { "type": "text", "id": "button_label", "label": "Button label", "default": "Build your Bundle" },
    { "type": "url", "id": "button_link", "label": "Button link" },
    { "type": "range", "id": "height", "label": "Section height", "min": 360, "max": 820, "step": 20, "default": 560 },
    { "type": "range", "id": "heading_size", "label": "Heading size", "min": 32, "max": 96, "step": 2, "unit": "px", "default": 72 },
    { "type": "range", "id": "letter_spacing", "label": "Letter spacing", "min": 0, "max": 40, "step": 1, "unit": "%", "default": 16 },
    { "type": "range", "id": "overlay_opacity", "label": "Overlay opacity", "min": 0, "max": 80, "step": 5, "default": 25 },
    { "type": "range", "id": "button_radius", "label": "Button radius", "min": 0, "max": 32, "step": 1, "unit": "px", "default": 0 },
    { "type": "color", "id": "heading_color", "label": "Heading color", "default": "#ffffff" },
    { "type": "color", "id": "button_background", "label": "Button background", "default": "#050505" },
    { "type": "color", "id": "button_text", "label": "Button text", "default": "#ffffff" }
  ],
  "presets": [{ "name": "BN Hero" }]
}
{% endschema %}`;

const weeklyDealsSection = String.raw`{% assign heading_font = section.settings.heading_font %}
{% assign body_font = section.settings.body_font %}
{{ heading_font | font_face: font_display: 'swap' }}
{{ body_font | font_face: font_display: 'swap' }}

<section class="bn-weekly" data-section-id="{{ section.id }}">
  <div class="bn-weekly__header">
    <h3>{{ section.settings.title }}</h3>
    <p>{{ section.settings.subtitle }}</p>
    <div class="bn-weekly__countdown" data-end="{{ section.settings.end_date }}">
      <span>Ends in</span>
      <strong data-countdown-output>Set end date</strong>
    </div>
  </div>
  <div class="bn-weekly__grid">
    {% for block in section.blocks %}
      {% assign selected_product = block.settings.product %}
      {% assign product = selected_product %}
      {% if selected_product != blank and selected_product.title == blank %}
        {% assign product = all_products[selected_product] %}
      {% endif %}
      <article class="bn-weekly__card" {{ block.shopify_attributes }}>
        <span class="bn-weekly__deal">{{ block.settings.badge }}</span>
        {% if block.settings.discount != blank %}<span class="bn-weekly__discount">{{ block.settings.discount }}</span>{% endif %}
        {% if product != blank %}
        <a href="{{ product.url }}" class="bn-weekly__link">
          {% if product.featured_image %}
            {{ product.featured_image | image_url: width: 1000, height: 1000, crop: 'center' | image_tag: loading: 'lazy', class: 'bn-weekly__image' }}
          {% endif %}
          <h4>{{ product.title }}</h4>
        </a>
        <p class="bn-weekly__price">
          {{ product.price | money }}
          {% if product.compare_at_price > product.price %}
            <s>{{ product.compare_at_price | money }}</s>
          {% endif %}
        </p>
        <div class="bn-weekly__actions">
          <a href="{{ product.url }}">View Details</a>
        </div>
        {% else %}
          <div class="bn-weekly__placeholder">
            <h4>{{ block.settings.fallback_title }}</h4>
            <p>Select an active product that is published to the Online Store sales channel.</p>
          </div>
        {% endif %}
      </article>
    {% endfor %}
  </div>
</section>

{% style %}
  .bn-weekly {
    padding: {{ section.settings.padding_y }}px 24px;
    background: {{ section.settings.background_color }};
    color: {{ section.settings.text_color }};
    text-align: center;
    font-family: {{ body_font.family }}, {{ body_font.fallback_families }};
  }
  .bn-weekly__header h3 {
    margin: 0;
    color: {{ section.settings.title_color }};
    font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }};
    font-size: clamp(34px, 4vw, {{ section.settings.title_size }}px);
    line-height: 1;
  }
  .bn-weekly__header p { margin: 12px 0 28px; color: {{ section.settings.subtitle_color }}; font-size: {{ section.settings.subtitle_size }}px; }
  .bn-weekly__countdown { display: inline-flex; gap: 14px; align-items: center; padding: 14px 24px; border: 1px solid {{ section.settings.countdown_border_color }}; border-radius: {{ section.settings.countdown_radius }}px; background: {{ section.settings.countdown_background_color }}; color: {{ section.settings.countdown_text_color }}; }
  .bn-weekly__grid { max-width: 1320px; margin: 40px auto 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; }
  .bn-weekly__card { position: relative; overflow: hidden; border: 1px solid {{ section.settings.card_border_color }}; border-radius: {{ section.settings.card_radius }}px; text-align: left; background: {{ section.settings.card_background_color }}; }
  .bn-weekly__link { color: inherit; text-decoration: none; }
  .bn-weekly__image { display: block; width: min(100%, 500px); height: auto; max-height: 500px; aspect-ratio: 1 / 1; object-fit: cover; margin: 0 auto; background: #fff; }
  .bn-weekly__deal, .bn-weekly__discount { position: absolute; top: 16px; z-index: 1; border-radius: 999px; padding: 8px 18px; font-weight: 700; }
  .bn-weekly__deal { left: 16px; background: {{ section.settings.badge_background_color }}; color: {{ section.settings.badge_text_color }}; }
  .bn-weekly__discount { right: 16px; background: {{ section.settings.discount_background_color }}; color: {{ section.settings.discount_text_color }}; }
  .bn-weekly__card h4 { min-height: 92px; margin: 22px 28px; color: {{ section.settings.product_title_color }}; font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }}; font-size: {{ section.settings.product_title_size }}px; line-height: 1.12; }
  .bn-weekly__price { margin: 0 28px 24px; color: {{ section.settings.price_color }}; font-size: {{ section.settings.price_size }}px; font-weight: 800; }
  .bn-weekly__price s { margin-left: 8px; color: {{ section.settings.compare_price_color }}; font-size: .72em; }
  .bn-weekly__actions { padding: 0 28px 28px; }
  .bn-weekly__actions a { display: inline-flex; align-items: center; min-height: 52px; padding: 0 24px; border-radius: {{ section.settings.button_radius }}px; background: {{ section.settings.button_background_color }}; color: {{ section.settings.button_text_color }}; text-decoration: none; font-weight: 800; }
  .bn-weekly__placeholder { min-height: 300px; display: grid; align-content: center; padding: 32px; color: {{ section.settings.text_color }}; }
  .bn-weekly__placeholder h4 { min-height: auto; margin: 0 0 12px; }
  @media (max-width: 900px) { .bn-weekly__grid { grid-template-columns: 1fr; } }
{% endstyle %}

<script>
  (() => {
    const root = document.querySelector('[data-section-id="{{ section.id }}"]');
    if (!root) return;
    const output = root.querySelector('[data-countdown-output]');
    const rawEnd = root.querySelector('.bn-weekly__countdown')?.dataset.end;
    if (!output || !rawEnd) return;
    const parseEnd = (value) => {
      const normalized = value.includes('T') ? value : value.replace(' ', 'T');
      return new Date(normalized);
    };
    const end = parseEnd(rawEnd);
    if (Number.isNaN(end.getTime())) {
      output.textContent = 'Set end date';
      return;
    }
    const render = () => {
      const distance = end.getTime() - Date.now();
      if (distance <= 0) {
        output.textContent = 'Ended';
        return;
      }
      const totalSeconds = Math.floor(distance / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      output.textContent = days + 'd ' + String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    };
    render();
    setInterval(render, 1000);
  })();
</script>

{% schema %}
{
  "name": "BN Weekly Deals",
  "settings": [
    { "type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "helvetica_n4" },
    { "type": "font_picker", "id": "body_font", "label": "Body font", "default": "helvetica_n4" },
    { "type": "text", "id": "title", "label": "Title", "default": "Captain's Weekly Deals" },
    { "type": "text", "id": "subtitle", "label": "Subtitle", "default": "Docked for 7 days, then back to sea." },
    { "type": "text", "id": "end_date", "label": "End date and time", "info": "Use YYYY-MM-DD HH:MM or YYYY-MM-DDTHH:MM. Shopify section schemas do not provide a native date picker.", "default": "2026-12-31 23:59" },
    { "type": "range", "id": "padding_y", "label": "Vertical padding", "min": 24, "max": 120, "step": 4, "unit": "px", "default": 64 },
    { "type": "range", "id": "title_size", "label": "Title size", "min": 28, "max": 72, "step": 1, "unit": "px", "default": 58 },
    { "type": "range", "id": "subtitle_size", "label": "Subtitle size", "min": 14, "max": 32, "step": 1, "unit": "px", "default": 22 },
    { "type": "range", "id": "product_title_size", "label": "Product title size", "min": 16, "max": 34, "step": 1, "unit": "px", "default": 26 },
    { "type": "range", "id": "price_size", "label": "Price size", "min": 18, "max": 42, "step": 1, "unit": "px", "default": 30 },
    { "type": "range", "id": "card_radius", "label": "Card radius", "min": 0, "max": 32, "step": 1, "unit": "px", "default": 20 },
    { "type": "range", "id": "button_radius", "label": "Button radius", "min": 0, "max": 32, "step": 1, "unit": "px", "default": 18 },
    { "type": "range", "id": "countdown_radius", "label": "Countdown radius", "min": 0, "max": 32, "step": 1, "unit": "px", "default": 18 },
    { "type": "color", "id": "background_color", "label": "Background", "default": "#ffffff" },
    { "type": "color", "id": "title_color", "label": "Title", "default": "#ff0000" },
    { "type": "color", "id": "subtitle_color", "label": "Subtitle", "default": "#5f6368" },
    { "type": "color", "id": "text_color", "label": "Text", "default": "#111827" },
    { "type": "color", "id": "card_background_color", "label": "Card background", "default": "#f8f8f8" },
    { "type": "color", "id": "card_border_color", "label": "Card border", "default": "#dedede" },
    { "type": "color", "id": "product_title_color", "label": "Product title", "default": "#111827" },
    { "type": "color", "id": "price_color", "label": "Price", "default": "#111827" },
    { "type": "color", "id": "compare_price_color", "label": "Compare-at price", "default": "#6b7280" },
    { "type": "color", "id": "button_background_color", "label": "Button background", "default": "#e0b852" },
    { "type": "color", "id": "button_text_color", "label": "Button text", "default": "#111827" },
    { "type": "color", "id": "badge_background_color", "label": "Badge background", "default": "#d9af49" },
    { "type": "color", "id": "badge_text_color", "label": "Badge text", "default": "#111827" },
    { "type": "color", "id": "discount_background_color", "label": "Discount background", "default": "#ff0000" },
    { "type": "color", "id": "discount_text_color", "label": "Discount text", "default": "#ffffff" },
    { "type": "color", "id": "countdown_background_color", "label": "Countdown background", "default": "#f5f5f7" },
    { "type": "color", "id": "countdown_text_color", "label": "Countdown text", "default": "#111827" },
    { "type": "color", "id": "countdown_border_color", "label": "Countdown border", "default": "#d9d9de" }
  ],
  "blocks": [
    {
      "type": "deal",
      "name": "Weekly deal",
      "settings": [
        { "type": "product", "id": "product", "label": "Product" },
        { "type": "text", "id": "fallback_title", "label": "Fallback title", "default": "Weekly deal product" },
        { "type": "text", "id": "badge", "label": "Badge", "default": "Weekly Deal" },
        { "type": "text", "id": "discount", "label": "Discount", "default": "15% OFF" }
      ]
    }
  ],
  "max_blocks": 3,
  "presets": [
    { "name": "BN Weekly Deals", "blocks": [{ "type": "deal" }, { "type": "deal" }, { "type": "deal" }] }
  ]
}
{% endschema %}`;

const brandLogosSection = String.raw`{% assign heading_font = section.settings.heading_font %}
{% assign body_font = section.settings.body_font %}
{{ heading_font | font_face: font_display: 'swap' }}
{{ body_font | font_face: font_display: 'swap' }}
<section class="bn-brands">
  <h2>{{ section.settings.heading }}</h2>
  <p>{{ section.settings.subheading }}</p>
  <div class="bn-brands__grid">
    {% for block in section.blocks %}
      <a class="bn-brands__logo" href="{{ block.settings.link }}" {{ block.shopify_attributes }}>
        {% if block.settings.logo %}
          {{ block.settings.logo | image_url: width: 360 | image_tag: loading: 'lazy', alt: block.settings.alt }}
        {% else %}
          <span>{{ block.settings.alt }}</span>
        {% endif %}
      </a>
    {% endfor %}
  </div>
</section>

{% style %}
  .bn-brands { padding: {{ section.settings.padding_y }}px 24px; text-align: center; background: {{ section.settings.background_color }}; font-family: {{ body_font.family }}, {{ body_font.fallback_families }}; }
  .bn-brands h2 { margin: 0; color: {{ section.settings.heading_color }}; font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }}; font-size: clamp(32px, 4vw, {{ section.settings.heading_size }}px); letter-spacing: .08em; }
  .bn-brands p { margin: 18px 0 56px; color: {{ section.settings.subheading_color }}; font-size: {{ section.settings.subheading_size }}px; }
  .bn-brands__grid { max-width: 1440px; margin: 0 auto; display: grid; grid-template-columns: repeat(5, minmax(120px, 1fr)); gap: 54px 76px; align-items: center; }
  .bn-brands__logo { display: grid; place-items: center; min-height: 72px; color: #111; text-decoration: none; }
  .bn-brands__logo img { max-width: 190px; max-height: 82px; object-fit: contain; filter: grayscale(1); }
  @media (max-width: 900px) { .bn-brands__grid { grid-template-columns: repeat(2, minmax(120px, 1fr)); gap: 32px; } }
{% endstyle %}

{% schema %}
{
  "name": "BN Brand Logos",
  "settings": [
    { "type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "helvetica_n4" },
    { "type": "font_picker", "id": "body_font", "label": "Body font", "default": "helvetica_n4" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Shop By Brand" },
    { "type": "text", "id": "subheading", "label": "Subheading", "default": "Discover The Entire Collection" },
    { "type": "range", "id": "padding_y", "label": "Vertical padding", "min": 24, "max": 120, "step": 4, "unit": "px", "default": 72 },
    { "type": "range", "id": "heading_size", "label": "Heading size", "min": 28, "max": 72, "step": 1, "unit": "px", "default": 48 },
    { "type": "range", "id": "subheading_size", "label": "Subheading size", "min": 14, "max": 34, "step": 1, "unit": "px", "default": 22 },
    { "type": "color", "id": "background_color", "label": "Background", "default": "#ffffff" },
    { "type": "color", "id": "heading_color", "label": "Heading", "default": "#ff0000" },
    { "type": "color", "id": "subheading_color", "label": "Subheading", "default": "#444444" }
  ],
  "blocks": [
    {
      "type": "logo",
      "name": "Logo",
      "settings": [
        { "type": "image_picker", "id": "logo", "label": "Logo image" },
        { "type": "url", "id": "link", "label": "Logo link" },
        { "type": "text", "id": "alt", "label": "Logo alt text", "default": "Brand logo" }
      ]
    }
  ],
  "presets": [{ "name": "BN Brand Logos", "blocks": [{ "type": "logo" }, { "type": "logo" }, { "type": "logo" }, { "type": "logo" }, { "type": "logo" }] }]
}
{% endschema %}`;

const bestSellingSection = String.raw`{% assign heading_font = section.settings.heading_font %}
{% assign body_font = section.settings.body_font %}
{{ heading_font | font_face: font_display: 'swap' }}
{{ body_font | font_face: font_display: 'swap' }}

<section class="bn-best">
  <h2>{{ section.settings.title }}</h2>
  {% assign collection = section.settings.collection %}
  <div class="bn-best__grid">
    {% if collection != blank %}
      {% for product in collection.products limit: section.settings.limit %}
        <a class="bn-best__product" href="{{ product.url }}">
          {% if product.featured_image %}
            {{ product.featured_image | image_url: width: 520 | image_tag: loading: 'lazy' }}
          {% endif %}
          <h3>{{ product.title }}</h3>
          <p>{{ product.price | money }}</p>
        </a>
      {% endfor %}
    {% else %}
      <p class="bn-best__empty">Choose a collection in the theme editor.</p>
    {% endif %}
  </div>
</section>

{% style %}
  .bn-best {
    padding: {{ section.settings.padding_y }}px 24px;
    text-align: center;
    background: {{ section.settings.background_color }};
    font-family: {{ body_font.family }}, {{ body_font.fallback_families }};
  }
  .bn-best h2 {
    margin: 0 0 52px;
    color: {{ section.settings.heading_color }};
    font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }};
    font-size: clamp(34px, 4vw, {{ section.settings.heading_size }}px);
    letter-spacing: {{ section.settings.letter_spacing | divided_by: 100.0 }}em;
  }
  .bn-best__grid { max-width: 1500px; margin: 0 auto; display: grid; grid-template-columns: repeat({{ section.settings.columns }}, minmax(0, 1fr)); gap: {{ section.settings.row_gap }}px {{ section.settings.column_gap }}px; }
  .bn-best__product { color: {{ section.settings.product_title_color }}; text-decoration: none; }
  .bn-best__product img { width: 100%; aspect-ratio: 1; object-fit: contain; }
  .bn-best__product h3 { min-height: 56px; margin: 18px 0 8px; color: {{ section.settings.product_title_color }}; font-size: {{ section.settings.product_title_size }}px; line-height: 1.25; }
  .bn-best__product p { margin: 0; color: {{ section.settings.price_color }}; font-size: {{ section.settings.price_size }}px; font-weight: 800; }
  .bn-best__empty { grid-column: 1 / -1; margin: 0; color: {{ section.settings.empty_text_color }}; font-size: 18px; }
  @media (max-width: 900px) { .bn-best__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { .bn-best__grid { grid-template-columns: 1fr; } }
{% endstyle %}

{% schema %}
{
  "name": "BN Best Selling",
  "settings": [
    { "type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "helvetica_n4" },
    { "type": "font_picker", "id": "body_font", "label": "Body font", "default": "helvetica_n4" },
    { "type": "text", "id": "title", "label": "Title", "default": "Best Selling" },
    { "type": "collection", "id": "collection", "label": "Collection" },
    { "type": "range", "id": "limit", "label": "Products to show", "min": 4, "max": 24, "step": 4, "default": 8 },
    { "type": "range", "id": "columns", "label": "Columns", "min": 2, "max": 6, "step": 1, "default": 4 },
    { "type": "range", "id": "padding_y", "label": "Vertical padding", "min": 24, "max": 120, "step": 4, "unit": "px", "default": 64 },
    { "type": "range", "id": "heading_size", "label": "Heading size", "min": 28, "max": 72, "step": 1, "unit": "px", "default": 48 },
    { "type": "range", "id": "letter_spacing", "label": "Heading letter spacing", "min": 0, "max": 30, "step": 1, "unit": "%", "default": 12 },
    { "type": "range", "id": "product_title_size", "label": "Product title size", "min": 14, "max": 28, "step": 1, "unit": "px", "default": 18 },
    { "type": "range", "id": "price_size", "label": "Price size", "min": 14, "max": 32, "step": 1, "unit": "px", "default": 18 },
    { "type": "range", "id": "row_gap", "label": "Row gap", "min": 16, "max": 72, "step": 2, "unit": "px", "default": 44 },
    { "type": "range", "id": "column_gap", "label": "Column gap", "min": 12, "max": 72, "step": 2, "unit": "px", "default": 34 },
    { "type": "color", "id": "background_color", "label": "Background", "default": "#ffffff" },
    { "type": "color", "id": "heading_color", "label": "Heading", "default": "#111111" },
    { "type": "color", "id": "product_title_color", "label": "Product title", "default": "#111827" },
    { "type": "color", "id": "price_color", "label": "Price", "default": "#ff0000" },
    { "type": "color", "id": "empty_text_color", "label": "Empty state text", "default": "#6b7280" }
  ],
  "presets": [{ "name": "BN Best Selling" }]
}
{% endschema %}`;

const faqSection = String.raw`{% assign heading_font = section.settings.heading_font %}
{% assign body_font = section.settings.body_font %}
{{ heading_font | font_face: font_display: 'swap' }}
{{ body_font | font_face: font_display: 'swap' }}

<section class="bn-faq">
  <div class="bn-faq__inner">
    <h4>{{ section.settings.kicker }}</h4>
    <h1>{{ section.settings.title }}</h1>
    <div class="bn-faq__items">
      {% for block in section.blocks %}
        <details class="bn-faq__item" {{ block.shopify_attributes }}>
          <summary>{{ block.settings.question }} <span>+</span></summary>
          <div class="bn-faq__answer">{{ block.settings.answer }}</div>
        </details>
      {% endfor %}
    </div>
  </div>
</section>

{% style %}
  .bn-faq {
    padding: {{ section.settings.padding_top }}px 24px {{ section.settings.padding_bottom }}px;
    background: {{ section.settings.background_color }};
    color: {{ section.settings.text_color }};
    font-family: {{ body_font.family }}, {{ body_font.fallback_families }};
  }
  .bn-faq__inner { max-width: 780px; margin: 0 auto; text-align: center; }
  .bn-faq h4 { margin: 0 0 30px; color: {{ section.settings.kicker_color }}; font-size: {{ section.settings.kicker_size }}px; font-weight: 400; letter-spacing: {{ section.settings.kicker_letter_spacing | divided_by: 100.0 }}em; }
  .bn-faq h1 { margin: 0 0 56px; color: {{ section.settings.title_color }}; font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }}; font-size: clamp(34px, 4vw, {{ section.settings.title_size }}px); font-weight: 400; letter-spacing: {{ section.settings.title_letter_spacing | divided_by: 100.0 }}em; }
  .bn-faq__item { border-top: 1px solid {{ section.settings.border_color }}; text-align: left; }
  .bn-faq__item:last-child { border-bottom: 1px solid {{ section.settings.border_color }}; }
  .bn-faq summary { cursor: pointer; display: flex; justify-content: space-between; gap: 24px; padding: {{ section.settings.question_padding }}px 0; color: {{ section.settings.question_color }}; font-family: {{ heading_font.family }}, {{ heading_font.fallback_families }}; font-size: {{ section.settings.question_size }}px; font-weight: 800; list-style: none; }
  .bn-faq summary::-webkit-details-marker { display: none; }
  .bn-faq__answer { padding: 0 0 28px; color: {{ section.settings.answer_color }}; font-size: {{ section.settings.answer_size }}px; line-height: 1.7; }
{% endstyle %}

{% schema %}
{
  "name": "BN FAQ",
  "settings": [
    { "type": "font_picker", "id": "heading_font", "label": "Heading font", "default": "helvetica_n4" },
    { "type": "font_picker", "id": "body_font", "label": "Body font", "default": "helvetica_n4" },
    { "type": "text", "id": "kicker", "label": "Small heading", "default": "Need help?" },
    { "type": "text", "id": "title", "label": "Title", "default": "Frequently Asked Questions" },
    { "type": "range", "id": "padding_top", "label": "Top padding", "min": 24, "max": 140, "step": 4, "unit": "px", "default": 76 },
    { "type": "range", "id": "padding_bottom", "label": "Bottom padding", "min": 24, "max": 140, "step": 4, "unit": "px", "default": 96 },
    { "type": "range", "id": "kicker_size", "label": "Small heading size", "min": 12, "max": 28, "step": 1, "unit": "px", "default": 16 },
    { "type": "range", "id": "title_size", "label": "Title size", "min": 30, "max": 72, "step": 1, "unit": "px", "default": 52 },
    { "type": "range", "id": "question_size", "label": "Question size", "min": 16, "max": 32, "step": 1, "unit": "px", "default": 22 },
    { "type": "range", "id": "answer_size", "label": "Answer size", "min": 14, "max": 24, "step": 1, "unit": "px", "default": 17 },
    { "type": "range", "id": "question_padding", "label": "Question vertical padding", "min": 14, "max": 44, "step": 1, "unit": "px", "default": 28 },
    { "type": "range", "id": "kicker_letter_spacing", "label": "Small heading letter spacing", "min": 0, "max": 45, "step": 1, "unit": "%", "default": 35 },
    { "type": "range", "id": "title_letter_spacing", "label": "Title letter spacing", "min": 0, "max": 35, "step": 1, "unit": "%", "default": 20 },
    { "type": "color", "id": "background_color", "label": "Background", "default": "#000000" },
    { "type": "color", "id": "text_color", "label": "Base text", "default": "#ffffff" },
    { "type": "color", "id": "kicker_color", "label": "Small heading", "default": "#ffffff" },
    { "type": "color", "id": "title_color", "label": "Title", "default": "#ffffff" },
    { "type": "color", "id": "question_color", "label": "Question", "default": "#ffffff" },
    { "type": "color", "id": "answer_color", "label": "Answer", "default": "#d6d6d6" },
    { "type": "color", "id": "border_color", "label": "Divider", "default": "#2c2c2c" }
  ],
  "blocks": [
    {
      "type": "question",
      "name": "Question",
      "settings": [
        { "type": "text", "id": "question", "label": "Question", "default": "Do you ship nationwide?" },
        { "type": "richtext", "id": "answer", "label": "Answer", "default": "<p>Aye, almost everywhere the Captain's map stretches.</p>" }
      ]
    }
  ],
  "presets": [{ "name": "BN FAQ", "blocks": [{ "type": "question" }, { "type": "question" }, { "type": "question" }, { "type": "question" }] }]
}
{% endschema %}`;
