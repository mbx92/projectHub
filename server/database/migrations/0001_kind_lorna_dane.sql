CREATE TABLE "signature_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"judul" varchar(200) NOT NULL,
	"isi" text NOT NULL,
	"token" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'menunggu' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"dikirim_ke" varchar(190),
	"signed_at" timestamp with time zone,
	"penandatangan" varchar(160),
	"tanda_tangan" text,
	"ip" varchar(64),
	"perangkat" varchar(300),
	"hash_isi" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer
);
--> statement-breakpoint
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signature_requests_token_uq" ON "signature_requests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "signature_requests_project_idx" ON "signature_requests" USING btree ("project_id");