import type { CatalogSalesTier } from "./catalog.server";

export type ProductAnalyticsItem = {
  id: string;
  title: string;
  subtitle: string;
  vendor: string;
  productType: string;
  imageUrl: string | null;
  imageAlt: string | null;
  rank: CatalogSalesTier;
  orderShare: number;
  conversionRate: number;
  demandSignal: string;
};

export type AnalyticsWidget = {
  label: string;
  title: string;
  helper: string;
  imageUrl: string | null;
  rank: CatalogSalesTier | null;
};

export type AnalyticsStateRow = {
  state: string;
  percentage: number;
};

export type CatalogAnalytics = {
  products: ProductAnalyticsItem[];
  widgets: AnalyticsWidget[];
  states: AnalyticsStateRow[];
  generatedAt: string;
  error?: string;
};

type CaptainAnalyticsProduct = {
  id?: string | null;
  title?: string | null;
  handle?: string | null;
  vendor?: string | null;
  productType?: string | null;
  featuredMedia?: {
    preview?: {
      image?: {
        url?: string | null;
        altText?: string | null;
      } | null;
    } | null;
  } | null;
};

type CaptainAnalyticsOrder = {
  id?: string | null;
  customer?: { id?: string | null } | null;
  shippingAddress?: CaptainOrderAddress | null;
  billingAddress?: CaptainOrderAddress | null;
  lineItems?: {
    nodes?: Array<{
      quantity?: number | null;
      product?: CaptainAnalyticsProduct | null;
    }> | null;
  } | null;
};

type CaptainOrderAddress = {
  province?: string | null;
  provinceCode?: string | null;
  countryCodeV2?: string | null;
};

type CaptainAnalyticsResponse = {
  errors?: Array<{ message: string }>;
  data?: {
    orders?: {
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string | null;
      };
      nodes?: CaptainAnalyticsOrder[] | null;
    } | null;
  };
};

type ProductAccumulator = {
  id: string;
  title: string;
  subtitle: string;
  vendor: string;
  productType: string;
  imageUrl: string | null;
  imageAlt: string | null;
  quantity: number;
  orderIds: Set<string>;
  buyerIds: Set<string>;
};

const captainShop =
  process.env.CAPTAIN_CASKWELL_SHOP_DOMAIN ?? "captaincaskwell.myshopify.com";
const captainApiVersion =
  process.env.CAPTAIN_CASKWELL_API_VERSION ?? "2026-01";
const analyticsCacheMs = 30 * 60 * 1000;

let analyticsCache: {
  expiresAt: number;
  value: CatalogAnalytics;
} | null = null;

export async function getCaptainCatalogAnalytics(): Promise<CatalogAnalytics> {
  if (analyticsCache && analyticsCache.expiresAt > Date.now()) {
    return analyticsCache.value;
  }

  const accessToken = process.env.CAPTAIN_CASKWELL_ADMIN_ACCESS_TOKEN;
  if (!accessToken) {
    return emptyAnalytics(
      "Missing CAPTAIN_CASKWELL_ADMIN_ACCESS_TOKEN. Add the source store Admin API access token to load analytics.",
    );
  }

  const ordersResult = await fetchAnalyticsOrders(accessToken);
  if ("error" in ordersResult) {
    return emptyAnalytics(ordersResult.error);
  }

  const analytics = buildAnalytics(ordersResult.orders);
  analyticsCache = {
    expiresAt: Date.now() + analyticsCacheMs,
    value: analytics,
  };

  return analytics;
}

