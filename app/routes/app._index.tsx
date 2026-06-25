import type { CSSProperties } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getDashboardStatus } from "../lib/import-status.server";
import { getStoreProfile } from "../lib/shopify-ops.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [profile, status] = await Promise.all([
    getStoreProfile(admin),
    getDashboardStatus(session.shop),
  ]);

  return { profile, status };
};

export default function Dashboard() {
  const { profile, status } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const importedPolicies = status.policies.filter(
    (policy) => policy.status === "imported",
  ).length;

  return (
    <s-page heading="Bottle Nexus Affiliate Dashboard">
      <s-section>
        <div style={styles.summary}>
          <div>
            <span style={styles.kicker}>Connected store</span>
            <h2 style={styles.title}>{profile.name}</h2>
            <p style={styles.muted}>{profile.email}</p>
            <p style={styles.muted}>{profile.address}</p>
          </div>
          <Metric label="Policies imported" value={`${importedPolicies}/4`} />
          <Metric
            label="Products imported"
            value={String(status.importedProductCount)}
          />
        </div>
      </s-section>

      <s-section heading="Policy import status">
        <div style={styles.statusGrid}>
          {status.policies.map((policy) => (
            <div key={policy.key} style={styles.statusCard}>
              <span
                style={
                  policy.status === "imported"
                    ? styles.statusOk
                    : policy.status === "failed"
                      ? styles.statusError
                      : styles.statusPending
                }
              >
                {statusLabel(policy.status)}
              </span>
              <h3 style={styles.cardTitle}>{policy.title}</h3>
              <p style={styles.muted}>{policy.message}</p>
            </div>
          ))}
        </div>
        <div style={styles.actions}>
          <a
            href="/app/policies"
            onClick={(event) => {
              event.preventDefault();
              navigate("/app/policies");
            }}
            style={styles.linkButton}
          >
            Manage policy pages
          </a>
        </div>
      </s-section>

      <s-section heading="Recent product imports">
        {status.recentProducts.length ? (
          <div style={styles.list}>
            {status.recentProducts.map((product) => (
              <div key={product.sourceProductId} style={styles.listRow}>
                <div>
                  <strong>{product.title}</strong>
                  <p style={styles.muted}>{product.message}</p>
                </div>
                <span
                  style={
                    product.status === "failed"
                      ? styles.statusError
                      : styles.statusOk
                  }
                >
                  {statusLabel(product.status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.empty}>No products imported yet.</div>
        )}
        <div style={styles.actions}>
          <a
            href="/app/catalog"
            onClick={(event) => {
              event.preventDefault();
              navigate("/app/catalog");
            }}
            style={styles.linkButton}
          >
            Open catalog
          </a>
        </div>
      </s-section>
    </s-page>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <span style={styles.metricLabel}>{label}</span>
      <strong style={styles.metricValue}>{value}</strong>
    </div>
  );
}

function statusLabel(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

const styles: Record<string, CSSProperties> = {
  summary: {
    alignItems: "stretch",
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "minmax(240px, 1fr) repeat(2, minmax(140px, 180px))",
  },
  kicker: {
    color: "#616161",
    display: "block",
    fontSize: "13px",
    marginBottom: "4px",
  },
  title: {
    fontSize: "22px",
    lineHeight: "28px",
    margin: 0,
  },
  muted: {
    color: "#616161",
    margin: "4px 0 0",
  },
  metric: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    padding: "14px",
  },
  metricLabel: {
    color: "#616161",
    display: "block",
    fontSize: "13px",
  },
  metricValue: {
    display: "block",
    fontSize: "28px",
    lineHeight: "34px",
    marginTop: "6px",
  },
  statusGrid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  },
  statusCard: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    padding: "14px",
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
  cardTitle: {
    fontSize: "15px",
    lineHeight: "20px",
    margin: "8px 0 0",
  },
  actions: {
    marginTop: "14px",
  },
  linkButton: {
    color: "#005bd3",
    fontWeight: 700,
    textDecoration: "none",
  },
  list: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    overflow: "hidden",
  },
  listRow: {
    alignItems: "center",
    borderBottom: "1px solid #eeeeee",
    display: "flex",
    gap: "12px",
    justifyContent: "space-between",
    padding: "12px",
  },
  empty: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    color: "#616161",
    padding: "16px",
  },
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
