-- Events registered on a separate website (e.g. Hack Nexus): the portal links out instead of taking them in the cart.
ALTER TABLE "Event" ADD COLUMN "externalRegistration" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "registrationUrl" TEXT;
