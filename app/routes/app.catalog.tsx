import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getCaptainCatalogFacets,
  getCaptainProducts,
  type CatalogFilters,
  type CatalogProduct,
  type CatalogSalesTier,
} from "../lib/catalog.server";
import {
  getProductImportStatuses,
  recordProductImports,
} from "../lib/import-status.server";
import { importProducts } from "../lib/shopify-ops.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const filters = readCatalogFilters(url);
  const [catalog, facets] = await Promise.all([
    getCaptainProducts(filters),
    getCaptainCatalogFacets(),
  ]);
  const statusMap = await getProductImportStatuses(
    session.shop,
    catalog.products.map((product) => product.id),
  );

  const productsWithStatus = catalog.products.map((product) => ({
    ...product,
    importStatus: statusMap.get(product.id) ?? null,
  }));

  return {
    filters,
    facets,
    products: filterProductsByImportState(productsWithStatus, filters),
    pageInfo: catalog.pageInfo,
    catalogError: catalog.error,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const formData = await request.formData();
  const selectedIds = formData.getAll("productIds").map(String);

  if (!selectedIds.length) {
    return { ok: false, message: "Select at least one product to sync." };
  }

  const catalog = await getCaptainProducts(readCatalogFilters(url));
  if (catalog.error) {
    return { ok: false, message: catalog.error };
  }

  const selected = catalog.products.filter((product) =>
    selectedIds.includes(product.id),
  );
  const results = await importProducts(admin, selected);
  await recordProductImports(session.shop, results);

  const failed = results.filter((result) => !result.ok);
  const successful = results.length - failed.length;

  return {
    ok: failed.length === 0,
    results,
    message: failed.length
      ? `${successful} product(s) synced. ${failed.length} need review.`
      : `${successful} product(s) synced successfully.`,
  };
};

