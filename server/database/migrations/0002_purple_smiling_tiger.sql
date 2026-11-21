CREATE TABLE "project_investors" (
	"project_id" integer NOT NULL,
	"investor_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "project_investors_project_id_investor_id_pk" PRIMARY KEY("project_id","investor_id")
);
--> statement-breakpoint
ALTER TABLE "project_investors" ADD CONSTRAINT "project_investors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_investors" ADD CONSTRAINT "project_investors_investor_id_investors_id_fk" FOREIGN KEY ("investor_id") REFERENCES "public"."investors"("id") ON DELETE cascade ON UPDATE no action;