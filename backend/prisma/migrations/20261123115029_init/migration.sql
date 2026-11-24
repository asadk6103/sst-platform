-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PostKind" AS ENUM ('NEWS', 'ANNOUNCEMENT', 'ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "StoryKind" AS ENUM ('STUDENT_TESTIMONIAL', 'PARENT_TESTIMONIAL', 'ALUMNI_STORY', 'STUDENT_SUCCESS', 'SCHOLARSHIP_SUCCESS', 'ACADEMIC_ACHIEVEMENT');

-- CreateEnum
CREATE TYPE "NavMenu" AS ENUM ('MAIN', 'UTILITY', 'ABOUT_SIDEBAR', 'FOOTER_QUICK', 'FOOTER_USEFUL', 'FOOTER_LEGAL');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('PROSPECTUS', 'ADMISSION_FORM', 'GOVERNANCE_POLICY', 'PUBLICATION', 'ANNUAL_REPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "GalleryCategory" AS ENUM ('CAMPUS', 'ACADEMICS', 'SPORTS', 'RESIDENTIAL_LIFE', 'CEREMONIES', 'EVENTS', 'STUDENT_ACTIVITIES', 'ALUMNI_EVENTS');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
    "two_factor_secret" TEXT,
    "password_reset_hash" TEXT,
    "password_reset_expires" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "hero_image_id" UUID,
    "content" JSONB NOT NULL DEFAULT '{}',
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "og_image_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_data" JSONB,
    "published_at" TIMESTAMP(3),
    "scheduled_publish_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_comment" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_people" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "photo_id" UUID,
    "designation" TEXT,
    "short_bio" TEXT,
    "biography" TEXT,
    "education" TEXT,
    "profession" TEXT,
    "experience" TEXT,
    "responsibilities" JSONB NOT NULL DEFAULT '[]',
    "focus_areas" JSONB NOT NULL DEFAULT '[]',
    "affiliations" JSONB NOT NULL DEFAULT '[]',
    "social_links" JSONB NOT NULL DEFAULT '[]',
    "appointment_date" DATE,
    "tenure" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_data" JSONB,
    "published_at" TIMESTAMP(3),
    "scheduled_publish_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_comment" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_committees" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "profile_label" TEXT NOT NULL DEFAULT 'Profile',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_committee_members" (
    "id" UUID NOT NULL,
    "committee_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "role_title" TEXT NOT NULL,
    "is_head" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "start_date" DATE,
    "end_date" DATE,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_committee_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_messages" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "person_id" UUID,
    "eyebrow" TEXT,
    "heading" TEXT NOT NULL,
    "salutation" TEXT,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "quote" TEXT,
    "signature_image_id" UUID,
    "signatory_title" TEXT,
    "pdf_document_id" UUID,
    "publication_date" DATE,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_data" JSONB,
    "published_at" TIMESTAMP(3),
    "scheduled_publish_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_comment" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_news" (
    "id" UUID NOT NULL,
    "kind" "PostKind" NOT NULL DEFAULT 'NEWS',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "excerpt" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "featured_image_id" UUID,
    "author" TEXT,
    "publication_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_data" JSONB,
    "published_at" TIMESTAMP(3),
    "scheduled_publish_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_comment" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_events" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "excerpt" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "featured_image_id" UUID,
    "location" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "author" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_data" JSONB,
    "published_at" TIMESTAMP(3),
    "scheduled_publish_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_comment" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_testimonials" (
    "id" UUID NOT NULL,
    "kind" "StoryKind" NOT NULL,
    "name" TEXT NOT NULL,
    "subtitle" TEXT,
    "detail" TEXT,
    "quote" TEXT NOT NULL,
    "body" TEXT,
    "photo_id" UUID,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "published_data" JSONB,
    "published_at" TIMESTAMP(3),
    "scheduled_publish_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "review_comment" TEXT,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_statistics" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_navigation" (
    "id" UUID NOT NULL,
    "menu" "NavMenu" NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "icon" TEXT,
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "is_coming_soon" BOOLEAN NOT NULL DEFAULT false,
    "open_in_new_tab" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_navigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "website_media" (
    "id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "variants" JSONB NOT NULL DEFAULT '[]',
    "alt" TEXT,
    "caption" TEXT,
    "title" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "checksum" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_media_usage" (
    "id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "website_media_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_documents" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "file_id" UUID NOT NULL,
    "published_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_galleries" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "GalleryCategory" NOT NULL,
    "cover_image_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "website_galleries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_gallery_images" (
    "id" UUID NOT NULL,
    "gallery_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "caption" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "website_gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_revisions" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "comment" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_publication_logs" (
    "id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "comment" TEXT,
    "user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_publication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "summary" TEXT,
    "details" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_pages_slug_key" ON "website_pages"("slug");

-- CreateIndex
CREATE INDEX "website_pages_section_idx" ON "website_pages"("section");

-- CreateIndex
CREATE INDEX "website_pages_status_idx" ON "website_pages"("status");

-- CreateIndex
CREATE UNIQUE INDEX "website_people_slug_key" ON "website_people"("slug");

-- CreateIndex
CREATE INDEX "website_people_full_name_idx" ON "website_people"("full_name");

-- CreateIndex
CREATE INDEX "website_people_status_idx" ON "website_people"("status");

-- CreateIndex
CREATE UNIQUE INDEX "website_committees_slug_key" ON "website_committees"("slug");

-- CreateIndex
CREATE INDEX "website_committee_members_person_id_idx" ON "website_committee_members"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_committee_members_committee_id_person_id_key" ON "website_committee_members"("committee_id", "person_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_messages_key_key" ON "website_messages"("key");

-- CreateIndex
CREATE UNIQUE INDEX "website_news_slug_key" ON "website_news"("slug");

-- CreateIndex
CREATE INDEX "website_news_kind_publication_date_idx" ON "website_news"("kind", "publication_date");

-- CreateIndex
CREATE INDEX "website_news_status_idx" ON "website_news"("status");

-- CreateIndex
CREATE UNIQUE INDEX "website_events_slug_key" ON "website_events"("slug");

-- CreateIndex
CREATE INDEX "website_events_start_date_idx" ON "website_events"("start_date");

-- CreateIndex
CREATE INDEX "website_events_status_idx" ON "website_events"("status");

-- CreateIndex
CREATE INDEX "website_testimonials_kind_idx" ON "website_testimonials"("kind");

-- CreateIndex
CREATE INDEX "website_testimonials_status_idx" ON "website_testimonials"("status");

-- CreateIndex
CREATE UNIQUE INDEX "website_statistics_key_key" ON "website_statistics"("key");

-- CreateIndex
CREATE INDEX "website_statistics_group_sort_order_idx" ON "website_statistics"("group", "sort_order");

-- CreateIndex
CREATE INDEX "website_navigation_menu_sort_order_idx" ON "website_navigation"("menu", "sort_order");

-- CreateIndex
CREATE INDEX "website_media_category_idx" ON "website_media"("category");

-- CreateIndex
CREATE INDEX "website_media_mime_type_idx" ON "website_media"("mime_type");

-- CreateIndex
CREATE INDEX "website_media_usage_entity_type_entity_id_idx" ON "website_media_usage"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_media_usage_media_id_entity_type_entity_id_key" ON "website_media_usage"("media_id", "entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_documents_slug_key" ON "website_documents"("slug");

-- CreateIndex
CREATE INDEX "website_documents_category_idx" ON "website_documents"("category");

-- CreateIndex
CREATE UNIQUE INDEX "website_galleries_slug_key" ON "website_galleries"("slug");

-- CreateIndex
CREATE INDEX "website_galleries_category_idx" ON "website_galleries"("category");

-- CreateIndex
CREATE INDEX "website_gallery_images_gallery_id_sort_order_idx" ON "website_gallery_images"("gallery_id", "sort_order");

-- CreateIndex
CREATE INDEX "website_revisions_entity_type_entity_id_idx" ON "website_revisions"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_revisions_entity_type_entity_id_version_key" ON "website_revisions"("entity_type", "entity_id", "version");

-- CreateIndex
CREATE INDEX "website_publication_logs_entity_type_entity_id_idx" ON "website_publication_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "website_publication_logs_created_at_idx" ON "website_publication_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_committee_members" ADD CONSTRAINT "website_committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "website_committees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_committee_members" ADD CONSTRAINT "website_committee_members_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "website_people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_messages" ADD CONSTRAINT "website_messages_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "website_people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_navigation" ADD CONSTRAINT "website_navigation_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "website_navigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_media_usage" ADD CONSTRAINT "website_media_usage_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "website_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_gallery_images" ADD CONSTRAINT "website_gallery_images_gallery_id_fkey" FOREIGN KEY ("gallery_id") REFERENCES "website_galleries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
