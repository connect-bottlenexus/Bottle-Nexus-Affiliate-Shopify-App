export type CatalogImage = {
  id: string;
  url: string;
  altText: string | null;
};

export type CatalogOption = {
  id: string;
  name: string;
  values: string[];
};

export type CatalogVariant = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  taxable: boolean;
  inventoryPolicy: "CONTINUE" | "DENY";
  inventoryQuantity: number | null;
  inventoryTracked: boolean;
  selectedOptions: Array<{ name: string; value: string }>;
};

export type CatalogProduct = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  totalInventory: number | null;
  options: CatalogOption[];
  variants: CatalogVariant[];
  images: CatalogImage[];
};

export type CatalogResult = {
  products: CatalogProduct[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  error?: string;
};

export type CatalogFilters = {
  search?: string;
  vendor?: string;
  productType?: string;
  status?: "ACTIVE" | "DRAFT";
  inventory?: "in_stock" | "out_of_stock" | "not_tracked";
  importState?: "imported" | "not_imported";
  after?: string;
  before?: string;
};

export type CatalogFacets = {
  vendors: string[];
  productTypes: string[];
};

type CaptainProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | null;
  status?: CatalogProduct["status"] | null;
  totalInventory?: number | null;
  options?: CatalogOption[] | null;
  variants?: { nodes?: CaptainVariantNode[] | null } | null;
  media?: { nodes?: CaptainMediaNode[] | null } | null;
};

type CaptainVariantNode = Omit<CatalogVariant, "inventoryTracked"> & {
  inventoryItem?: {
    tracked?: boolean | null;
  } | null;
};

type CaptainMediaNode = {
  id?: string;
  alt?: string | null;
  image?: {
    url?: string | null;
    altText?: string | null;
  } | null;
};

const captainShop =
  process.env.CAPTAIN_CASKWELL_SHOP_DOMAIN ?? "captaincaskwell.myshopify.com";
const captainApiVersion =
  process.env.CAPTAIN_CASKWELL_API_VERSION ?? "2026-01";

const emptyPageInfo = {
  hasNextPage: false,
  hasPreviousPage: false,
  startCursor: null,
  endCursor: null,
};

