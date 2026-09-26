-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "collegeName" TEXT,
    "registerNo" TEXT,
    "photoUrl" TEXT,
    "assignedEventId" TEXT,
    "dutyDesk" TEXT,
    "dutyTiming" TEXT,
    "dutyRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "track" TEXT,
    "category" TEXT NOT NULL DEFAULT 'technical',
    "level" TEXT NOT NULL DEFAULT 'senior',
    "day" INTEGER,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "maxSeats" INTEGER NOT NULL,
    "seatsTaken" INTEGER NOT NULL DEFAULT 0,
    "isTeamEvent" BOOLEAN NOT NULL DEFAULT false,
    "minTeamSize" INTEGER NOT NULL DEFAULT 1,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 1,
    "rulebook" TEXT,
    "venue" TEXT,
    "coordinatorContacts" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "registrationCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventIds" TEXT[],
    "teamName" TEXT,
    "teamMembers" JSONB,
    "collegeName" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT,
    "paymentProofUrl" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'upi',
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "consentAt" TIMESTAMP(3),
    "guardianConsent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scannedBy" TEXT NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodLog" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "mealSession" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "registrationId" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "overriddenBy" TEXT,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "certificateCode" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "rating" INTEGER NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpQuery" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboPass" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventIds" TEXT[],
    "individualPrice" DOUBLE PRECISION NOT NULL,
    "comboPrice" DOUBLE PRECISION NOT NULL,
    "savings" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "availableSeats" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComboPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_registrationCode_key" ON "Registration"("registrationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_userId_key" ON "Registration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_transactionId_key" ON "Registration"("transactionId");

-- CreateIndex
CREATE INDEX "Registration_status_idx" ON "Registration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_registrationId_eventId_key" ON "Attendance"("registrationId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodLog_registrationId_mealSession_key" ON "FoodLog"("registrationId", "mealSession");

-- CreateIndex
CREATE UNIQUE INDEX "Result_eventId_position_key" ON "Result"("eventId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateCode_key" ON "Certificate"("certificateCode");

-- CreateIndex
CREATE INDEX "ComboPass_isActive_idx" ON "ComboPass"("isActive");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_assignedEventId_fkey" FOREIGN KEY ("assignedEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

