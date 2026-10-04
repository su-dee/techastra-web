-- Seats kept for on-spot registration, and which registrations were made on the spot.
ALTER TABLE "Event" ADD COLUMN "onSpotSeats" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Registration" ADD COLUMN "onSpot" BOOLEAN NOT NULL DEFAULT false;
