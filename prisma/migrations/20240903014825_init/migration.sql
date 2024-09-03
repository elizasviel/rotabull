-- CreateTable
CREATE TABLE "ForgeTicketCollection" (
    "id" SERIAL NOT NULL,
    "forgeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ForgeTicketCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForgeDocsCollection" (
    "id" SERIAL NOT NULL,
    "forgeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ForgeDocsCollection_pkey" PRIMARY KEY ("id")
);

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
    "submitterId" BIGINT NOT NULL,

    CONSTRAINT "ZendeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendeskTicketComment" (
    "id" SERIAL NOT NULL,
    "plainBody" TEXT NOT NULL,
    "authorId" BIGINT NOT NULL,
    "zendeskTicketId" INTEGER NOT NULL,

    CONSTRAINT "ZendeskTicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZendeskUser" (
    "id" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZendeskUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForgeTicketCollection_forgeId_key" ON "ForgeTicketCollection"("forgeId");

-- CreateIndex
CREATE UNIQUE INDEX "ForgeDocsCollection_forgeId_key" ON "ForgeDocsCollection"("forgeId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportDoc_slug_key" ON "SupportDoc"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ZendeskTicket_ticketNumber_key" ON "ZendeskTicket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ZendeskUser_id_key" ON "ZendeskUser"("id");

-- CreateIndex
CREATE UNIQUE INDEX "ZendeskUser_email_key" ON "ZendeskUser"("email");

-- AddForeignKey
ALTER TABLE "ZendeskTicketComment" ADD CONSTRAINT "ZendeskTicketComment_zendeskTicketId_fkey" FOREIGN KEY ("zendeskTicketId") REFERENCES "ZendeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
