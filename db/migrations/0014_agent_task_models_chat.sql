CREATE TYPE "public"."task_message_role" AS ENUM('user', 'agent', 'plan');--> statement-breakpoint
CREATE TABLE "agent_task_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"role" "task_message_role" NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "plan_model" text;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "exec_model" text;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "plan_first" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "plan" text;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD COLUMN "session_id" text;--> statement-breakpoint
ALTER TABLE "agent_task_messages" ADD CONSTRAINT "agent_task_messages_task_id_agent_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."agent_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_task_messages_task_created_idx" ON "agent_task_messages" USING btree ("task_id","created_at");