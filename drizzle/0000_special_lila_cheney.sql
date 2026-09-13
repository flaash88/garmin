CREATE TABLE "abgleich" (
	"quelle" varchar(32) PRIMARY KEY NOT NULL,
	"bis_einschliesslich" timestamp with time zone,
	"zuletzt_am" timestamp with time zone,
	"zuletzt_fehler" text
);
--> statement-breakpoint
CREATE TABLE "aktivitaeten" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"beginn" timestamp with time zone NOT NULL,
	"name" text,
	"typ" varchar(32) NOT NULL,
	"dauer_sekunden" integer,
	"strecke_meter" double precision,
	"hoehenmeter" double precision,
	"puls_schnitt" integer,
	"puls_max" integer,
	"belastung" integer,
	"rohdaten" jsonb,
	"geholt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ausruestung" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"art" varchar(32),
	"in_benutzung" integer,
	"laufleistung_meter" double precision,
	"rohdaten" jsonb,
	"geholt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feldbefuellung" (
	"quelle" varchar(32) NOT NULL,
	"feld" varchar(64) NOT NULL,
	"befuellt" integer NOT NULL,
	"gesamt" integer NOT NULL,
	"geprueft_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tag" date NOT NULL,
	"name" text,
	"typ" varchar(32),
	"beschreibung" text,
	"ziel_belastung" integer,
	"ziel_dauer_sekunden" integer,
	"ziel_strecke_meter" double precision,
	"rohdaten" jsonb,
	"geholt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strecken" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text,
	"laenge_meter" double precision NOT NULL,
	"signatur" jsonb NOT NULL,
	"erst_mal" timestamp with time zone NOT NULL,
	"letzt_mal" timestamp with time zone NOT NULL,
	"anzahl" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strecken_zuordnung" (
	"aktivitaet_id" varchar(64) PRIMARY KEY NOT NULL,
	"strecke_id" varchar(64) NOT NULL,
	"mittlerer_abstand_meter" double precision
);
--> statement-breakpoint
CREATE TABLE "verlaeufe" (
	"aktivitaet_id" varchar(64) PRIMARY KEY NOT NULL,
	"daten" jsonb NOT NULL,
	"geholt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wellness" (
	"tag" date PRIMARY KEY NOT NULL,
	"ctl" double precision,
	"atl" double precision,
	"form" double precision,
	"ruhepuls" integer,
	"hrv" double precision,
	"gewicht" double precision,
	"schlaf_sekunden" integer,
	"befinden" integer,
	"beschwerden" text,
	"verletzung" text,
	"notizen" text,
	"rohdaten" jsonb,
	"geholt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zonen" (
	"sportart" varchar(32) PRIMARY KEY NOT NULL,
	"schwellen_puls" integer,
	"max_puls" integer,
	"schwellen_pace_sekunden_je_km" double precision,
	"puls_grenzen" jsonb,
	"rohdaten" jsonb,
	"geholt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "strecken_zuordnung" ADD CONSTRAINT "strecken_zuordnung_aktivitaet_id_aktivitaeten_id_fk" FOREIGN KEY ("aktivitaet_id") REFERENCES "public"."aktivitaeten"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strecken_zuordnung" ADD CONSTRAINT "strecken_zuordnung_strecke_id_strecken_id_fk" FOREIGN KEY ("strecke_id") REFERENCES "public"."strecken"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verlaeufe" ADD CONSTRAINT "verlaeufe_aktivitaet_id_aktivitaeten_id_fk" FOREIGN KEY ("aktivitaet_id") REFERENCES "public"."aktivitaeten"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aktivitaeten_beginn_idx" ON "aktivitaeten" USING btree ("beginn");--> statement-breakpoint
CREATE INDEX "plan_tag_idx" ON "plan" USING btree ("tag");--> statement-breakpoint
CREATE INDEX "strecken_zuordnung_strecke_idx" ON "strecken_zuordnung" USING btree ("strecke_id");