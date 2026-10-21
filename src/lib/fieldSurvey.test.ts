import { describe, expect, it } from "vitest";
import { emptyFieldSurvey, facadeAreas, parseFieldSurvey, surveyPhotoSource } from "./fieldSurvey";

describe("PAC/ITE field survey", () => {
  it("measures each facade independently and subtracts its openings", () => {
    expect(facadeAreas({ width: 10, height: 3, openings: 5 })).toEqual({ gross: 30, openings: 5, net: 25, invalid: false });
    expect(facadeAreas({ width: 8, height: 3, openings: 2 }).net).toBe(22);
  });
  it("flags openings larger than the facade without a negative net area", () => {
    expect(facadeAreas({ width: 2, height: 3, openings: 7 })).toEqual({ gross: 6, openings: 7, net: 0, invalid: true });
  });
  it("restores facade measurements, checks and notes", () => {
    const survey = emptyFieldSurvey();
    survey.ite.facades.push({ id: "south", name: "Jardin", orientation: "S", width: 10, height: 3, openings: 5, condition: "attention", notes: "Fissure" });
    survey.pac.notes = "Évacuation à prévoir";
    expect(parseFieldSurvey(JSON.parse(JSON.stringify(survey)))).toEqual(survey);
    expect(parseFieldSurvey(null)).toEqual(emptyFieldSurvey());
  });
  it("keeps photo subjects isolated between products and facades", () => {
    expect(surveyPhotoSource("ITE", "south")).toBe("field_survey:ITE:south");
    expect(surveyPhotoSource("ITE", "north")).not.toBe(surveyPhotoSource("ITE", "south"));
    expect(surveyPhotoSource("PAC", "south")).not.toBe(surveyPhotoSource("ITE", "south"));
  });
});