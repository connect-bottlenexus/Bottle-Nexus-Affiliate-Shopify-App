import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  getCaptainCatalogAnalytics,
  type AnalyticsWidget,
  type ProductAnalyticsItem,
} from "../lib/analytics.server";
import type { CatalogSalesTier } from "../lib/catalog.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return getCaptainCatalogAnalytics();
};

export default function Analytics() {
  const analytics = useLoaderData<typeof loader>();

  return (
    <s-page heading="Captain Caskwell Analytics" inlineSize="large">
      <div style={styles.shell}>
        {analytics.error ? (
          <div style={styles.notice}>
            <strong>Analytics unavailable.</strong>
            <span>{analytics.error}</span>
          </div>
        ) : null}

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Top selling products</h2>
              <p style={styles.muted}>
                Last 90 days demand signals from Captain Caskwell. Raw sales
                totals and dollar amounts stay hidden.
              </p>
            </div>
            <span style={styles.timestamp}>
              Updated {formatTimestamp(analytics.generatedAt)}
            </span>
          </div>

          {analytics.widgets.length ? (
            <div style={styles.widgetGrid}>
              {analytics.widgets.map((widget) => (
                <AnalyticsWidgetCard key={widget.label} widget={widget} />
              ))}
            </div>
          ) : (
            <div style={styles.empty}>No analytics available yet.</div>
          )}
        </section>

        <section style={styles.resourceCard}>
          <div style={styles.tableHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Best selling items</h2>
              <p style={styles.muted}>
                Conv Rate % is a buyer-share proxy based on unique purchasers.
              </p>
            </div>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.productHeaderCell}>Product</th>
                  <th style={styles.headerCell}>Rank</th>
                  <th style={styles.numericHeaderCell}>Orders %</th>
                  <th style={styles.numericHeaderCell}>Conv Rate %</th>
                  <th style={styles.headerCell}>Demand signal</th>
                  <th style={styles.headerCell}>Product type</th>
                </tr>
              </thead>
              <tbody>
                {analytics.products.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Top ordering regions</h2>
              <p style={styles.muted}>
                Regional order share from the same 90-day window.
              </p>
            </div>
          </div>
          {analytics.states.length ? (
            <div style={styles.stateTableWrap}>
              <table style={styles.stateTable}>
                <thead>
                  <tr>
                    <th style={styles.stateHeaderCell}>Region</th>
                    <th style={styles.stateBarHeaderCell}>Share</th>
                    <th style={styles.numericHeaderCell}>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.states.map((state) => (
                    <tr key={state.state} style={styles.row}>
                      <td style={styles.stateCell}>{state.state}</td>
                      <td style={styles.barCell}>
                        <span style={styles.barTrack}>
                          <span
                            style={{
                              ...styles.barFill,
                              width: `${Math.min(100, state.percentage)}%`,
                            }}
                          />
                        </span>
                      </td>
                      <td style={styles.numericCell}>
                        {formatPercent(state.percentage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={styles.empty}>No regional analytics available yet.</div>
          )}
        </section>
      </div>
    </s-page>
  );
}

function AnalyticsWidgetCard({ widget }: { widget: AnalyticsWidget }) {
  return (
    <article style={styles.widgetCard}>
      <div style={styles.widgetMedia}>
        {widget.imageUrl ? (
          <img alt="" src={widget.imageUrl} style={styles.widgetImage} />
        ) : (
          <span style={styles.thumbFallback}>No image</span>
        )}
      </div>
      <div style={styles.widgetBody}>
        <span style={styles.kicker}>{widget.label}</span>
        <h3 style={styles.widgetTitle}>{widget.title}</h3>
        <div style={styles.widgetFooter}>
          {widget.rank ? (
            <span style={tierBadgeStyle(widget.rank)}>Rank {widget.rank}</span>
          ) : null}
          <span style={styles.muted}>{widget.helper}</span>
        </div>
      </div>
    </article>
  );
}

function ProductRow({ product }: { product: ProductAnalyticsItem }) {
  return (
    <tr style={styles.row}>
      <td style={styles.productCell}>
        <div style={styles.productSummary}>
          <div style={styles.thumb}>
            {product.imageUrl ? (
              <img
                alt={product.imageAlt ?? product.title}
                src={product.imageUrl}
                style={styles.thumbImage}
              />
            ) : (
              <span style={styles.thumbFallback}>No image</span>
            )}
          </div>
          <div>
            <strong>{product.title}</strong>
            <p style={styles.muted}>{product.subtitle}</p>
          </div>
        </div>
      </td>
      <td style={styles.cell}>
        <span style={tierBadgeStyle(product.rank)}>{product.rank}</span>
      </td>
      <td style={styles.numericCell}>{formatPercent(product.orderShare)}</td>
      <td style={styles.numericCell}>{formatPercent(product.conversionRate)}</td>
      <td style={styles.cell}>{product.demandSignal}</td>
      <td style={styles.cell}>{product.productType}</td>
    </tr>
  );
}

function formatPercent(value: number) {
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: value < 10 ? 2 : 1,
    minimumFractionDigits: value > 0 && value < 1 ? 2 : 0,
  })}%`;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  shell: {
    display: "grid",
    gap: "16px",
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
  card: {
    background: "#ffffff",
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    boxShadow: "0 1px 0 rgba(0, 0, 0, 0.04)",
    padding: "16px",
  },
  resourceCard: {
    background: "#ffffff",
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    boxShadow: "0 1px 0 rgba(0, 0, 0, 0.04)",
    overflow: "hidden",
  },
  sectionHeader: {
    alignItems: "flex-start",
    display: "flex",
    gap: "12px",
    justifyContent: "space-between",
  },
  tableHeader: {
    alignItems: "flex-start",
    borderBottom: "1px solid #eeeeee",
    display: "flex",
    gap: "12px",
    justifyContent: "space-between",
    padding: "14px",
  },
  sectionTitle: {
    fontSize: "16px",
    lineHeight: "22px",
    margin: 0,
  },
  muted: {
    color: "#616161",
    margin: "4px 0 0",
  },
  timestamp: {
    color: "#616161",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },
  widgetGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    marginTop: "14px",
  },
  widgetCard: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    minHeight: "120px",
    overflow: "hidden",
  },
  widgetMedia: {
    alignItems: "center",
    background: "#f6f6f7",
    display: "flex",
    justifyContent: "center",
    minHeight: "120px",
  },
  widgetImage: {
    height: "100%",
    objectFit: "contain",
    padding: "8px",
    width: "100%",
  },
  widgetBody: {
    display: "grid",
    gap: "8px",
    padding: "12px",
  },
  kicker: {
    color: "#616161",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  widgetTitle: {
    fontSize: "15px",
    lineHeight: "20px",
    margin: 0,
  },
  widgetFooter: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    borderCollapse: "collapse",
    minWidth: "1040px",
    width: "100%",
  },
  productHeaderCell: {
    background: "#f6f6f7",
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
    padding: "12px",
    textAlign: "left",
    width: "42%",
  },
  headerCell: {
    background: "#f6f6f7",
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
    padding: "12px",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  numericHeaderCell: {
    background: "#f6f6f7",
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
    padding: "12px",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  row: {
    borderTop: "1px solid #eeeeee",
  },
  productCell: {
    padding: "12px",
    verticalAlign: "middle",
  },
  productSummary: {
    alignItems: "center",
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "52px minmax(220px, 1fr)",
  },
  thumb: {
    alignItems: "center",
    background: "#f6f6f7",
    border: "1px solid #eeeeee",
    borderRadius: "6px",
    display: "flex",
    height: "52px",
    justifyContent: "center",
    overflow: "hidden",
    width: "52px",
  },
  thumbImage: {
    height: "100%",
    objectFit: "contain",
    width: "100%",
  },
  thumbFallback: {
    color: "#8a8a8a",
    fontSize: "10px",
    textAlign: "center",
  },
  cell: {
    padding: "12px",
    verticalAlign: "middle",
  },
  numericCell: {
    padding: "12px",
    textAlign: "right",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },
  tierBadge: {
    borderRadius: "999px",
    display: "inline-block",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: "18px",
    minWidth: "28px",
    padding: "2px 9px",
    textAlign: "center",
  },
  stateTableWrap: {
    marginTop: "14px",
    overflowX: "auto",
  },
  stateTable: {
    borderCollapse: "collapse",
    minWidth: "700px",
    width: "100%",
  },
  stateHeaderCell: {
    background: "#f6f6f7",
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
    padding: "12px",
    textAlign: "left",
    width: "32%",
  },
  stateBarHeaderCell: {
    background: "#f6f6f7",
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
    padding: "12px",
    textAlign: "left",
  },
  stateCell: {
    color: "#303030",
    fontWeight: 600,
    padding: "12px",
    verticalAlign: "middle",
  },
  barCell: {
    padding: "12px",
    verticalAlign: "middle",
  },
  barTrack: {
    background: "#f1f1e6",
    borderRadius: "999px",
    display: "block",
    height: "10px",
    overflow: "hidden",
    width: "100%",
  },
  barFill: {
    background: "#95c9b4",
    display: "block",
    height: "100%",
  },
  empty: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    color: "#616161",
    marginTop: "14px",
    padding: "16px",
  },
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
