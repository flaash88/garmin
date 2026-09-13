ALTER TABLE "zonen" ADD COLUMN "gruppe" jsonb;--> statement-breakpoint
ALTER TABLE "zonen" ADD COLUMN "schwellen_pace_meter_je_sekunde" double precision;--> statement-breakpoint
ALTER TABLE "zonen" ADD COLUMN "puls_zonen_namen" jsonb;--> statement-breakpoint
ALTER TABLE "zonen" ADD COLUMN "pace_grenzen" jsonb;