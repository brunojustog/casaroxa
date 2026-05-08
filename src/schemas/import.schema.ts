import { z } from "zod";

export const importOptionsSchema = z.object({
  mode: z.enum(["create_only", "update_only", "upsert"]).default("upsert"),
  dryRun: z.boolean().default(false),
});

export type ImportMode = z.infer<typeof importOptionsSchema>["mode"];
export type ImportOptions = z.infer<typeof importOptionsSchema>;

export type SheetSummary = {
  sheet: string;
  detected: number;
  willCreate: number;
  willUpdate: number;
  willSkip: number;
  errors: { row: number; message: string }[];
};

export type ImportPreview = {
  fileName: string;
  detectedSheets: string[];
  summaries: SheetSummary[];
  warnings: string[];
};

export type ImportResult = ImportPreview & {
  executed: boolean;
  importLogId?: string;
};
