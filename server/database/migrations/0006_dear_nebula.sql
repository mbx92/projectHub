ALTER TABLE "invoices" ADD COLUMN "template_ref" jsonb;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "template_ref" jsonb;