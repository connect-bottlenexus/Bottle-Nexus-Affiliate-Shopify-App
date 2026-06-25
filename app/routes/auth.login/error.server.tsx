import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

interface LoginErrorMessage {
  shop?: string;
}

export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return {
      shop: "Open this app from Shopify admin or the Shopify App Store to authenticate.",
    };
  } else if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return {
      shop: "Shopify could not verify the store for this login attempt.",
    };
  }

  return {};
}
