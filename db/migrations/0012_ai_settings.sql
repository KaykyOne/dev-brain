CREATE TYPE "public"."ai_provider" AS ENUM('deepseek', 'openai', 'openrouter', 'custom');--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"provider" "ai_provider" DEFAULT 'deepseek' NOT NULL,
	"api_key_ciphertext" text,
	"api_key_hint" text,
	"model" text,
	"base_url" text,
	"thinking" boolean DEFAULT false NOT NULL,
	"max_steps" integer DEFAULT 12 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;