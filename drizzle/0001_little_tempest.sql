CREATE TABLE "analysen" (
	"id" varchar(96) PRIMARY KEY NOT NULL,
	"art" varchar(32) NOT NULL,
	"bezug" varchar(64) NOT NULL,
	"text" text NOT NULL,
	"modell" varchar(64) NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analysen_art_bezug_idx" ON "analysen" USING btree ("art","bezug");