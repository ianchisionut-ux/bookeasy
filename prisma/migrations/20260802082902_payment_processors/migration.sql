-- CreateEnum
CREATE TYPE "PaymentProcessor" AS ENUM ('STRIPE', 'NETOPIA', 'EUPLATESC');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "accountActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "euplatescIsLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "euplatescMerchantId" TEXT,
ADD COLUMN     "euplatescSecretKey" TEXT,
ADD COLUMN     "netopiaApiKey" TEXT,
ADD COLUMN     "netopiaIsLive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "netopiaPosSignature" TEXT,
ADD COLUMN     "netopiaPublicKey" TEXT,
ADD COLUMN     "paymentProcessor" "PaymentProcessor",
ADD COLUMN     "stripeSecretKey" TEXT,
ADD COLUMN     "stripeWebhookSecret" TEXT;

-- AlterTable
ALTER TABLE "Channel" ADD COLUMN     "wabaId" TEXT;
