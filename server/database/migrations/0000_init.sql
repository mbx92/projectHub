CREATE TYPE "public"."bug_severity" AS ENUM('kritis', 'tinggi', 'sedang', 'rendah');--> statement-breakpoint
CREATE TYPE "public"."bug_status" AS ENUM('open', 'dikerjakan', 'review', 'selesai');--> statement-breakpoint
CREATE TYPE "public"."investor_status" AS ENUM('aktif', 'calon');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draf', 'terkirim', 'lunas', 'batal');--> statement-breakpoint
CREATE TYPE "public"."ledger_type" AS ENUM('masuk', 'keluar');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('belum', 'berjalan', 'selesai');--> statement-breakpoint
CREATE TYPE "public"."pay_type" AS ENUM('bagi_hasil', 'tetap');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('persiapan', 'berjalan', 'tertunda', 'selesai');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'investor', 'developer');--> statement-breakpoint
CREATE TYPE "public"."share_part" AS ENUM('modal', 'pekerja', 'kas');--> statement-breakpoint
CREATE TYPE "public"."term_status" AS ENUM('terjadwal', 'draf', 'terkirim', 'lunas');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('undangan', 'reset');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('diundang', 'aktif', 'nonaktif');--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" varchar(40) NOT NULL,
	"entity_id" integer NOT NULL,
	"file_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime" varchar(120),
	"size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"aksi" varchar(40) NOT NULL,
	"entitas" varchar(40) NOT NULL,
	"entity_id" integer,
	"sebelum" jsonb,
	"sesudah" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank" varchar(80) NOT NULL,
	"nomor" varchar(60) NOT NULL,
	"atas_nama" varchar(120) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "bug_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bug_id" integer NOT NULL,
	"user_id" integer,
	"isi" text NOT NULL,
	"jenis" varchar(20) DEFAULT 'comment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "bugs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kode" varchar(20) NOT NULL,
	"project_id" integer NOT NULL,
	"judul" varchar(200) NOT NULL,
	"deskripsi" text,
	"langkah" text,
	"seharusnya" text,
	"kenyataan" text,
	"modul" varchar(80),
	"keparahan" "bug_severity" DEFAULT 'sedang' NOT NULL,
	"status" "bug_status" DEFAULT 'open' NOT NULL,
	"assignee_id" integer,
	"pelapor" varchar(120),
	"pelapor_user_id" integer,
	"target" date,
	"menghambat_termin" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "capital_deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"nominal" bigint NOT NULL,
	"peruntukan" text,
	"bukti_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "cash_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"tanggal" date NOT NULL,
	"jenis" "ledger_type" NOT NULL,
	"nominal" bigint NOT NULL,
	"ref_type" varchar(40) NOT NULL,
	"ref_id" integer,
	"keterangan" text,
	"project_id" integer,
	"saldo" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"contact_name" varchar(120),
	"whatsapp" varchar(40),
	"email" varchar(190),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "distribution_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"distribution_id" integer NOT NULL,
	"penerima" integer,
	"bagian" "share_part" NOT NULL,
	"nominal" bigint NOT NULL,
	"persen" numeric(6, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "distributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tanggal" date NOT NULL,
	"laba_bersih" bigint NOT NULL,
	"snapshot_skema" jsonb NOT NULL,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"nama" varchar(200) NOT NULL,
	"jenis" varchar(60) NOT NULL,
	"status" varchar(40) DEFAULT 'draf' NOT NULL,
	"file_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"tanggal" date NOT NULL,
	"keterangan" text NOT NULL,
	"kategori" varchar(60) NOT NULL,
	"nominal" bigint NOT NULL,
	"sumber" varchar(60) DEFAULT 'kas_ocn' NOT NULL,
	"adalah_aset" boolean DEFAULT false NOT NULL,
	"bukti_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"status" "investor_status" DEFAULT 'calon' NOT NULL,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"deskripsi" text NOT NULL,
	"qty" numeric(10, 2) DEFAULT 1 NOT NULL,
	"harga" bigint NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"nomor" varchar(60) NOT NULL,
	"term_id" integer,
	"project_id" integer NOT NULL,
	"terbit" date NOT NULL,
	"jatuh_tempo" date NOT NULL,
	"subtotal" bigint DEFAULT 0 NOT NULL,
	"diskon" bigint DEFAULT 0 NOT NULL,
	"pajak_persen" numeric(6, 2) DEFAULT 0 NOT NULL,
	"pajak" bigint DEFAULT 0 NOT NULL,
	"total" bigint DEFAULT 0 NOT NULL,
	"catatan" text,
	"rekening_id" integer,
	"tampil_qris" boolean DEFAULT false NOT NULL,
	"status" "invoice_status" DEFAULT 'draf' NOT NULL,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"target" date,
	"status" "milestone_status" DEFAULT 'belum' NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"jenis" varchar(40) NOT NULL,
	"judul" varchar(200) NOT NULL,
	"isi" text,
	"link" text,
	"dibaca" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice_id" integer NOT NULL,
	"nominal" bigint NOT NULL,
	"tanggal" date NOT NULL,
	"metode" varchar(60) NOT NULL,
	"bukti_url" text,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "profit_schemes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"persen_modal" numeric(6, 2) DEFAULT 0 NOT NULL,
	"persen_pekerja" numeric(6, 2) DEFAULT 0 NOT NULL,
	"persen_kas" numeric(6, 2) DEFAULT 0 NOT NULL,
	"label_bagian" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"peran_di_proyek" varchar(80),
	"cara_bayar" "pay_type" DEFAULT 'bagi_hasil' NOT NULL,
	"honor_tetap" bigint DEFAULT 0 NOT NULL,
	"bobot" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "project_members_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"description" text,
	"stack" varchar(200),
	"status" "project_status" DEFAULT 'persiapan' NOT NULL,
	"client_id" integer,
	"nilai_kontrak" bigint DEFAULT 0 NOT NULL,
	"anggaran" bigint DEFAULT 0 NOT NULL,
	"mulai" date,
	"target_selesai" date,
	"progress" integer DEFAULT 0 NOT NULL,
	"pj_id" integer,
	"skema_id" integer,
	"persen_modal" numeric(6, 2) DEFAULT 0 NOT NULL,
	"persen_pekerja" numeric(6, 2) DEFAULT 0 NOT NULL,
	"persen_kas" numeric(6, 2) DEFAULT 0 NOT NULL,
	"diarsipkan" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"kunci" varchar(80) PRIMARY KEY NOT NULL,
	"nilai" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"persen" numeric(6, 2) NOT NULL,
	"nominal" bigint NOT NULL,
	"syarat" text,
	"jatuh_tempo" date,
	"status" "term_status" DEFAULT 'terjadwal' NOT NULL,
	"urutan" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "user_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" "token_type" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" varchar(190) NOT NULL,
	"password_hash" text,
	"role" "role" NOT NULL,
	"status" "user_status" DEFAULT 'diundang' NOT NULL,
	"title" varchar(80),
	"phone" varchar(40),
	"avatar_color" varchar(9),
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_bug_id_bugs_id_fk" FOREIGN KEY ("bug_id") REFERENCES "public"."bugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_comments" ADD CONSTRAINT "bug_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bugs" ADD CONSTRAINT "bugs_pelapor_user_id_users_id_fk" FOREIGN KEY ("pelapor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_deposits" ADD CONSTRAINT "capital_deposits_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_ledger" ADD CONSTRAINT "cash_ledger_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_lines" ADD CONSTRAINT "distribution_lines_distribution_id_distributions_id_fk" FOREIGN KEY ("distribution_id") REFERENCES "public"."distributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_lines" ADD CONSTRAINT "distribution_lines_penerima_users_id_fk" FOREIGN KEY ("penerima") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distributions" ADD CONSTRAINT "distributions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_rekening_id_bank_accounts_id_fk" FOREIGN KEY ("rekening_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_pj_id_users_id_fk" FOREIGN KEY ("pj_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_skema_id_profit_schemes_id_fk" FOREIGN KEY ("skema_id") REFERENCES "public"."profit_schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entitas","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bugs_code_uq" ON "bugs" USING btree ("kode");--> statement-breakpoint
CREATE INDEX "bugs_project_idx" ON "bugs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "cash_ledger_ref_idx" ON "cash_ledger" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "cash_ledger_date_idx" ON "cash_ledger" USING btree ("tanggal");--> statement-breakpoint
CREATE INDEX "expenses_project_idx" ON "expenses" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "investors_user_uq" ON "investors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("nomor");--> statement-breakpoint
CREATE INDEX "invoices_term_idx" ON "invoices" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","dibaca");--> statement-breakpoint
CREATE INDEX "projects_client_idx" ON "projects" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "terms_project_idx" ON "terms" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tokens_hash_uq" ON "user_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");