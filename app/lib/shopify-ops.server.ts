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
  const existingPage = await findPageByHandle(admin, policy.handle);

  if (existingPage?.id) {
    const response = await admin.graphql(
      `#graphql
        mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            page {
              id
              title
              handle
            }
            userErrors {
              code
              field
              message
            }
          }
        }`,
      {
        variables: {
          id: existingPage.id,
          page: {
            title: policy.title,
            handle: policy.handle,
            body,
            isPublished: true,
          },
        },
      },
    );
    const json = await response.json();
    const errors = extractErrors(json.data?.pageUpdate?.userErrors);
    if (errors.length) {
      return { ok: false, message: errors.join("; ") };
    }

    return {
      ok: true,
      id: json.data?.pageUpdate?.page?.id,
      message: `${policy.title} updated.`,
    };
  }

  const response = await admin.graphql(
    `#graphql
      mutation CreatePage($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page {
            id
            title
            handle
          }
          userErrors {
            code
            field
            message
          }
        }
      }`,
    {
      variables: {
        page: {
          title: policy.title,
          handle: policy.handle,
          body,
          isPublished: true,
        },
      },
    },
  );
  const json = await response.json();
  const errors = extractErrors(json.data?.pageCreate?.userErrors);
  if (errors.length) {
    return { ok: false, message: errors.join("; ") };
  }

  return {
    ok: true,
    id: json.data?.pageCreate?.page?.id,
    message: `${policy.title} created.`,
  };
}

export async function importProducts(
  admin: AdminClient,
  products: CatalogProduct[],
): Promise<ProductImportResult[]> {
  const results: ProductImportResult[] = [];

  for (const product of products) {
    const existingProduct = await findProductByHandle(admin, product.handle);
    if (existingProduct?.id) {
      const visibilityErrors = await ensureProductVisible(admin, existingProduct.id);
      results.push({
        ok: visibilityErrors.length === 0,
        id: existingProduct.id,
        sourceProductId: product.id,
        sourceHandle: product.handle,
        title: product.title,
        message: visibilityErrors.length
          ? `${product.title} already exists, but publishing needs review: ${visibilityErrors.join("; ")}`
          : `${product.title} already exists and is published to Online Store.`,
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

async function findPageByHandle(admin: AdminClient, handle: string) {
  const response = await admin.graphql(
    `#graphql
      query PageByHandle($query: String!) {
        pages(first: 1, query: $query) {
          nodes {
            id
            handle
          }
        }
      }`,
    { variables: { query: `handle:${handle}` } },
  );
  const json = await response.json();
  return json.data?.pages?.nodes?.[0] ?? null;
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
          status: "ACTIVE",
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

  const visibilityErrors = await ensureProductVisible(admin, createdProduct.id);
  if (visibilityErrors.length) {
    return {
      ok: false,
      id: createdProduct.id,
      message: `${sourceProduct.title} was created, but publishing needs review: ${visibilityErrors.join("; ")}`,
    };
  }

  return {
    ok: true,
    id: createdProduct.id,
    message: `${sourceProduct.title} imported and published to Online Store.`,
  };
}

async function ensureProductVisible(admin: AdminClient, productId: string) {
  const statusErrors = await activateProduct(admin, productId);
  const publishErrors = await publishProduct(admin, productId);

  return [...statusErrors, ...publishErrors];
}

async function activateProduct(admin: AdminClient, productId: string) {
  const response = await admin.graphql(
    `#graphql
      mutation ActivateProduct($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product {
            id
            status
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
          status: "ACTIVE",
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

async function publishProduct(admin: AdminClient, productId: string) {
  const publicationResult = await getPublicationIds(admin);
  if (publicationResult.errors.length) {
    return publicationResult.errors;
  }
  if (!publicationResult.ids.length) {
    return ["No Shopify publications were found for this store."];
  }

  const response = await admin.graphql(
    `#graphql
      mutation PublishProduct($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        id: productId,
        input: publicationResult.ids.map((publicationId) => ({
          publicationId,
        })),
      },
    },
  );
  const json = await response.json();

  return [
    ...extractTopLevelErrors(json.errors),
    ...extractErrors(json.data?.publishablePublish?.userErrors),
  ];
}

async function getPublicationIds(admin: AdminClient) {
  const response = await admin.graphql(`#graphql
    query ProductPublications {
      publications(first: 20) {
        nodes {
          id
        }
      }
    }`);
  const json = await response.json();

  return {
    ids: ((json.data?.publications?.nodes ?? []) as Array<{ id: string }>)
      .map((publication) => publication.id)
      .filter(Boolean),
    errors: extractTopLevelErrors(json.errors),
  };
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
    price: variant.price,
    compareAtPrice: variant.compareAtPrice,
    barcode: variant.barcode,
    taxable: variant.taxable,
    inventoryPolicy: variant.inventoryPolicy,
    inventoryItem: {
      sku: variant.sku,
    },
  };
}

function extractErrors(errors: Array<{ message: string }> | undefined) {
  return (errors ?? []).map((error) => error.message).filter(Boolean);
}

function extractTopLevelErrors(errors: Array<{ message: string }> | undefined) {
  return (errors ?? []).map((error) => error.message).filter(Boolean);
}
