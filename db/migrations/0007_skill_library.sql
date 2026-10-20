CREATE TYPE "public"."skill_scope" AS ENUM('universal', 'library', 'project');--> statement-breakpoint
CREATE TABLE "project_skill_links" (
	"project_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_skill_links_project_id_skill_id_pk" PRIMARY KEY("project_id","skill_id")
);
--> statement-breakpoint
ALTER TABLE "skills" ADD COLUMN "scope" "skill_scope" DEFAULT 'universal' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_skill_links" ADD CONSTRAINT "project_skill_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_skill_links" ADD CONSTRAINT "project_skill_links_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_skill_links_skill_idx" ON "project_skill_links" USING btree ("skill_id");--> statement-breakpoint
-- Skills que já pertencem a um projeto passam a ter o escopo "project" antes da restrição ser criada.
UPDATE "skills" SET "scope" = 'project' WHERE "project_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_scope_project_check" CHECK (("skills"."scope" = 'project') = ("skills"."project_id" is not null));