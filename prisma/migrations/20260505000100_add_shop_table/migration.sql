-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "provinceCode" TEXT,
    "zip" TEXT,
    "country" TEXT,
    "status" TEXT NOT NULL DEFAULT 'installed',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shop_key" ON "Shop"("shop");

-- CreateIndex
CREATE INDEX "ImportedPolicy_shop_idx" ON "ImportedPolicy"("shop");

-- CreateIndex
CREATE INDEX "ImportedProduct_shop_idx" ON "ImportedProduct"("shop");
