import type { CatalogProduct, CatalogVariant } from "./catalog.server";
import {
  getPolicyTemplate,
  renderPolicyBody,
  type PolicyKey,
  type StoreProfile,
} from "./policies.server";

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

type ImportedVariantNode = {
  id: string;
  selectedOptions: Array<{ name: string; value: string }>;
  inventoryItem?: {
    id: string;
  } | null;
};

export type ImportResult = {
  ok: boolean;
  message: string;
  id?: string;
};

export type ProductImportResult = ImportResult & {
  sourceProductId: string;
  sourceHandle: string;
  title: string;
};

export async function getStoreProfile(admin: AdminClient): Promise<StoreProfile> {
  const response = await admin.graphql(`#graphql
    query StoreProfile {
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
  const shop = json.data?.shop;
  const billingAddress = shop?.billingAddress;
  const address = [
    billingAddress?.address1,
    billingAddress?.address2,
    billingAddress?.city,
    billingAddress?.provinceCode ?? billingAddress?.province,
    billingAddress?.zip,
    billingAddress?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    name: shop?.name ?? "Your store",
    email: shop?.contactEmail ?? shop?.email ?? "support@example.com",
    address: address || "Your store address",
    phone: billingAddress?.phone ?? "Your store phone",
  };
}

export async function upsertPolicyPage(
  admin: AdminClient,
  key: PolicyKey,
  profile: StoreProfile,
  bodyHtml?: string,
): Promise<ImportResult> {
  const policy = getPolicyTemplate(key);
  const body = bodyHtml?.trim() || renderPolicyBody(key, profile);

  const response = await admin.graphql(
    `#graphql
      mutation UpdateShopPolicy($shopPolicy: ShopPolicyInput!) {
        shopPolicyUpdate(shopPolicy: $shopPolicy) {
          shopPolicy {
            id
            type
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        shopPolicy: {
          type: shopPolicyTypeForKey(key),
          body,
        },
      },
    },
  );
  const json = await response.json();
  const errors = [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.shopPolicyUpdate?.userErrors),
  ];
  if (errors.length) {
    return { ok: false, message: errors.join("; ") };
  }

  return {
    ok: true,
    id: json.data?.shopPolicyUpdate?.shopPolicy?.id,
    message: `${policy.title} updated in store policies.`,
  };
}

function shopPolicyTypeForKey(key: PolicyKey) {
  const types: Record<PolicyKey, string> = {
    privacy: "PRIVACY_POLICY",
    terms: "TERMS_OF_SERVICE",
    shipping: "SHIPPING_POLICY",
    refund: "REFUND_POLICY",
  };

  return types[key];
}

export async function importProducts(
  admin: AdminClient,
  products: CatalogProduct[],
): Promise<ProductImportResult[]> {
  const results: ProductImportResult[] = [];

  for (const product of products) {
    const existingProduct = await findProductByHandle(admin, product.handle);
    if (existingProduct?.id) {
      const productErrors = await updateImportedProduct(admin, existingProduct.id, product);
      const inventoryErrors = await syncProductInventory(admin, existingProduct.id, product);
      const errors = [...productErrors, ...inventoryErrors];
      results.push({
        ok: errors.length === 0,
        id: existingProduct.id,
        sourceProductId: product.id,
        sourceHandle: product.handle,
        title: product.title,
        message: errors.length
          ? `${product.title} already exists, but sync needs review: ${errors.join("; ")}`
          : `${product.title} already exists, category and inventory are synced, and it is saved as draft.`,
      });
      continue;
    }

    const result = await createProduct(admin, product);
    results.push({
      ...result,
      sourceProductId: product.id,
      sourceHandle: product.handle,
      title: product.title,
    });
  }

  return results;
}

async function findProductByHandle(admin: AdminClient, handle: string) {
  const response = await admin.graphql(
    `#graphql
      query ProductByHandle($query: String!) {
        products(first: 1, query: $query) {
          nodes {
            id
            handle
            title
          }
        }
      }`,
    { variables: { query: `handle:${handle}` } },
  );
  const json = await response.json();
  return json.data?.products?.nodes?.[0] ?? null;
}

