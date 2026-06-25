-- CreateTable
CREATE TABLE "ImportedPolicy" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pageId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedProduct" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "sourceHandle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "productId" TEXT,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportedPolicy_shop_key_key" ON "ImportedPolicy"("shop", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedProduct_shop_sourceProductId_key" ON "ImportedProduct"("shop", "sourceProductId");
