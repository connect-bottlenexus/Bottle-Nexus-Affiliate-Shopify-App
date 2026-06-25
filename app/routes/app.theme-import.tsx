import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getThemeSectionFiles,
  getThemeImportStatus,
  importBottleNexusSections,
} from "../lib/theme-import.server";
import { authenticate } from "../shopify.server";

const dawnThemeStoreUrl = "https://themes.shopify.com/themes/dawn/presets/dawn";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const status = await getThemeImportStatus(admin);
  const previewUrl = status.activeTheme
    ? `https://${session.shop}/?preview_theme_id=${themeIdNumber(
        status.activeTheme.id,
      )}`
    : null;

  return { sections: getThemeSectionFiles(), status, previewUrl };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "import-sections") {
    const sectionKey = String(formData.get("section") ?? "");
    const status = await getThemeImportStatus(admin);
    if (!status.activeTheme) {
      return { ok: false, message: "No active theme found." };
    }
    if (!status.isDawnActive) {
      return {
        ok: false,
        message: "Dawn must be the active theme before importing sections.",
      };
    }

    return await importBottleNexusSections(
      admin,
      status.activeTheme.id,
      sectionKey || undefined,
    );
  }

  return { ok: false, message: "Unknown theme action." };
};

export default function ThemeImport() {
  const { previewUrl, sections, status } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const isSubmitting = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message, {
        isError: fetcher.data.ok === false,
      });
    }
  }, [fetcher.data, shopify]);

  function submit(intent: string, section?: string) {
    const formData = new FormData();
    formData.append("intent", intent);
    if (section) {
      formData.append("section", section);
    }
    fetcher.submit(formData, { method: "POST" });
  }

  return (
    <s-page heading="Theme Import">
      <s-section heading="Active theme">
        <div style={styles.statusPanel}>
          <div>
            <p style={styles.label}>Published theme</p>
            <h2 style={styles.title}>
              {status.activeTheme?.name ?? "No active theme"}
            </h2>
            <p style={styles.muted}>
              {status.isDawnActive
                ? "Dawn is active. You can import Bottle Nexus sections."
                : "Dawn must be active before importing these theme sections."}
            </p>
          </div>
          <div style={styles.actions}>
            {previewUrl && (
              <s-button href={previewUrl} target="_blank">
                Preview active theme
              </s-button>
            )}
            {!status.isDawnActive && (
              <s-button
                href={dawnThemeStoreUrl}
                target="_blank"
                variant="primary"
              >
                Get Dawn from Shopify Theme Store
              </s-button>
            )}
            <s-button
              disabled={!status.isDawnActive}
              onClick={() => submit("import-sections")}
              variant="primary"
              {...(isSubmitting ? { loading: true } : {})}
            >
              Import full theme pack
            </s-button>
          </div>
        </div>
      </s-section>

      {fetcher.data?.message && (
        <s-section heading="Latest theme action">
          <div
            style={
              fetcher.data.ok === false ? styles.errorNotice : styles.okNotice
            }
          >
            {fetcher.data.message}
          </div>
        </s-section>
      )}

      <s-section heading="Ready-made sections">
        <div style={styles.grid}>
          {sections.map((section) => (
            <SectionCard
              key={section.key}
              copy={section.copy}
              disabled={!status.isDawnActive}
              isSubmitting={isSubmitting}
              onImport={() => submit("import-sections", section.key)}
              title={section.title}
            />
          ))}
        </div>
      </s-section>

      {fetcher.data && "files" in fetcher.data && fetcher.data.files && (
        <s-section heading="Imported files">
          <div style={styles.fileList}>
            {fetcher.data.files.map((file) => (
              <code key={file} style={styles.file}>
                {file}
              </code>
            ))}
          </div>
        </s-section>
      )}
    </s-page>
  );
}

function SectionCard({
  copy,
  disabled,
  isSubmitting,
  onImport,
  title,
}: {
  copy: string;
  disabled: boolean;
  isSubmitting: boolean;
  onImport: () => void;
  title: string;
}) {
  return (
    <div style={styles.card}>
      <div>
        <h3 style={styles.cardTitle}>{title}</h3>
        <p style={styles.muted}>{copy}</p>
      </div>
      <s-button
        disabled={disabled}
        onClick={onImport}
        {...(isSubmitting ? { loading: true } : {})}
      >
        Import section
      </s-button>
    </div>
  );
}

function themeIdNumber(themeId: string) {
  return themeId.split("/").at(-1) ?? themeId;
}

const styles = {
  statusPanel: {
    alignItems: "center",
    display: "flex",
    gap: "16px",
    justifyContent: "space-between",
  },
  label: {
    color: "#616161",
    fontSize: "13px",
    margin: "0 0 4px",
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
  actions: {
    alignItems: "center",
    display: "flex",
    gap: "8px",
  },
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
  cardTitle: {
    fontSize: "16px",
    lineHeight: "22px",
    margin: 0,
  },
  fileList: {
    display: "grid",
    gap: "8px",
  },
  file: {
    background: "#f7f7f7",
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  okNotice: {
    background: "#effbf5",
    border: "1px solid #aee9d1",
    borderRadius: "8px",
    color: "#0c5132",
    padding: "12px",
  },
  errorNotice: {
    background: "#fff4f4",
    border: "1px solid #fed3d1",
    borderRadius: "8px",
    color: "#8e1f0b",
    padding: "12px",
  },
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
