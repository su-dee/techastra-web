-- Options to pick one of when registering (e.g. the game for Clash Squad
-- E-Sports), and the option each registration picked per event.
ALTER TABLE "Event" ADD COLUMN "choices" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Event" ADD COLUMN "choiceLabel" TEXT;
ALTER TABLE "Registration" ADD COLUMN "eventChoices" JSONB;
