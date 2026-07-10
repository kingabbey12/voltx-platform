-- CreateEnum
CREATE TYPE "CommsChannel" AS ENUM ('GMAIL', 'OUTLOOK', 'WHATSAPP', 'TWILIO_VOICE', 'TWILIO_SMS', 'SLACK', 'TEAMS');

-- CreateEnum
CREATE TYPE "CommsChannelConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED', 'REVOKED', 'TOKEN_EXPIRED');

-- CreateEnum
CREATE TYPE "CommsConversationStatus" AS ENUM ('OPEN', 'PINNED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CommsConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CommsMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CommsMessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "CommsParticipantRole" AS ENUM ('CUSTOMER', 'AGENT');

-- CreateEnum
CREATE TYPE "CommsCallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CommsCallStatus" AS ENUM ('RINGING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'FAILED', 'VOICEMAIL');

-- CreateEnum
CREATE TYPE "CommsEventType" AS ENUM ('DELIVERED', 'READ', 'TYPING', 'REACTION_ADDED', 'REACTION_REMOVED');

-- Note: Prisma's migrate-diff engine proposed dropping
-- knowledge_chunks_content_tsv_idx/knowledge_chunks_embedding_hnsw_idx and
-- an ALTER COLUMN ... DROP DEFAULT on knowledge_chunks.content_tsv here.
-- Both columns are raw-SQL GENERATED/vector columns modeled as
-- Unsupported(...) in schema.prisma, which the diff engine can't fully
-- reason about — this is unrelated tooling noise, not an intended change,
-- and has been removed to avoid dropping a real search index (same fix
-- applied in 20260706095720_add_organization_invitations).

-- CreateTable
CREATE TABLE "comms_channel_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "CommsChannel" NOT NULL,
    "display_name" TEXT NOT NULL,
    "status" "CommsChannelConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "external_account_id" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_health_check_at" TIMESTAMP(3),
    "last_health_status" "IntegrationHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comms_channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_channel_credentials" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "encrypted_payload" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comms_channel_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "contact_id" UUID,
    "assignee_id" UUID,
    "channel" "CommsChannel" NOT NULL,
    "subject" TEXT,
    "status" "CommsConversationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CommsConversationPriority" NOT NULL DEFAULT 'NORMAL',
    "unread" BOOLEAN NOT NULL DEFAULT true,
    "external_thread_id" TEXT,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comms_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_participants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "contact_id" UUID,
    "user_id" UUID,
    "role" "CommsParticipantRole" NOT NULL,
    "external_address" TEXT,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID,
    "direction" "CommsMessageDirection" NOT NULL,
    "channel" "CommsChannel" NOT NULL,
    "status" "CommsMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "body" TEXT NOT NULL,
    "external_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_attachments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_calls" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID,
    "connection_id" UUID NOT NULL,
    "direction" "CommsCallDirection" NOT NULL,
    "status" "CommsCallStatus" NOT NULL,
    "from_number" TEXT NOT NULL,
    "to_number" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "external_call_id" TEXT,
    "notes" TEXT,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_call_recordings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "storage_url" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_transcriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "message_id" UUID,
    "type" "CommsEventType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_channel_identities" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "channel" "CommsChannel" NOT NULL,
    "external_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_channel_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_conversation_labels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366F1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_conversation_labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comms_conversation_label_links" (
    "conversation_id" UUID NOT NULL,
    "label_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_conversation_label_links_pkey" PRIMARY KEY ("conversation_id","label_id")
);

-- CreateTable
CREATE TABLE "comms_message_reactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" UUID,
    "emoji" TEXT NOT NULL,
    "external_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comms_message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_summaries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT,
    "urgency" TEXT,
    "intent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comms_channel_connections_organization_id_idx" ON "comms_channel_connections"("organization_id");

-- CreateIndex
CREATE INDEX "comms_channel_connections_channel_idx" ON "comms_channel_connections"("channel");

-- CreateIndex
CREATE INDEX "comms_channel_connections_status_idx" ON "comms_channel_connections"("status");

-- CreateIndex
CREATE INDEX "comms_channel_connections_deleted_at_idx" ON "comms_channel_connections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "comms_channel_connections_organization_id_channel_external__key" ON "comms_channel_connections"("organization_id", "channel", "external_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "comms_channel_credentials_connection_id_key" ON "comms_channel_credentials"("connection_id");

-- CreateIndex
CREATE INDEX "comms_channel_credentials_organization_id_idx" ON "comms_channel_credentials"("organization_id");

-- CreateIndex
CREATE INDEX "comms_channel_credentials_expires_at_idx" ON "comms_channel_credentials"("expires_at");

-- CreateIndex
CREATE INDEX "comms_conversations_organization_id_idx" ON "comms_conversations"("organization_id");

-- CreateIndex
CREATE INDEX "comms_conversations_connection_id_idx" ON "comms_conversations"("connection_id");

-- CreateIndex
CREATE INDEX "comms_conversations_contact_id_idx" ON "comms_conversations"("contact_id");

-- CreateIndex
CREATE INDEX "comms_conversations_assignee_id_idx" ON "comms_conversations"("assignee_id");

-- CreateIndex
CREATE INDEX "comms_conversations_status_idx" ON "comms_conversations"("status");

-- CreateIndex
CREATE INDEX "comms_conversations_priority_idx" ON "comms_conversations"("priority");

-- CreateIndex
CREATE INDEX "comms_conversations_unread_idx" ON "comms_conversations"("unread");

-- CreateIndex
CREATE INDEX "comms_conversations_last_message_at_idx" ON "comms_conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "comms_conversations_deleted_at_idx" ON "comms_conversations"("deleted_at");

-- CreateIndex
CREATE INDEX "comms_participants_organization_id_idx" ON "comms_participants"("organization_id");

-- CreateIndex
CREATE INDEX "comms_participants_conversation_id_idx" ON "comms_participants"("conversation_id");

-- CreateIndex
CREATE INDEX "comms_participants_contact_id_idx" ON "comms_participants"("contact_id");

-- CreateIndex
CREATE INDEX "comms_messages_organization_id_idx" ON "comms_messages"("organization_id");

-- CreateIndex
CREATE INDEX "comms_messages_conversation_id_idx" ON "comms_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "comms_messages_direction_idx" ON "comms_messages"("direction");

-- CreateIndex
CREATE INDEX "comms_messages_status_idx" ON "comms_messages"("status");

-- CreateIndex
CREATE INDEX "comms_messages_external_id_idx" ON "comms_messages"("external_id");

-- CreateIndex
CREATE INDEX "comms_messages_created_at_idx" ON "comms_messages"("created_at");

-- CreateIndex
CREATE INDEX "comms_attachments_organization_id_idx" ON "comms_attachments"("organization_id");

-- CreateIndex
CREATE INDEX "comms_attachments_message_id_idx" ON "comms_attachments"("message_id");

-- CreateIndex
CREATE INDEX "comms_calls_organization_id_idx" ON "comms_calls"("organization_id");

-- CreateIndex
CREATE INDEX "comms_calls_conversation_id_idx" ON "comms_calls"("conversation_id");

-- CreateIndex
CREATE INDEX "comms_calls_connection_id_idx" ON "comms_calls"("connection_id");

-- CreateIndex
CREATE INDEX "comms_calls_status_idx" ON "comms_calls"("status");

-- CreateIndex
CREATE INDEX "comms_calls_created_at_idx" ON "comms_calls"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "comms_call_recordings_call_id_key" ON "comms_call_recordings"("call_id");

-- CreateIndex
CREATE INDEX "comms_call_recordings_organization_id_idx" ON "comms_call_recordings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "comms_transcriptions_call_id_key" ON "comms_transcriptions"("call_id");

-- CreateIndex
CREATE INDEX "comms_transcriptions_organization_id_idx" ON "comms_transcriptions"("organization_id");

-- CreateIndex
CREATE INDEX "communication_events_organization_id_idx" ON "communication_events"("organization_id");

-- CreateIndex
CREATE INDEX "communication_events_conversation_id_idx" ON "communication_events"("conversation_id");

-- CreateIndex
CREATE INDEX "communication_events_type_idx" ON "communication_events"("type");

-- CreateIndex
CREATE INDEX "communication_events_occurred_at_idx" ON "communication_events"("occurred_at");

-- CreateIndex
CREATE INDEX "comms_channel_identities_organization_id_idx" ON "comms_channel_identities"("organization_id");

-- CreateIndex
CREATE INDEX "comms_channel_identities_contact_id_idx" ON "comms_channel_identities"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "comms_channel_identities_organization_id_channel_external_a_key" ON "comms_channel_identities"("organization_id", "channel", "external_address");

-- CreateIndex
CREATE INDEX "comms_conversation_labels_organization_id_idx" ON "comms_conversation_labels"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "comms_conversation_labels_organization_id_name_key" ON "comms_conversation_labels"("organization_id", "name");

-- CreateIndex
CREATE INDEX "comms_message_reactions_organization_id_idx" ON "comms_message_reactions"("organization_id");

-- CreateIndex
CREATE INDEX "comms_message_reactions_message_id_idx" ON "comms_message_reactions"("message_id");

-- CreateIndex
CREATE INDEX "ai_conversation_summaries_organization_id_idx" ON "ai_conversation_summaries"("organization_id");

-- CreateIndex
CREATE INDEX "ai_conversation_summaries_conversation_id_idx" ON "ai_conversation_summaries"("conversation_id");

-- AddForeignKey
ALTER TABLE "comms_channel_connections" ADD CONSTRAINT "comms_channel_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_channel_credentials" ADD CONSTRAINT "comms_channel_credentials_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "comms_channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_conversations" ADD CONSTRAINT "comms_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_conversations" ADD CONSTRAINT "comms_conversations_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "comms_channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_conversations" ADD CONSTRAINT "comms_conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_participants" ADD CONSTRAINT "comms_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_participants" ADD CONSTRAINT "comms_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_messages" ADD CONSTRAINT "comms_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_attachments" ADD CONSTRAINT "comms_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comms_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_calls" ADD CONSTRAINT "comms_calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_calls" ADD CONSTRAINT "comms_calls_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "comms_channel_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_call_recordings" ADD CONSTRAINT "comms_call_recordings_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "comms_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_transcriptions" ADD CONSTRAINT "comms_transcriptions_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "comms_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_events" ADD CONSTRAINT "communication_events_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_channel_identities" ADD CONSTRAINT "comms_channel_identities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "sales_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_conversation_labels" ADD CONSTRAINT "comms_conversation_labels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_conversation_label_links" ADD CONSTRAINT "comms_conversation_label_links_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_conversation_label_links" ADD CONSTRAINT "comms_conversation_label_links_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "comms_conversation_labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comms_message_reactions" ADD CONSTRAINT "comms_message_reactions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "comms_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_summaries" ADD CONSTRAINT "ai_conversation_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "comms_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
