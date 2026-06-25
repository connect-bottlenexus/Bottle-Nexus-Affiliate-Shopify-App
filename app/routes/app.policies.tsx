import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getDashboardStatus,
  recordPolicyImport,
} from "../lib/import-status.server";
import {
  getPolicyTemplate,
  getPolicyTemplates,
  isPolicyKey,
  renderPolicyBody,
} from "../lib/policies.server";
import { getStoreProfile, upsertPolicyPage } from "../lib/shopify-ops.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [profile, status] = await Promise.all([
    getStoreProfile(admin),
    getDashboardStatus(session.shop),
  ]);

  return {
    policies: getPolicyTemplates().map((policy) => ({
      key: policy.key,
      title: policy.title,
      previewHtml: renderPolicyBody(policy.key, profile),
      status: status.policies.find((item) => item.key === policy.key),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const policy = String(formData.get("policy") ?? "");
  const bodyHtml = String(formData.get("bodyHtml") ?? "");

  if (!isPolicyKey(policy)) {
    return { ok: false, message: "Choose a valid policy to import." };
  }

  const profile = await getStoreProfile(admin);
  const result = await upsertPolicyPage(admin, policy, profile, bodyHtml);
  const template = getPolicyTemplate(policy);
  await recordPolicyImport(session.shop, policy, template.title, result);

  return { ...result, policy };
};

export default function Policies() {
  const { policies } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [selectedPolicy, setSelectedPolicy] = useState(policies[0]?.key ?? "");
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        policies.map((policy) => [policy.key, policy.previewHtml]),
      ),
  );
  const activePolicy = useMemo(
    () => policies.find((policy) => policy.key === selectedPolicy) ?? policies[0],
    [policies, selectedPolicy],
  );
  const activeBody = activePolicy ? editedBodies[activePolicy.key] ?? "" : "";
  const isSubmitting = ["loading", "submitting"].includes(fetcher.state);
  const importingPolicy = isSubmitting
    ? String(fetcher.formData?.get("policy") ?? "")
    : "";

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message, {
        isError: fetcher.data.ok === false,
      });
    }
  }, [fetcher.data, shopify]);

  function importPolicy(policy: string) {
    const formData = new FormData();
    formData.append("policy", policy);
    formData.append("bodyHtml", editedBodies[policy] ?? "");
    fetcher.submit(formData, { method: "POST" });
  }

  return (
    <s-page heading="Policy pages">
      <s-section heading="Import pages">
        <div style={styles.grid}>
          {policies.map((policy) => (
            <div key={policy.key} style={styles.card}>
              <div>
                <span
                  style={
                    policy.status?.status === "imported"
                      ? styles.statusOk
                      : policy.status?.status === "failed"
                        ? styles.statusError
                        : styles.statusPending
                  }
                >
                  {policy.status?.message ?? "Not imported yet"}
                </span>
                <h3 style={styles.cardTitle}>{policy.title}</h3>
              </div>
              <div style={styles.cardActions}>
                <s-button onClick={() => setSelectedPolicy(policy.key)}>
                  View
                </s-button>
                <s-button
                  disabled={policy.status?.status === "imported"}
                  variant="primary"
                  onClick={() => importPolicy(policy.key)}
                  {...(importingPolicy === policy.key ? { loading: true } : {})}
                >
                  {policy.status?.status === "imported" ? "Imported" : "Import"}
                </s-button>
              </div>
            </div>
          ))}
        </div>
      </s-section>

      {activePolicy && (
        <s-section heading={`Edit and preview: ${activePolicy.title}`}>
          <div style={styles.editorGrid}>
            <label style={styles.editorField}>
              <span style={styles.editorLabel}>Page HTML</span>
              <textarea
                value={activeBody}
                style={styles.textarea}
                onChange={(event) => {
                  const nextBody = event.currentTarget.value;
                  setEditedBodies((current) => ({
                    ...current,
                    [activePolicy.key]: nextBody,
                  }));
                }}
              />
            </label>
            <div>
              <div style={styles.previewHeader}>Preview</div>
              <div
                style={styles.preview}
                dangerouslySetInnerHTML={{ __html: activeBody }}
              />
            </div>
          </div>
          <div style={styles.editorActions}>
            <s-button
              variant="primary"
              onClick={() => importPolicy(activePolicy.key)}
              {...(importingPolicy === activePolicy.key ? { loading: true } : {})}
            >
              Import edited page
            </s-button>
          </div>
        </s-section>
      )}
    </s-page>
  );
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  card: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    display: "grid",
    gap: "14px",
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
    fontSize: "16px",
    lineHeight: "22px",
    margin: "6px 0 0",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
  },
  preview: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    color: "#303030",
    maxHeight: "560px",
    overflow: "auto",
    padding: "18px",
  },
  editorGrid: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "1fr",
  },
  editorField: {
    display: "grid",
    gap: "8px",
  },
  editorLabel: {
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
  },
  textarea: {
    border: "1px solid #c9cccf",
    borderRadius: "8px",
    font: "13px/20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    minHeight: "560px",
    padding: "12px",
    resize: "vertical",
    width: "100%",
  },
  previewHeader: {
    color: "#616161",
    fontSize: "13px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  editorActions: {
    marginTop: "14px",
  },
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
