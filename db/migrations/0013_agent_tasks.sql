CREATE TYPE "public"."task_agent" AS ENUM('claude', 'codex');--> statement-breakpoint
CREATE TYPE "public"."task_branch_mode" AS ENUM('new', 'existing');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('queued', 'running', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "agent_task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"agent" "task_agent" DEFAULT 'claude' NOT NULL,
	"branch_mode" "task_branch_mode" DEFAULT 'new' NOT NULL,
	"branch" text,
	"base_branch" text,
	"position" bigint NOT NULL,
	"status" "task_status" DEFAULT 'queued' NOT NULL,
	"source" text NOT NULL,
	"runner" text,
	"result_branch" text,
	"summary" text,
	"error" text,
	"log_tail" text,
	"committed" boolean DEFAULT false NOT NULL,
	"cancel_requested_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_task_attachments" ADD CONSTRAINT "agent_task_attachments_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_task_attachments_task_idx" ON "agent_task_attachments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "agent_tasks_project_status_position_idx" ON "agent_tasks" USING btree ("project_id","status","position");--> statement-breakpoint
CREATE INDEX "agent_tasks_owner_created_idx" ON "agent_tasks" USING btree ("owner_id","created_at");