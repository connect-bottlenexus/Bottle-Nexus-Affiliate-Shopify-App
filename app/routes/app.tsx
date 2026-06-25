import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { ensureShopInstalled } from "../lib/shops.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  await ensureShopInstalled(admin, session.shop);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/policies">Policy pages</s-link>
        <s-link href="/app/catalog">Import Catalog</s-link>
        <s-link href="/app/theme-import">Theme Import</s-link>
      </s-app-nav>
      <AppNavigation />
      <Outlet />
    </AppProvider>
  );
}

function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const items = [
    { label: "Dashboard", path: "/app" },
    { label: "Policy pages", path: "/app/policies" },
    { label: "Import Catalog", path: "/app/catalog" },
    { label: "Theme Import", path: "/app/theme-import" },
  ];

  function isActive(path: string) {
    return path === "/app"
      ? location.pathname === path
      : location.pathname.startsWith(path);
  }

  return (
    <nav aria-label="Bottle Nexus Affiliate pages" style={styles.navShell}>
      {items.map((item) => (
        <a
          aria-current={isActive(item.path) ? "page" : undefined}
          href={item.path}
          key={item.path}
          onClick={(event) => {
            event.preventDefault();
            navigate(item.path);
          }}
          style={{
            ...styles.navLink,
            ...(isActive(item.path) ? styles.navLinkActive : null),
          }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

const styles = {
  navShell: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    margin: "0 auto",
    maxWidth: "1480px",
    padding: "16px 24px 0",
  },
  navLink: {
    border: "1px solid #dcdcdc",
    borderRadius: "8px",
    color: "#303030",
    fontWeight: 700,
    lineHeight: "20px",
    padding: "9px 12px",
    textDecoration: "none",
  },
  navLinkActive: {
    background: "#303030",
    borderColor: "#303030",
    color: "#ffffff",
  },
} satisfies Record<string, React.CSSProperties>;
