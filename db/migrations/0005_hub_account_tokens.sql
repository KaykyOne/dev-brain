ALTER TABLE "agent_tokens" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
UPDATE "agent_tokens" SET "owner_id" = "projects"."owner_id" FROM "projects" WHERE "projects"."id" = "agent_tokens"."project_id";--> statement-breakpoint
ALTER TABLE "agent_tokens" ALTER COLUMN "owner_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tokens" ADD CONSTRAINT "agent_tokens_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
