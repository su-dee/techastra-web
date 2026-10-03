-- Welcome kits handed out at the registration desk (one row per registration).
CREATE TABLE "KitHandout" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kits" INTEGER NOT NULL,
    "givenById" TEXT NOT NULL,
    "givenByName" TEXT NOT NULL,
    "givenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitHandout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KitHandout_registrationId_key" ON "KitHandout"("registrationId");
CREATE INDEX "KitHandout_givenAt_idx" ON "KitHandout"("givenAt");
