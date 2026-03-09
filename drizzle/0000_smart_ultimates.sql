CREATE TABLE "faces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_name" text NOT NULL,
	"person_id" uuid,
	"aws_face_id" text,
	"landmarks" jsonb NOT NULL,
	"box_x" real NOT NULL,
	"box_y" real NOT NULL,
	"box_w" real NOT NULL,
	"box_h" real NOT NULL,
	"thumbnail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"face_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"width" integer,
	"height" integer,
	"event" text DEFAULT 'codebrew' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "photos_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "splats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_name" text NOT NULL,
	"ply_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "splats_photo_name_unique" UNIQUE("photo_name")
);
--> statement-breakpoint
ALTER TABLE "faces" ADD CONSTRAINT "faces_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faces_photo_name_idx" ON "faces" USING btree ("photo_name");--> statement-breakpoint
CREATE INDEX "faces_person_id_idx" ON "faces" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "splats_photo_name_idx" ON "splats" USING btree ("photo_name");--> statement-breakpoint
CREATE INDEX "splats_status_idx" ON "splats" USING btree ("status");