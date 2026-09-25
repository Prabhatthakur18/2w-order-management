-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('SINGLE', 'DUAL');

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "salesPerson" TEXT,
ALTER COLUMN "contactNo" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "seatType" "SeatType",
ADD COLUMN     "vehicleType" TEXT;

-- AlterTable
ALTER TABLE "PartColour" ALTER COLUMN "colour" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SubDealer" ADD COLUMN     "salesPerson" TEXT,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "contactNo" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Dealer_salesPerson_idx" ON "Dealer"("salesPerson");
