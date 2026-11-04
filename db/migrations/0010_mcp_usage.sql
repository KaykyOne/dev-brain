CREATE TABLE "mcp_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"token_id" uuid,
	"tool" text NOT NULL,
	"response_chars" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_usage" ADD CONSTRAINT "mcp_usage_token_id_agent_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."agent_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_usage_owner_created_idx" ON "mcp_usage" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_usage_project_created_idx" ON "mcp_usage" USING btree ("project_id","created_at");