async function createProduct(
  admin: AdminClient,
  sourceProduct: CatalogProduct,
): Promise<ImportResult> {
  const response = await admin.graphql(
    `#graphql
      mutation CreateImportedProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            handle
            variants(first: 10) {
              nodes {
                id
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        product: {
          title: sourceProduct.title,
          handle: sourceProduct.handle,
          descriptionHtml: sourceProduct.descriptionHtml,
          vendor: sourceProduct.vendor,
          productType: sourceProduct.productType,
          category: sourceProduct.category?.id,
          status: "DRAFT",
          tags: sourceProduct.tags,
          productOptions: sourceProduct.options.map((option) => ({
            name: option.name,
            values: option.values.map((name) => ({ name })),
          })),
          metafields: [
            {
              namespace: "captain_caskwell",
              key: "source_product_id",
              type: "single_line_text_field",
              value: sourceProduct.id,
            },
          ],
        },
        media: sourceProduct.images.map((image) => ({
          mediaContentType: "IMAGE",
          originalSource: image.url,
          alt: image.altText ?? sourceProduct.title,
        })),
      },
    },
  );
  const json = await response.json();
  const errors = extractErrors(json.data?.productCreate?.userErrors);
  if (errors.length) {
    return { ok: false, message: `${sourceProduct.title}: ${errors.join("; ")}` };
  }

  const createdProduct = json.data?.productCreate?.product;
  if (!createdProduct?.id) {
    return { ok: false, message: `${sourceProduct.title}: productCreate did not return a product.` };
  }

  const variantErrors =
    sourceProduct.variants.length > 1
      ? await createVariants(admin, createdProduct.id, sourceProduct.variants)
      : await updateInitialVariant(
          admin,
          createdProduct.id,
          createdProduct.variants?.nodes?.[0]?.id,
          sourceProduct.variants[0],
        );

  if (variantErrors.length) {
    return {
      ok: false,
      id: createdProduct.id,
      message: `${sourceProduct.title} was created, but variant sync needs review: ${variantErrors.join("; ")}`,
    };
  }

  const inventoryErrors = await syncProductInventory(admin, createdProduct.id, sourceProduct);
  if (inventoryErrors.length) {
    return {
      ok: false,
      id: createdProduct.id,
      message: `${sourceProduct.title} was created, but inventory sync needs review: ${inventoryErrors.join("; ")}`,
    };
  }

  return {
    ok: true,
    id: createdProduct.id,
    message: `${sourceProduct.title} imported as draft with category and inventory synced.`,
  };
}

async function updateImportedProduct(
  admin: AdminClient,
  productId: string,
  sourceProduct: CatalogProduct,
) {
  const response = await admin.graphql(
    `#graphql
      mutation UpdateImportedProduct($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            status
            category {
              id
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        product: {
          id: productId,
          vendor: sourceProduct.vendor,
          productType: sourceProduct.productType,
          category: sourceProduct.category?.id,
          tags: sourceProduct.tags,
          status: "DRAFT",
        },
      },
    },
  );
  const json = await response.json();

  return [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.productUpdate?.userErrors),
  ];
}

async function createVariants(
  admin: AdminClient,
  productId: string,
  variants: CatalogVariant[],
) {
  const response = await admin.graphql(
    `#graphql
      mutation CreateVariants(
        $productId: ID!
        $variants: [ProductVariantsBulkInput!]!
        $strategy: ProductVariantsBulkCreateStrategy
      ) {
        productVariantsBulkCreate(
          productId: $productId
          variants: $variants
          strategy: $strategy
        ) {
          productVariants {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        productId,
        strategy: "REMOVE_STANDALONE_VARIANT",
        variants: variants.map((variant) => mapVariantInput(variant)),
      },
    },
  );
  const json = await response.json();
  return [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.productVariantsBulkCreate?.userErrors),
  ];
}

async function updateInitialVariant(
  admin: AdminClient,
  productId: string,
  variantId: string | undefined,
  variant: CatalogVariant | undefined,
) {
  if (!variantId || !variant) {
    return [];
  }

  const response = await admin.graphql(
    `#graphql
      mutation UpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        productId,
        variants: [{ id: variantId, ...mapVariantInput(variant, false) }],
      },
    },
  );
  const json = await response.json();
  return [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.productVariantsBulkUpdate?.userErrors),
  ];
}

function mapVariantInput(variant: CatalogVariant, includeOptions = true) {
  return {
    ...(includeOptions
      ? {
          optionValues: variant.selectedOptions.map((option) => ({
            optionName: option.name,
            name: option.value,
          })),
        }
      : {}),
    barcode: variant.barcode,
    taxable: variant.taxable,
    inventoryPolicy: variant.inventoryPolicy,
    inventoryItem: {
      sku: variant.sku,
      tracked: variant.inventoryTracked,
    },
  };
}

