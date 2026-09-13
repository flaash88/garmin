CREATE TABLE "einstellungen" (
	"schluessel" varchar(64) PRIMARY KEY NOT NULL,
	"wert" text NOT NULL,
	"geaendert_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nachrichten" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"unterhaltung_id" varchar(64) NOT NULL,
	"rolle" varchar(8) NOT NULL,
	"text" text NOT NULL,
	"werkzeuge" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zugang" text,
	"fehler" text,
	"reihenfolge" integer NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planeinheiten" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"vorschlag_id" varchar(64) NOT NULL,
	"tag" date NOT NULL,
	"name" text NOT NULL,
	"typ" varchar(32) DEFAULT 'Run' NOT NULL,
	"beschreibung" text,
	"dauer_sekunden" integer,
	"strecke_meter" double precision,
	"ziel_belastung" integer,
	"ersetzt_plan_id" varchar(64),
	"zustand" varchar(16) DEFAULT 'vorschlag' NOT NULL,
	"icu_event_id" varchar(64),
	"fehler" text,
	"verworfen_am" timestamp with time zone,
	"uebertragen_am" timestamp with time zone,
	"reihenfolge" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planvorschlaege" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ziel" text,
	"von_tag" date NOT NULL,
	"bis_tag" date NOT NULL,
	"wochen" integer NOT NULL,
	"begruendung" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unterhaltungen" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"titel" text NOT NULL,
	"begonnen_am" timestamp with time zone DEFAULT now() NOT NULL,
	"zuletzt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nachrichten" ADD CONSTRAINT "nachrichten_unterhaltung_id_unterhaltungen_id_fk" FOREIGN KEY ("unterhaltung_id") REFERENCES "public"."unterhaltungen"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planeinheiten" ADD CONSTRAINT "planeinheiten_vorschlag_id_planvorschlaege_id_fk" FOREIGN KEY ("vorschlag_id") REFERENCES "public"."planvorschlaege"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nachrichten_faden_idx" ON "nachrichten" USING btree ("unterhaltung_id","reihenfolge");--> statement-breakpoint
CREATE INDEX "planeinheiten_vorschlag_idx" ON "planeinheiten" USING btree ("vorschlag_id","reihenfolge");--> statement-breakpoint
CREATE INDEX "planeinheiten_tag_idx" ON "planeinheiten" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "planeinheiten_zustand_idx" ON "planeinheiten" USING btree ("zustand");--> statement-breakpoint
CREATE INDEX "planvorschlaege_erstellt_idx" ON "planvorschlaege" USING btree ("erstellt_am");--> statement-breakpoint
CREATE INDEX "unterhaltungen_zuletzt_idx" ON "unterhaltungen" USING btree ("zuletzt_am");