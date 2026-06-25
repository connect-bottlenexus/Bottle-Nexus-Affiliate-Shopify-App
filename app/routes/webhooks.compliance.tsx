import type { ActionFunctionArgs } from "react-router";
import db from "../db.server";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    const shopDomain =
      typeof payload.shop_domain === "string" ? payload.shop_domain : shop;

    await db.$transaction([
      db.importedPolicy.deleteMany({ where: { shop: shopDomain } }),
      db.importedProduct.deleteMany({ where: { shop: shopDomain } }),
      db.session.deleteMany({ where: { shop: shopDomain } }),
      db.shop.deleteMany({ where: { shop: shopDomain } }),
    ]);
  }

  // We do not store customer-level personal data, so customer data requests and
  // customer redaction requests are acknowledged after HMAC verification.
  return new Response(null, { status: 200 });
};
