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
  category: CatalogCategory | null;
  tags: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  totalInventory: number | null;
  options: CatalogOption[];
  variants: CatalogVariant[];
  images: CatalogImage[];
  salesLast90Days: number;
  salesTier: CatalogSalesTier;
};

export type CatalogCategory = {
  id: string;
  name: string;
  fullName: string;
};

export type CatalogSalesTier = "A" | "B" | "C" | "D" | "E";

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
  rank?: CatalogSalesTier;
  rankSort?: "asc" | "desc";
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
  category?: CatalogCategory | null;
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

type CaptainOrdersResponse = {
  errors?: Array<{ message: string }>;
  data?: {
    orders?: {
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string | null;
      };
      nodes?: Array<{
        lineItems?: {
          nodes?: Array<{
            quantity?: number | null;
            product?: {
              id?: string | null;
            } | null;
          }> | null;
        } | null;
      }> | null;
    } | null;
  };
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

const salesCache: {
  expiresAt: number;
  counts: Map<string, number>;
} = {
  expiresAt: 0,
  counts: new Map(),
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
                category {
                  id
                  name
                  fullName
                }
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

  const productNodes = (json.data?.products?.nodes ?? []) as CaptainProductNode[];
  const products: CatalogProduct[] = productNodes.map(normalizeProduct);
  const salesCounts = await getCaptainSalesCounts(
    products.map((product) => product.id),
  );
  const productsWithSales = products.map((product) => {
    const salesLast90Days = salesCounts.get(product.id) ?? 0;

    return {
      ...product,
      salesLast90Days,
      salesTier: salesTierForQuantity(salesLast90Days),
    };
  });

  return {
    products: filterProducts(productsWithSales, filters),
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
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          fullName: product.category.fullName,
        }
      : null,
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
    salesLast90Days: 0,
    salesTier: "E",
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
  return sortProductsByRank(
    filterProductsByRank(filterProductsByInventory(products, filters), filters),
    filters,
  );
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

function filterProductsByRank(
  products: CatalogProduct[],
  filters: CatalogFilters,
) {
  if (!filters.rank) {
    return products;
  }

  return products.filter((product) => product.salesTier === filters.rank);
}

function sortProductsByRank(
  products: CatalogProduct[],
  filters: CatalogFilters,
) {
  if (!filters.rankSort) {
    return products;
  }

  const direction = filters.rankSort === "asc" ? 1 : -1;
  return [...products].sort((first, second) => {
    const rankComparison =
      tierRankValue(first.salesTier) - tierRankValue(second.salesTier);

    if (rankComparison !== 0) {
      return rankComparison * direction;
    }

    return (
      (second.salesLast90Days - first.salesLast90Days) *
      (filters.rankSort === "asc" ? -1 : 1)
    );
  });
}

async function getCaptainSalesCounts(productIds: string[]) {
  const requested = new Set(productIds);
  if (!requested.size) {
    return new Map<string, number>();
  }

  if (salesCache.expiresAt > Date.now()) {
    return filterSalesCounts(salesCache.counts, requested);
  }

  const accessToken = process.env.CAPTAIN_CASKWELL_ADMIN_ACCESS_TOKEN;
  if (!accessToken) {
    return new Map<string, number>();
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const counts = new Map<string, number>();
  let after: string | null = null;
  let pages = 0;
  const pageLimit = Number.parseInt(
    process.env.CAPTAIN_CASKWELL_SALES_PAGE_LIMIT ?? "25",
    10,
  );

  while (pages < pageLimit) {
    pages += 1;
    const response: Response = await fetch(
      `https://${captainShop}/admin/api/${captainApiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: `#graphql
            query CaptainSalesLast90Days($after: String, $query: String!) {
              orders(first: 100, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  lineItems(first: 100) {
                    nodes {
                      quantity
                      product {
                        id
                      }
                    }
                  }
                }
              }
            }`,
          variables: {
            after,
            query: `created_at:>=${since} status:any`,
          },
        }),
      },
    );

    if (!response.ok) {
      break;
    }

    const json = (await response.json()) as CaptainOrdersResponse;
    if (json.errors?.length) {
      break;
    }

    for (const order of json.data?.orders?.nodes ?? []) {
      for (const item of order.lineItems?.nodes ?? []) {
        const productId = item.product?.id;
        if (!productId) {
          continue;
        }

        counts.set(productId, (counts.get(productId) ?? 0) + (item.quantity ?? 0));
      }
    }

    if (!json.data?.orders?.pageInfo?.hasNextPage) {
      break;
    }

    after = json.data.orders.pageInfo.endCursor ?? null;
  }

  salesCache.counts = counts;
  salesCache.expiresAt = Date.now() + 10 * 60 * 1000;

  return filterSalesCounts(counts, requested);
}

function filterSalesCounts(counts: Map<string, number>, productIds: Set<string>) {
  return new Map(
    [...counts.entries()].filter(([productId]) => productIds.has(productId)),
  );
}

function salesTierForQuantity(quantity: number): CatalogSalesTier {
  if (quantity >= 601) {
    return "A";
  }
  if (quantity >= 401) {
    return "B";
  }
  if (quantity >= 301) {
    return "C";
  }
  if (quantity >= 101) {
    return "D";
  }

  return "E";
}

function tierRankValue(tier: CatalogSalesTier) {
  const ranks: Record<CatalogSalesTier, number> = {
    A: 5,
    B: 4,
    C: 3,
    D: 2,
    E: 1,
  };

  return ranks[tier];
}