async function syncProductInventory(
  admin: AdminClient,
  productId: string,
  sourceProduct: CatalogProduct,
) {
  const locationResult = await getInventorySyncLocation(admin);
  if (locationResult.errors.length) {
    return locationResult.errors;
  }
  if (!locationResult.locationId) {
    return ["No active inventory location was found for this store."];
  }

  const variantResult = await getProductInventoryVariants(admin, productId);
  if (variantResult.errors.length) {
    return variantResult.errors;
  }

  const errors: string[] = [];
  const sourceByOptions = new Map(
    sourceProduct.variants.map((variant) => [variantOptionsKey(variant.selectedOptions), variant]),
  );

  for (const importedVariant of variantResult.variants) {
    const sourceVariant =
      sourceByOptions.get(variantOptionsKey(importedVariant.selectedOptions)) ??
      sourceProduct.variants[0];
    const inventoryItemId = importedVariant.inventoryItem?.id;

    if (!sourceVariant?.inventoryTracked || !inventoryItemId) {
      continue;
    }

    const quantity =
      sourceVariant.inventoryQuantity ??
      (sourceProduct.variants.length === 1 ? sourceProduct.totalInventory : null) ??
      0;

    const activateErrors = await activateInventoryAtLocation(
      admin,
      inventoryItemId,
      locationResult.locationId,
      quantity,
    );
    const blockingActivateErrors = activateErrors.filter(
      (error) => !/already (active|connected|stocked)|has already been taken/i.test(error),
    );
    if (blockingActivateErrors.length) {
      errors.push(...blockingActivateErrors);
      continue;
    }

    const quantityErrors = await setInventoryQuantity(
      admin,
      inventoryItemId,
      locationResult.locationId,
      quantity,
      sourceProduct.id,
    );
    errors.push(...quantityErrors);
  }

  return errors;
}

async function getInventorySyncLocation(admin: AdminClient) {
  const response = await admin.graphql(`#graphql
    query InventorySyncLocation {
      locations(first: 25) {
        nodes {
          id
        }
      }
    }`);
  const json = await response.json();
  const locations = (json.data?.locations?.nodes ?? []) as Array<{
    id: string;
  }>;
  const location = locations[0];

  return {
    locationId: location?.id ?? null,
    errors: extractTopLevelErrors(json.errors),
  };
}

async function getProductInventoryVariants(admin: AdminClient, productId: string) {
  const response = await admin.graphql(
    `#graphql
      query ImportedProductInventoryVariants($id: ID!) {
        product(id: $id) {
          variants(first: 100) {
            nodes {
              id
              selectedOptions {
                name
                value
              }
              inventoryItem {
                id
              }
            }
          }
        }
      }`,
    { variables: { id: productId } },
  );
  const json = await response.json();

  return {
    variants: (json.data?.product?.variants?.nodes ?? []) as ImportedVariantNode[],
    errors: extractTopLevelErrors(json.errors),
  };
}

async function activateInventoryAtLocation(
  admin: AdminClient,
  inventoryItemId: string,
  locationId: string,
  quantity: number,
) {
  const response = await admin.graphql(
    `#graphql
      mutation ActivateInventoryItem($inventoryItemId: ID!, $locationId: ID!, $available: Int) {
        inventoryActivate(
          inventoryItemId: $inventoryItemId
          locationId: $locationId
          available: $available
        ) {
          inventoryLevel {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        inventoryItemId,
        locationId,
        available: Math.max(0, quantity),
      },
    },
  );
  const json = await response.json();

  return [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.inventoryActivate?.userErrors),
  ];
}

async function setInventoryQuantity(
  admin: AdminClient,
  inventoryItemId: string,
  locationId: string,
  quantity: number,
  sourceProductId: string,
) {
  const response = await admin.graphql(
    `#graphql
      mutation SetImportedInventory($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) {
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        input: {
          ignoreCompareQuantity: true,
          name: "available",
          reason: "correction",
          referenceDocumentUri: `gid://bottle-nexus-affiliate/CaptainCaskwellProduct/${sourceProductId.replace(
            "gid://shopify/Product/",
            "",
          )}`,
          quantities: [
            {
              inventoryItemId,
              locationId,
              quantity: Math.max(0, quantity),
              compareQuantity: null,
            },
          ],
        },
      },
    },
  );
  const json = await response.json();

  return [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.inventorySetQuantities?.userErrors),
  ];
}

function variantOptionsKey(options: Array<{ name: string; value: string }>) {
  return options
    .map((option) => `${option.name}:${option.value}`)
    .sort()
    .join("|");
}

function extractErrors(errors: Array<{ message: string }> | undefined) {
  return (errors ?? []).map((error) => error.message).filter(Boolean);
}

function extractTopLevelErrors(errors: Array<{ message: string }> | undefined) {
  return (errors ?? []).map((error) => error.message).filter(Boolean);
}
