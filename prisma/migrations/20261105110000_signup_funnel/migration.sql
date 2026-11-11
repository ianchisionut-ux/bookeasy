CREATE TABLE IF NOT EXISTS "SignupFunnelDaily" (
  "day" DATE NOT NULL,
  "promoCode" TEXT NOT NULL,
  "utmCampaign" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "SignupFunnelDaily_pkey" PRIMARY KEY ("day", "promoCode", "utmCampaign", "step")
);

