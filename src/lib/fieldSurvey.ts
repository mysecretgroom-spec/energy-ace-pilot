import { z } from "zod";

const measurement = z.union([z.literal(""), z.number().finite().nonnegative()]);
const check = z.enum(["", "ok", "attention", "na"]);
const facadeSchema = z.object({
  id: z.string(), name: z.string(), orientation: z.string(),
  width: measurement, height: measurement, openings: measurement,
  condition: check, notes: z.string(),
});
const surveySchema = z.object({
  version: z.literal(1),
  pac: z.object({ emitters: check, network: check, electricity: check, location: check, drainage: check,
    waterTemperature: measurement, neighbourDistance: measurement, notes: z.string(), reviewedAt: z.string().nullable() }),
  ite: z.object({ access: check, urbanism: check, facades: z.array(facadeSchema), notes: z.string(), reviewedAt: z.string().nullable() }),
});
export type FieldSurvey = z.infer<typeof surveySchema>;
export type FacadeSurvey = z.infer<typeof facadeSchema>;
export type SurveyCheck = z.infer<typeof check>;
export function emptyFieldSurvey(): FieldSurvey {
  return { version: 1, pac: { emitters: "", network: "", electricity: "", location: "", drainage: "", waterTemperature: "", neighbourDistance: "", notes: "", reviewedAt: null },
    ite: { access: "", urbanism: "", facades: [], notes: "", reviewedAt: null } };
}
export function parseFieldSurvey(value: unknown): FieldSurvey {
  const result = surveySchema.safeParse(value);
  return result.success ? result.data : emptyFieldSurvey();
}
export function newFacade(): FacadeSurvey {
  return { id: crypto.randomUUID(), name: "", orientation: "", width: "", height: "", openings: "", condition: "", notes: "" };
}
export function facadeAreas(facade: Pick<FacadeSurvey, "width" | "height" | "openings">) {
  const gross = Number(facade.width) * Number(facade.height);
  const openings = Number(facade.openings);
  return { gross, openings, net: Math.max(0, gross - openings), invalid: openings > gross };
}
export function surveyPhotoSource(product: "PAC" | "ITE", subject: string) {
  return `field_survey:${product}:${subject}`;
}