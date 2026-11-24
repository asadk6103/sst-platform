-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('CONTACT', 'SUBSCRIBE', 'NOMINATION', 'CAREER', 'ALUMNI');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NEW', 'READ', 'ARCHIVED');

-- AlterTable
ALTER TABLE "website_news" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "document_id" UUID,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "website_documents" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "website_documents" ALTER COLUMN "category" TYPE TEXT USING lower(replace("category"::text, '_', '-'));
ALTER TABLE "website_documents" ALTER COLUMN "category" SET DEFAULT 'other';

-- AlterTable
ALTER TABLE "website_galleries" ADD COLUMN     "event_date" DATE,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "videos" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "website_galleries" ALTER COLUMN "category" TYPE TEXT USING lower(replace("category"::text, '_', '-'));

-- DropEnum
DROP TYPE "DocumentCategory";

-- DropEnum
DROP TYPE "GalleryCategory";

-- CreateTable
CREATE TABLE "website_categories" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_faculty" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "photo_id" UUID,
    "designation" TEXT,
    "department" TEXT,
    "programmes" TEXT,
    "subject" TEXT,
    "qualification" TEXT,
    "experience" TEXT,
    "joined_date" DATE,
    "email" TEXT,
    "about" TEXT,
    "qualifications" JSONB NOT NULL DEFAULT '[]',
    "teaching_areas" JSONB NOT NULL DEFAULT '[]',
    "interests" JSONB NOT NULL DEFAULT '[]',
    "development" JSONB NOT NULL DEFAULT '[]',
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "quote" TEXT,
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

    CONSTRAINT "website_faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_exam_results" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "examination" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "grades" JSONB NOT NULL DEFAULT '[]',
    "subjects" JSONB NOT NULL DEFAULT '[]',
    "classes" JSONB NOT NULL DEFAULT '[]',
    "achievers" JSONB NOT NULL DEFAULT '[]',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "website_exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_vacancies" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT,
    "location" TEXT,
    "job_type" TEXT,
    "closing_date" DATE,
    "summary" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "website_vacancies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_faqs" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_submissions" (
    "id" UUID NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'NEW',
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "file_key" TEXT,
    "file_name" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "website_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "website_categories_scope_sort_order_idx" ON "website_categories"("scope", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "website_categories_scope_slug_key" ON "website_categories"("scope", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "website_faculty_slug_key" ON "website_faculty"("slug");

-- CreateIndex
CREATE INDEX "website_faculty_full_name_idx" ON "website_faculty"("full_name");

-- CreateIndex
CREATE INDEX "website_faculty_status_idx" ON "website_faculty"("status");

-- CreateIndex
CREATE UNIQUE INDEX "website_exam_results_slug_key" ON "website_exam_results"("slug");

-- CreateIndex
CREATE INDEX "website_exam_results_status_idx" ON "website_exam_results"("status");

-- CreateIndex
CREATE UNIQUE INDEX "website_exam_results_examination_year_key" ON "website_exam_results"("examination", "year");

-- CreateIndex
CREATE UNIQUE INDEX "website_vacancies_slug_key" ON "website_vacancies"("slug");

-- CreateIndex
CREATE INDEX "website_vacancies_status_idx" ON "website_vacancies"("status");

-- CreateIndex
CREATE INDEX "website_faqs_category_sort_order_idx" ON "website_faqs"("category", "sort_order");

-- CreateIndex
CREATE INDEX "website_submissions_type_status_created_at_idx" ON "website_submissions"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "website_documents_category_idx" ON "website_documents"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "website_galleries_category_idx" ON "website_galleries"("category");

