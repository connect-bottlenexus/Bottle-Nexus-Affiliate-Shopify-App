import prisma from "../db.server";
import { getPolicyTemplates, type PolicyKey } from "./policies.server";
import type { ImportResult } from "./shopify-ops.server";

export async function getDashboardStatus(shop: string) {
  const [policies, productCount, recentProducts] = await Promise.all([
    prisma.importedPolicy.findMany({
      where: { shop },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.importedProduct.count({
      where: { shop, status: { in: ["imported", "skipped"] } },
    }),
    prisma.importedProduct.findMany({
      where: { shop },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
  ]);

  const policyByKey = new Map(policies.map((policy) => [policy.key, policy]));

  return {
    policies: getPolicyTemplates().map((policy) => {
      const imported = policyByKey.get(policy.key);
      return {
        key: policy.key,
        title: policy.title,
        status: imported?.status ?? "not_imported",
        message: imported?.message ?? "Not imported yet",
        importedAt: imported?.importedAt?.toISOString() ?? null,
        pageId: imported?.pageId ?? null,
      };
    }),
    importedProductCount: productCount,
    recentProducts: recentProducts.map((product) => ({
      sourceProductId: product.sourceProductId,
      title: product.title,
      status: product.status,
      message: product.message,
      importedAt: product.importedAt?.toISOString() ?? null,
      updatedAt: product.updatedAt.toISOString(),
    })),
  };
}

export async function recordPolicyImport(
  shop: string,
  key: PolicyKey,
  title: string,
  result: ImportResult,
) {
  await prisma.importedPolicy.upsert({
    where: { shop_key: { shop, key } },
    create: {
      shop,
      key,
      title,
      pageId: result.id,
      status: result.ok ? "imported" : "failed",
      message: result.message,
      importedAt: result.ok ? new Date() : null,
    },
    update: {
      title,
      pageId: result.id,
      status: result.ok ? "imported" : "failed",
      message: result.message,
      importedAt: result.ok ? new Date() : undefined,
    },
  });
}

export async function recordProductImports(
  shop: string,
  results: Array<
    ImportResult & {
      sourceProductId: string;
      sourceHandle: string;
      title: string;
    }
  >,
) {
  await prisma.$transaction(
    results.map((result) => {
      const status = result.ok
        ? result.message.includes("already exists")
          ? "skipped"
          : "imported"
        : "failed";

      return prisma.importedProduct.upsert({
        where: {
          shop_sourceProductId: {
            shop,
            sourceProductId: result.sourceProductId,
          },
        },
        create: {
          shop,
          sourceProductId: result.sourceProductId,
          sourceHandle: result.sourceHandle,
          title: result.title,
          productId: result.id,
          status,
          message: result.message,
          importedAt: result.ok ? new Date() : null,
        },
        update: {
          sourceHandle: result.sourceHandle,
          title: result.title,
          productId: result.id,
          status,
          message: result.message,
          importedAt: result.ok ? new Date() : undefined,
        },
      });
    }),
  );
}

export async function getProductImportStatuses(
  shop: string,
  sourceProductIds: string[],
) {
  if (!sourceProductIds.length) {
    return new Map<string, { status: string; message: string | null }>();
  }

  const rows = await prisma.importedProduct.findMany({
    where: {
      shop,
      sourceProductId: { in: sourceProductIds },
    },
    select: {
      sourceProductId: true,
      status: true,
      message: true,
    },
  });

  return new Map(
    rows.map((row) => [
      row.sourceProductId,
      { status: row.status, message: row.message },
    ]),
  );
}