async function fetchAnalyticsOrders(accessToken: string) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const orders: CaptainAnalyticsOrder[] = [];
  let after: string | null = null;
  let pages = 0;
  const pageLimit = Number.parseInt(
    process.env.CAPTAIN_CASKWELL_ANALYTICS_ORDER_PAGE_LIMIT ?? "30",
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
            query CaptainAnalyticsOrders($after: String, $query: String!) {
              orders(first: 100, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  customer {
                    id
                  }
                  shippingAddress {
                    province
                    provinceCode
                    countryCodeV2
                  }
                  billingAddress {
                    province
                    provinceCode
                    countryCodeV2
                  }
                  lineItems(first: 100) {
                    nodes {
                      quantity
                      product {
                        id
                        title
                        handle
                        vendor
                        productType
                        featuredMedia {
                          preview {
                            image {
                              url
                              altText
                            }
                          }
                        }
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
      return {
        error: `Captain Caskwell Admin API returned ${response.status}. Check the source store token and scopes.`,
      };
    }

    const json = (await response.json()) as CaptainAnalyticsResponse;
    if (json.errors?.length) {
      return { error: json.errors.map((error) => error.message).join("; ") };
    }

    orders.push(...(json.data?.orders?.nodes ?? []));

    if (!json.data?.orders?.pageInfo?.hasNextPage) {
      break;
    }

    after = json.data.orders.pageInfo.endCursor ?? null;
  }

  return { orders };
}

function buildAnalytics(orders: CaptainAnalyticsOrder[]): CatalogAnalytics {
  const products = new Map<string, ProductAccumulator>();
  const buyerIds = new Set<string>();
  const stateCounts = new Map<string, number>();

  for (const order of orders) {
    const orderId = order.id ?? crypto.randomUUID();
    const buyerId = order.customer?.id ?? orderId;
    buyerIds.add(buyerId);

    const state = stateLabel(order.shippingAddress ?? order.billingAddress);
    if (state) {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
    }

    for (const lineItem of order.lineItems?.nodes ?? []) {
      const product = lineItem.product;
      if (!product?.id) {
        continue;
      }

      const current = products.get(product.id) ?? makeProductAccumulator(product);
      current.quantity += Math.max(0, lineItem.quantity ?? 0);
      current.orderIds.add(orderId);
      current.buyerIds.add(buyerId);
      products.set(product.id, current);
    }
  }

  const totalOrders = Math.max(orders.length, 1);
  const totalBuyers = Math.max(buyerIds.size, 1);
  const productRows = [...products.values()]
    .map((product) => toAnalyticsItem(product, totalOrders, totalBuyers))
    .sort((first, second) => {
      if (second.orderShare !== first.orderShare) {
        return second.orderShare - first.orderShare;
      }

      return tierRankValue(first.rank) - tierRankValue(second.rank);
    })
    .slice(0, 30);

  return {
    products: productRows,
    widgets: buildWidgets(productRows),
    states: buildStateRows(stateCounts, totalOrders),
    generatedAt: new Date().toISOString(),
  };
}

function makeProductAccumulator(
  product: CaptainAnalyticsProduct,
): ProductAccumulator {
  const vendor = product.vendor ?? "";
  const productType = product.productType ?? "";
  const image = product.featuredMedia?.preview?.image;

  return {
    id: product.id ?? "",
    title: product.title ?? "Untitled product",
    subtitle: [vendor, productType].filter(Boolean).join(" / "),
    vendor,
    productType,
    imageUrl: image?.url ?? null,
    imageAlt: image?.altText ?? product.title ?? null,
    quantity: 0,
    orderIds: new Set(),
    buyerIds: new Set(),
  };
}

function toAnalyticsItem(
  product: ProductAccumulator,
  totalOrders: number,
  totalBuyers: number,
): ProductAnalyticsItem {
  const orderShare = percentage(product.orderIds.size, totalOrders);
  const conversionRate = percentage(product.buyerIds.size, totalBuyers);
  const rank = salesTierForQuantity(product.quantity);

  return {
    id: product.id,
    title: product.title,
    subtitle: product.subtitle || product.productType || product.vendor || "Product",
    vendor: product.vendor || "Unknown",
    productType: product.productType || "Uncategorized",
    imageUrl: product.imageUrl,
    imageAlt: product.imageAlt,
    rank,
    orderShare,
    conversionRate,
    demandSignal: demandSignal(rank, orderShare, conversionRate),
  };
}

function buildWidgets(products: ProductAnalyticsItem[]): AnalyticsWidget[] {
  if (!products.length) {
    return [];
  }

  const byRank = [...products].sort(
    (first, second) => tierRankValue(first.rank) - tierRankValue(second.rank),
  )[0];
  const byOrderShare = products[0];
  const byBuyerReach = [...products].sort(
    (first, second) => second.conversionRate - first.conversionRate,
  )[0];
  const opportunity =
    products.find((product) => product.rank === "D" || product.rank === "E") ??
    products[products.length - 1];

  return [
    widgetFromProduct("Highest demand tier", byRank, "Strongest ranked product"),
    widgetFromProduct("Most common in orders", byOrderShare, "Highest order share"),
    widgetFromProduct("Broadest buyer reach", byBuyerReach, "Best buyer-share signal"),
    widgetFromProduct("Opportunity pick", opportunity, "Useful product to evaluate"),
  ];
}

function widgetFromProduct(
  label: string,
  product: ProductAnalyticsItem,
  helper: string,
): AnalyticsWidget {
  return {
    label,
    title: product.title,
    helper,
    imageUrl: product.imageUrl,
    rank: product.rank,
  };
}

function buildStateRows(
  stateCounts: Map<string, number>,
  totalOrders: number,
): AnalyticsStateRow[] {
  return [...stateCounts.entries()]
    .map(([state, count]) => ({
      state,
      percentage: percentage(count, totalOrders),
    }))
    .sort((first, second) => second.percentage - first.percentage)
    .slice(0, 8);
}

function stateLabel(address: CaptainOrderAddress | null | undefined) {
  if (!address) {
    return null;
  }

  const province = address.province?.trim();
  const provinceCode = address.provinceCode?.trim();

  if (province && provinceCode) {
    return `${province} (${provinceCode})`;
  }

  return province || provinceCode || address.countryCodeV2 || null;
}

function percentage(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
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
  const rankValues: Record<CatalogSalesTier, number> = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
  };

  return rankValues[tier];
}

function demandSignal(
  rank: CatalogSalesTier,
  orderShare: number,
  conversionRate: number,
) {
  if ((rank === "A" || rank === "B") && orderShare >= 12) {
    return "Leading demand";
  }
  if (orderShare >= 8 || conversionRate >= 8) {
    return "Strong reach";
  }
  if (rank === "C" || rank === "D") {
    return "Steady demand";
  }

  return "Emerging";
}

function emptyAnalytics(error?: string): CatalogAnalytics {
  return {
    products: [],
    widgets: [],
    states: [],
    generatedAt: new Date().toISOString(),
    error,
  };
}
