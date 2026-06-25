import { AppProvider } from "@shopify/shopify-app-react-router/react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (!url.searchParams.get("shop")) {
    return {
      errors: {
        shop: "Open this app from Shopify admin or the Shopify App Store to authenticate.",
      },
    };
  }

  const errors = loginErrorMessage(await login(request));

  return { errors };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const { errors } = loaderData;

  return (
    <AppProvider embedded={false}>
      <s-page>
        <s-section heading="Log in">
          <s-paragraph>
            Open Bottle Nexus Affiliate from Shopify admin or the Shopify App
            Store to start OAuth authentication.
          </s-paragraph>
          {errors.shop ? <s-text tone="critical">{errors.shop}</s-text> : null}
        </s-section>
      </s-page>
    </AppProvider>
  );
}