export default function Catalog() {
  const { filters, facets, products, pageInfo, catalogError } =
    useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [searchParams] = useSearchParams();
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [lastTierToast, setLastTierToast] = useState<string | null>(null);
  const selected = useMemo(() => new Set(selectedProducts), [selectedProducts]);
  const allSelected =
    products.length > 0 && selectedProducts.length === products.length;
  const isSubmitting = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    setSelectedProducts([]);
  }, [searchParams]);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message, {
        isError: fetcher.data.ok === false,
      });
    }
  }, [fetcher.data, shopify]);

  function toggleProduct(productId: string) {
    setSelectedProducts((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function toggleAllProducts() {
    setSelectedProducts((current) =>
      current.length === products.length
        ? []
        : products.map((product) => product.id),
    );
  }

  function syncProducts() {
    const formData = new FormData();
    selectedProducts.forEach((productId) => {
      formData.append("productIds", productId);
    });
    fetcher.submit(formData, { method: "POST" });
  }

  function showTierToast(product: CatalogProduct) {
    const key = `${product.id}-${product.salesTier}`;
    if (lastTierToast === key) {
      return;
    }

    setLastTierToast(key);
    shopify.toast.show(
      `${product.salesTier} ranking: ${tierDescription(product.salesTier)} ${product.salesLast90Days} bottle(s) sold in the past 90 days.`,
    );
  }

  return (
    <s-page heading="Import Catalog" inlineSize="large">
      <div style={styles.catalogShell}>
        {catalogError ? (
          <div style={styles.notice}>
            <strong>Catalog unavailable.</strong>
            <span>{catalogError}</span>
          </div>
        ) : (
          <div style={styles.resourceCard}>
            <div style={styles.resourceHeader}>
              <div>
                <h2 style={styles.resourceTitle}>Products</h2>
                <p style={styles.muted}>
                  {selectedProducts.length} selected · Showing 1-{products.length}
                </p>
              </div>
              <s-button
                disabled={selectedProducts.length === 0}
                onClick={syncProducts}
                variant="primary"
                {...(isSubmitting ? { loading: true } : {})}
              >
                Sync selected
              </s-button>
            </div>

            <Form method="get" style={styles.resourceFilters}>
              <button style={styles.allTab} type="submit">
                All
              </button>
              <div style={styles.searchWrap}>
                <svg
                  aria-hidden="true"
                  fill="none"
                  style={styles.searchSvg}
                  viewBox="0 0 20 20"
                >
                  <circle cx="9" cy="9" r="5.5" stroke="currentColor" />
                  <path
                    d="m13.2 13.2 3.1 3.1"
                    stroke="currentColor"
                    strokeLinecap="round"
                  />
                </svg>
                <input
                  aria-label="Search products"
                  defaultValue={filters.search ?? ""}
                  name="q"
                  placeholder="Search products"
                  style={styles.searchInput}
                  type="search"
                />
              </div>
              <select
                aria-label="Filter by vendor"
                defaultValue={filters.vendor ?? ""}
                name="vendor"
                style={styles.compactInput}
              >
                <option value="">All vendors</option>
                {facets.vendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by type"
                defaultValue={filters.productType ?? ""}
                name="type"
                style={styles.compactInput}
              >
                <option value="">All types</option>
                {facets.productTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by product status"
                defaultValue={filters.status ?? ""}
                name="status"
                style={styles.compactInput}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
              </select>
              <select
                aria-label="Filter by ranking"
                defaultValue={filters.rank ?? ""}
                name="rank"
                style={styles.compactInput}
              >
                <option value="">All ranks</option>
                <option value="A">Rank A</option>
                <option value="B">Rank B</option>
                <option value="C">Rank C</option>
                <option value="D">Rank D</option>
                <option value="E">Rank E</option>
              </select>
              <select
                aria-label="Filter by inventory"
                defaultValue={filters.inventory ?? ""}
                name="inventory"
                style={styles.compactInput}
              >
                <option value="">All inventory</option>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="not_tracked">Not tracked</option>
              </select>
              <select
                aria-label="Filter by import status"
                defaultValue={filters.importState ?? ""}
                name="imported"
                style={styles.compactInput}
              >
                <option value="">All imports</option>
                <option value="imported">Imported</option>
                <option value="not_imported">Not imported</option>
              </select>
              <button style={styles.iconButton} title="Apply filters" type="submit">
                Apply
              </button>
              <a href="/app/catalog" style={styles.resetLink}>
                Reset
              </a>
            </Form>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.checkCell}>
                      <input
                        aria-label="Select all products"
                        checked={allSelected}
                        type="checkbox"
                        onChange={toggleAllProducts}
                      />
                    </th>
                    <th style={styles.productHeaderCell}>Product</th>
                    <th style={styles.headerCell}>Status</th>
                    <th style={styles.headerCell}>
                      <a
                        aria-label={`Sort by rank ${nextRankSort(filters.rankSort) === "desc" ? "A to E" : "E to A"}`}
                        href={rankSortUrl(searchParams, filters.rankSort)}
                        style={styles.sortLink}
                      >
                        Rank {rankSortIndicator(filters.rankSort)}
                      </a>
                    </th>
                    <th style={styles.headerCell}>Inventory</th>
                    <th style={styles.numericHeaderCell}>Variants</th>
                    <th style={styles.headerCell}>Product type</th>
                    <th style={styles.headerCell}>Vendor</th>
                    <th style={styles.headerCell}>Import</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const checked = selected.has(product.id);
                    const image = product.images[0];

                    return (
                      <tr key={product.id} style={styles.row}>
                        <td style={styles.checkCell}>
                          <input
                            aria-label={`Select ${product.title}`}
                            checked={checked}
                            type="checkbox"
                            onChange={() => toggleProduct(product.id)}
                          />
                        </td>
                        <td style={styles.productCell}>
                          <div style={styles.productSummary}>
                            <div style={styles.thumb}>
                              {image ? (
                                <img
                                  alt={image.altText ?? product.title}
                                  src={image.url}
                                  style={styles.thumbImage}
                                />
                              ) : (
                                <span style={styles.thumbFallback}>No image</span>
                              )}
                            </div>
                            <div>
                              <strong>{product.title}</strong>
                              <p style={styles.muted}>{product.productType}</p>
                            </div>
                          </div>
                        </td>
                        <td style={styles.cell}>
                          <span style={productStatusStyle(product.status)}>
                            {capitalize(product.status)}
                          </span>
                        </td>
                        <td style={styles.cell}>
                          <button
                            aria-label={`Ranking ${product.salesTier}: ${tierDescription(product.salesTier)}`}
                            onFocus={() => showTierToast(product)}
                            onMouseEnter={() => showTierToast(product)}
                            style={tierBadgeStyle(product.salesTier)}
                            type="button"
                          >
                            {product.salesTier}
                          </button>
                        </td>
                        <td style={styles.cell}>
                          {product.totalInventory ?? "Not tracked"}
                        </td>
                        <td style={styles.numericCell}>{product.variants.length}</td>
                        <td style={styles.cell}>{product.productType || "Uncategorized"}</td>
                        <td style={styles.cell}>{product.vendor || "Unknown"}</td>
                        <td style={styles.cell}>
                          {product.importStatus ? (
                            <span
                              style={
                                product.importStatus.status === "failed"
                                  ? styles.importErrorBadge
                                  : styles.importOkBadge
                              }
                            >
                              {importStatusLabel(product.importStatus.status)}
                            </span>
                          ) : (
                            <span style={styles.statusPending}>Not imported</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={styles.pagination}>
              <s-button
                disabled={!pageInfo.hasPreviousPage}
                href={pageUrl(searchParams, "before", pageInfo.startCursor)}
              >
                Previous 50
              </s-button>
              <s-button
                disabled={!pageInfo.hasNextPage}
                href={pageUrl(searchParams, "after", pageInfo.endCursor)}
              >
                Next 50
              </s-button>
            </div>
          </div>
        )}
      </div>

      {fetcher.data && "results" in fetcher.data && fetcher.data.results && (
        <s-section heading="Last sync">
          <div style={styles.resultList}>
            {fetcher.data.results.map((result, index) => (
              <div
                key={`${result.sourceProductId}-${index}`}
                style={result.ok ? styles.resultOk : styles.resultError}
              >
                {result.message}
              </div>
            ))}
          </div>
        </s-section>
      )}
    </s-page>
  );
}

function readCatalogFilters(url: URL): CatalogFilters {
  return {
    search: url.searchParams.get("q") || undefined,
    vendor: url.searchParams.get("vendor") || undefined,
    productType: url.searchParams.get("type") || undefined,
    status: readProductStatusFilter(url.searchParams.get("status")),
    rank: readRankFilter(url.searchParams.get("rank")),
    rankSort: readRankSort(url.searchParams.get("rankSort")),
    inventory: readInventoryFilter(url.searchParams.get("inventory")),
    importState: readImportStateFilter(url.searchParams.get("imported")),
    after: url.searchParams.get("after") || undefined,
    before: url.searchParams.get("before") || undefined,
  };
}

type ProductWithImportStatus = CatalogProduct & {
  importStatus: { status: string; message: string | null } | null;
};

function filterProductsByImportState(
  products: ProductWithImportStatus[],
  filters: CatalogFilters,
) {
  if (!filters.importState) {
    return products;
  }

  return products.filter((product) => {
    const imported = isImported(product.importStatus?.status);
    return filters.importState === "imported" ? imported : !imported;
  });
}

function isImported(status: string | undefined) {
  return status === "imported" || status === "skipped";
}

function importStatusLabel(status: string) {
  return isImported(status) ? "Imported" : capitalize(status);
}

function readInventoryFilter(value: string | null): CatalogFilters["inventory"] {
  if (value === "in_stock" || value === "out_of_stock" || value === "not_tracked") {
    return value;
  }

  return undefined;
}

function readProductStatusFilter(value: string | null): CatalogFilters["status"] {
  if (value === "ACTIVE" || value === "DRAFT") {
    return value;
  }

  return undefined;
}

function readRankFilter(value: string | null): CatalogFilters["rank"] {
  if (value === "A" || value === "B" || value === "C" || value === "D" || value === "E") {
    return value;
  }

  return undefined;
}

function readRankSort(value: string | null): CatalogFilters["rankSort"] {
  if (value === "asc" || value === "desc") {
    return value;
  }

  return undefined;
}

function readImportStateFilter(value: string | null): CatalogFilters["importState"] {
  if (value === "imported" || value === "not_imported") {
    return value;
  }

  return undefined;
}

function pageUrl(
  searchParams: URLSearchParams,
  direction: "after" | "before",
  cursor: string | null,
) {
  const next = new URLSearchParams(searchParams);
  next.delete("after");
  next.delete("before");
  if (cursor) {
    next.set(direction, cursor);
  }
  const query = next.toString();
  return query ? `/app/catalog?${query}` : "/app/catalog";
}

function rankSortUrl(
  searchParams: URLSearchParams,
  current: CatalogFilters["rankSort"],
) {
  const next = new URLSearchParams(searchParams);
  next.delete("after");
  next.delete("before");
  next.set("rankSort", nextRankSort(current));
  const query = next.toString();

  return query ? `/app/catalog?${query}` : "/app/catalog";
}

function nextRankSort(current: CatalogFilters["rankSort"]) {
  return current === "desc" ? "asc" : "desc";
}

function rankSortIndicator(current: CatalogFilters["rankSort"]) {
  if (current === "desc") {
    return "↓";
  }
  if (current === "asc") {
    return "↑";
  }

  return "";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function productStatusStyle(status: string): CSSProperties {
  if (status === "ACTIVE") {
    return styles.activeBadge;
  }

  if (status === "DRAFT") {
    return styles.draftBadge;
  }

  return styles.archivedBadge;
}

function tierDescription(tier: CatalogSalesTier) {
  const descriptions: Record<CatalogSalesTier, string> = {
    A: "Top seller, 601+ bottles.",
    B: "Strong seller, 401-600 bottles.",
    C: "Steady seller, 301-400 bottles.",
    D: "Developing seller, 101-300 bottles.",
    E: "Low-volume seller, 0-100 bottles.",
  };

  return descriptions[tier];
}

function tierBadgeStyle(tier: CatalogSalesTier): CSSProperties {
  const colors: Record<CatalogSalesTier, { background: string; color: string }> = {
    A: { background: "#008060", color: "#ffffff" },
    B: { background: "#95c9b4", color: "#0f2e24" },
    C: { background: "#f0c14b", color: "#2b2508" },
    D: { background: "#f4a36c", color: "#3b1d06" },
    E: { background: "#e4e5e7", color: "#303030" },
  };

  return {
    ...styles.tierBadge,
    ...colors[tier],
  };
}

const styles: Record<string, CSSProperties> = {
  catalogShell: {
    margin: "0 auto",
    maxWidth: "1480px",
    width: "100%",
  },
  notice: {
    background: "#fff4e5",
    border: "1px solid #fed3a4",
    borderRadius: "8px",
    display: "grid",
    gap: "6px",
    padding: "14px",
  },
  resourceCard: {
    background: "#ffffff",
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    boxShadow: "0 1px 0 rgba(0, 0, 0, 0.04)",
    overflow: "hidden",
  },
  resourceHeader: {
    alignItems: "center",
    display: "flex",
    gap: "12px",
    justifyContent: "space-between",
    padding: "12px 14px",
  },
  resourceTitle: {
    fontSize: "15px",
    lineHeight: "20px",
    margin: 0,
  },
  muted: {
    color: "#616161",
    margin: "3px 0 0",
  },
  resourceFilters: {
    alignItems: "center",
    borderTop: "1px solid #ebebeb",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    padding: "8px 10px",
  },
  allTab: {
    background: "#f1f1f1",
    border: "1px solid #c9cccf",
    borderRadius: "8px",
    color: "#202223",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    height: "32px",
    padding: "0 12px",
  },
  searchWrap: {
    alignItems: "center",
    border: "1px solid #c9cccf",
    borderRadius: "8px",
    display: "flex",
    flex: "1 1 280px",
    height: "32px",
    minWidth: "220px",
    overflow: "hidden",
  },
  searchSvg: {
    color: "#616161",
    height: "16px",
    marginLeft: "10px",
    width: "16px",
  },
  searchInput: {
    border: 0,
    flex: 1,
    font: "inherit",
    height: "30px",
    minWidth: 0,
    outline: "none",
    padding: "0 10px",
  },
  compactInput: {
    border: "1px solid #c9cccf",
    borderRadius: "8px",
    flex: "0 1 150px",
    font: "inherit",
    height: "32px",
    minWidth: "132px",
    padding: "0 10px",
  },
  iconButton: {
    background: "#303030",
    border: "1px solid #303030",
    borderRadius: "8px",
    color: "#ffffff",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
    fontWeight: 600,
    height: "32px",
    padding: "0 12px",
  },
  resetLink: {
    alignItems: "center",
    color: "#005bd3",
    display: "inline-flex",
    fontSize: "13px",
    height: "32px",
    padding: "0 6px",
    textDecoration: "none",
  },
  tableWrap: {
    borderTop: "1px solid #ebebeb",
    overflow: "auto",
  },
  table: {
    borderCollapse: "collapse",
    minWidth: "1040px",
    width: "100%",
  },
  headerCell: {
    background: "#f7f7f7",
    borderBottom: "1px solid #ebebeb",
    color: "#616161",
    fontSize: "12px",
    fontWeight: 600,
    padding: "8px 12px",
    textAlign: "left",
  },
  sortLink: {
    color: "inherit",
    display: "inline-flex",
    gap: "4px",
    textDecoration: "none",
  },
  productHeaderCell: {
    background: "#f7f7f7",
    borderBottom: "1px solid #ebebeb",
    color: "#616161",
    fontSize: "12px",
    fontWeight: 600,
    minWidth: "300px",
    padding: "8px 12px",
    textAlign: "left",
  },
  numericHeaderCell: {
    background: "#f7f7f7",
    borderBottom: "1px solid #ebebeb",
    color: "#616161",
    fontSize: "12px",
    fontWeight: 600,
    padding: "8px 12px",
    textAlign: "right",
  },
  row: {
    borderBottom: "1px solid #eeeeee",
  },
  checkCell: {
    padding: "8px 10px",
    textAlign: "center",
    width: "36px",
  },
  productCell: {
    minWidth: "300px",
    padding: "8px 12px",
  },
  productSummary: {
    alignItems: "center",
    display: "flex",
    gap: "10px",
  },
  thumb: {
    alignItems: "center",
    background: "#f1f1f1",
    border: "1px solid #e3e3e3",
    borderRadius: "6px",
    display: "flex",
    height: "40px",
    justifyContent: "center",
    overflow: "hidden",
    width: "40px",
  },
  thumbImage: {
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  thumbFallback: {
    color: "#777",
    fontSize: "10px",
    textAlign: "center",
  },
  cell: {
    color: "#303030",
    fontSize: "13px",
    padding: "8px 12px",
    whiteSpace: "nowrap",
  },
  numericCell: {
    color: "#303030",
    fontSize: "13px",
    padding: "8px 12px",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  activeBadge: {
    background: "#aee9d1",
    borderRadius: "8px",
    color: "#202223",
    display: "inline-block",
    fontSize: "12px",
    lineHeight: "18px",
    padding: "0 8px",
  },
  draftBadge: {
    background: "#b5e7ff",
    borderRadius: "8px",
    color: "#202223",
    display: "inline-block",
    fontSize: "12px",
    lineHeight: "18px",
    padding: "0 8px",
  },
  archivedBadge: {
    background: "#e4e5e7",
    borderRadius: "8px",
    color: "#202223",
    display: "inline-block",
    fontSize: "12px",
    lineHeight: "18px",
    padding: "0 8px",
  },
  tierBadge: {
    border: 0,
    borderRadius: "999px",
    cursor: "help",
    display: "inline-flex",
    fontFamily: "inherit",
    fontSize: "12px",
    fontWeight: 700,
    justifyContent: "center",
    lineHeight: "20px",
    minWidth: "28px",
    padding: "0 9px",
  },
  statusOk: {
    color: "#008060",
    fontSize: "13px",
    fontWeight: 700,
  },
  statusError: {
    color: "#d72c0d",
    fontSize: "13px",
    fontWeight: 700,
  },
  statusPending: {
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
  },
  importOkBadge: {
    color: "#008060",
    fontSize: "13px",
    fontWeight: 700,
  },
  importErrorBadge: {
    color: "#d72c0d",
    fontSize: "13px",
    fontWeight: 700,
  },
  pagination: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    padding: "12px 14px",
  },
  resultList: {
    display: "grid",
    gap: "8px",
  },
  resultOk: {
    background: "#edf9f0",
    border: "1px solid #b7e4c7",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  resultError: {
    background: "#fff1f1",
    border: "1px solid #fed0d0",
    borderRadius: "8px",
    padding: "10px 12px",
  },
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