export async function getCaptainProducts(
  filters: CatalogFilters = {},
  limit = 50,
): Promise<CatalogResult> {
  const accessToken = process.env.CAPTAIN_CASKWELL_ADMIN_ACCESS_TOKEN;

  if (!accessToken) {
    return {
      products: [],
      pageInfo: emptyPageInfo,
      error:
        "Missing CAPTAIN_CASKWELL_ADMIN_ACCESS_TOKEN. Add the Admin API access token for captaincaskwell.myshopify.com to load products.",
    };
  }

  const queryText = buildProductQuery(filters);
  const usesPreviousPage = Boolean(filters.before);

  const response = await fetch(
    `https://${captainShop}/admin/api/${captainApiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `#graphql
          query CaptainProducts(
            $first: Int
            $last: Int
            $after: String
            $before: String
            $query: String
          ) {
            products(
              first: $first
              last: $last
              after: $after
              before: $before
              query: $query
              sortKey: TITLE
            ) {
              pageInfo {
                hasNextPage
                hasPreviousPage
                startCursor
                endCursor
              }
              nodes {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                totalInventory
                options {
                  id
                  name
                  values
                }
                variants(first: 100) {
                  nodes {
                    id
                    title
                    sku
                    barcode
                    price
                    compareAtPrice
                    taxable
                    inventoryPolicy
                    inventoryQuantity
                    inventoryItem {
                      tracked
                    }
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
                media(first: 10) {
                  nodes {
                    alt
                    ... on MediaImage {
                      id
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }`,
        variables: {
          first: usesPreviousPage ? null : limit,
          last: usesPreviousPage ? limit : null,
          after: filters.after || null,
          before: filters.before || null,
          query: queryText || null,
        },
      }),
    },
  );

  if (!response.ok) {
    return {
      products: [],
      pageInfo: emptyPageInfo,
      error: `Captain Caskwell Admin API returned ${response.status}. Check the source store token and scopes.`,
    };
  }

  const json = await response.json();

  if (json.errors?.length) {
    return {
      products: [],
      pageInfo: emptyPageInfo,
      error: json.errors.map((error: { message: string }) => error.message).join("; "),
    };
  }

  const products = (json.data?.products?.nodes ?? []).map(normalizeProduct);

  return {
    products: filterProducts(products, filters),
    pageInfo: json.data?.products?.pageInfo ?? emptyPageInfo,
  };
}

export async function getCaptainCatalogFacets(): Promise<CatalogFacets> {
  const accessToken = process.env.CAPTAIN_CASKWELL_ADMIN_ACCESS_TOKEN;

  if (!accessToken) {
    return { vendors: [], productTypes: [] };
  }

  const response = await fetch(
    `https://${captainShop}/admin/api/${captainApiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `#graphql
          query CatalogFacets {
            productVendors(first: 250) {
              nodes
            }
            productTypes(first: 250) {
              nodes
            }
          }`,
      }),
    },
  );

  if (!response.ok) {
    return { vendors: [], productTypes: [] };
  }

  const json = await response.json();

  return {
    vendors: json.data?.productVendors?.nodes ?? [],
    productTypes: json.data?.productTypes?.nodes ?? [],
  };
}

export function findCatalogProducts(
  products: CatalogProduct[],
  productIds: string[],
) {
  const selected = new Set(productIds);
  return products.filter((product) => selected.has(product.id));
}

function normalizeProduct(product: CaptainProductNode): CatalogProduct {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml ?? "",
    vendor: product.vendor ?? "",
    productType: product.productType ?? "",
    tags: product.tags ?? [],
    status: product.status ?? "DRAFT",
    totalInventory: product.totalInventory ?? null,
    options: product.options ?? [],
    variants: (product.variants?.nodes ?? []).map(normalizeVariant),
    images: (product.media?.nodes ?? [])
      .flatMap((media) => {
        if (!media.image?.url) {
          return [];
        }

        return [{
          id: media.id ?? media.image?.url ?? "",
          url: media.image?.url,
          altText: media.image?.altText ?? media.alt ?? null,
        }];
      }),
  };
}

function normalizeVariant(variant: CaptainVariantNode): CatalogVariant {
  return {
    id: variant.id,
    title: variant.title,
    sku: variant.sku,
    barcode: variant.barcode,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    taxable: variant.taxable,
    inventoryPolicy: variant.inventoryPolicy,
    inventoryQuantity: variant.inventoryQuantity ?? null,
    inventoryTracked: variant.inventoryItem?.tracked ?? false,
    selectedOptions: variant.selectedOptions,
  };
}

function buildProductQuery(filters: CatalogFilters) {
  const parts = [
    filters.search?.trim(),
    filters.vendor ? `vendor:${quoteQueryValue(filters.vendor)}` : "",
    filters.productType
      ? `product_type:${quoteQueryValue(filters.productType)}`
      : "",
    filters.status ? `status:${filters.status.toLowerCase()}` : "",
  ];

  return parts.filter(Boolean).join(" ");
}

function quoteQueryValue(value: string) {
  return `"${value.replaceAll('"', '\\"')}"`;
}

function filterProducts(
  products: CatalogProduct[],
  filters: CatalogFilters,
) {
  return filterProductsByInventory(products, filters);
}

function filterProductsByInventory(
  products: CatalogProduct[],
  filters: CatalogFilters,
) {
  if (!filters.inventory) {
    return products;
  }

  return products.filter((product) => {
    if (filters.inventory === "not_tracked") {
      return product.totalInventory === null;
    }
    if (filters.inventory === "in_stock") {
      return (product.totalInventory ?? 0) > 0;
    }

    return product.totalInventory === 0;
  });
}
