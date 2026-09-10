-- CreateEnum
CREATE TYPE "ContestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED', 'ANNOUNCED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rules" TEXT,
    "bannerUrl" TEXT,
    "prizeInfo" TEXT,
    "status" "ContestStatus" NOT NULL DEFAULT 'DRAFT',
    "submissionStart" TIMESTAMP(3) NOT NULL,
    "submissionEnd" TIMESTAMP(3) NOT NULL,
    "votingStart" TIMESTAMP(3) NOT NULL,
    "votingEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestEntry" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "designerName" TEXT NOT NULL,
    "department" TEXT,
    "batch" TEXT,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageUrl2" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContestEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestVote" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContestVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contest_slug_key" ON "Contest"("slug");

-- CreateIndex
CREATE INDEX "Contest_status_idx" ON "Contest"("status");

-- CreateIndex
CREATE INDEX "Contest_submissionStart_submissionEnd_idx" ON "Contest"("submissionStart", "submissionEnd");

-- CreateIndex
CREATE INDEX "Contest_votingStart_votingEnd_idx" ON "Contest"("votingStart", "votingEnd");

-- CreateIndex
CREATE INDEX "ContestEntry_contestId_status_idx" ON "ContestEntry"("contestId", "status");

-- CreateIndex
CREATE INDEX "ContestEntry_userId_idx" ON "ContestEntry"("userId");

-- CreateIndex
CREATE INDEX "ContestVote_entryId_idx" ON "ContestVote"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "ContestVote_contestId_userId_key" ON "ContestVote"("contestId", "userId");

-- AddForeignKey
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestEntry" ADD CONSTRAINT "ContestEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestVote" ADD CONSTRAINT "ContestVote_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestVote" ADD CONSTRAINT "ContestVote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ContestEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContestVote" ADD CONSTRAINT "ContestVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
