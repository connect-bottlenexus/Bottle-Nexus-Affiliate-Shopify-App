import prisma from "../db.server";

type AdminClient = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

type ShopifyShop = {
  name?: string | null;
  email?: string | null;
  contactEmail?: string | null;
  billingAddress?: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    provinceCode?: string | null;
    zip?: string | null;
    country?: string | null;
    phone?: string | null;
  } | null;
};

export async function ensureShopInstalled(admin: AdminClient, shop: string) {
  const shopData = await getShopData(admin);
  const address = formatAddress(shopData);

  await prisma.shop.upsert({
    where: { shop },
    create: {
      shop,
      name: shopData.name,
      email: shopData.email,
      contactEmail: shopData.contactEmail,
      phone: shopData.billingAddress?.phone,
      address,
      address1: shopData.billingAddress?.address1,
      address2: shopData.billingAddress?.address2,
      city: shopData.billingAddress?.city,
      province: shopData.billingAddress?.province,
      provinceCode: shopData.billingAddress?.provinceCode,
      zip: shopData.billingAddress?.zip,
      country: shopData.billingAddress?.country,
      status: "installed",
      uninstalledAt: null,
    },
    update: {
      name: shopData.name,
      email: shopData.email,
      contactEmail: shopData.contactEmail,
      phone: shopData.billingAddress?.phone,
      address,
      address1: shopData.billingAddress?.address1,
      address2: shopData.billingAddress?.address2,
      city: shopData.billingAddress?.city,
      province: shopData.billingAddress?.province,
      provinceCode: shopData.billingAddress?.provinceCode,
      zip: shopData.billingAddress?.zip,
      country: shopData.billingAddress?.country,
      status: "installed",
      uninstalledAt: null,
    },
  });
}

export async function markShopUninstalled(shop: string) {
  await prisma.shop.updateMany({
    where: { shop },
    data: {
      status: "uninstalled",
      uninstalledAt: new Date(),
    },
  });
}

async function getShopData(admin: AdminClient): Promise<ShopifyShop> {
  const response = await admin.graphql(`#graphql
    query InstalledShop {
      shop {
        name
        email
        contactEmail
        billingAddress {
          address1
          address2
          city
          province
          provinceCode
          zip
          country
          phone
        }
      }
    }`);
  const json = await response.json();

  return json.data?.shop ?? {};
}

function formatAddress(shop: ShopifyShop) {
  const billingAddress = shop.billingAddress;

  return [
    billingAddress?.address1,
    billingAddress?.address2,
    billingAddress?.city,
    billingAddress?.provinceCode ?? billingAddress?.province,
    billingAddress?.zip,
    billingAddress?.country,
  ]
    .filter(Boolean)
    .join(", ");
}
