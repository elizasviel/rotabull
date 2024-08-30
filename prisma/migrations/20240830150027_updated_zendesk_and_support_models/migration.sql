/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Profile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_authorId_fkey";

-- DropForeignKey
ALTER TABLE "Profile" DROP CONSTRAINT "Profile_userId_fkey";

-- DropTable
DROP TABLE "Post";

-- DropTable
DROP TABLE "Profile";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "SupportDoc" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "SupportDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendeskTicket" (
    "id" SERIAL NOT NULL,
    "ticketNumber" TEXT NOT NULL,

    CONSTRAINT "ZendeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendeskTicketComment" (
    "id" SERIAL NOT NULL,
    "plainBody" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "zendeskTicketId" INTEGER NOT NULL,

    CONSTRAINT "ZendeskTicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportDoc_slug_key" ON "SupportDoc"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ZendeskTicket_ticketNumber_key" ON "ZendeskTicket"("ticketNumber");

-- AddForeignKey
ALTER TABLE "ZendeskTicketComment" ADD CONSTRAINT "ZendeskTicketComment_zendeskTicketId_fkey" FOREIGN KEY ("zendeskTicketId") REFERENCES "ZendeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
