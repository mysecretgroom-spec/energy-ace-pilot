import { describe, expect, it } from "vitest";
import { correctShadowPixels, rotateCorners, validScanCorners } from "./scanQuality";

const frame = { topLeft: {x:0,y:0}, topRight:{x:1,y:0}, bottomRight:{x:1,y:1}, bottomLeft:{x:0,y:1} };
describe("precise scanner geometry", () => {
  it("accepts the full image but rejects crossed and off-image corners", () => {
    expect(validScanCorners(frame)).toBe(true);
    expect(validScanCorners({...frame, topRight: frame.bottomLeft})).toBe(false);
    expect(validScanCorners({...frame, topLeft:{x:-0.1,y:0}})).toBe(false);
  });
  it("rotates the same crop without selecting another part of the document", () => {
    const c = {...frame, topLeft:{x:0.1,y:0.2}};
    expect(rotateCorners(c,90).topRight).toEqual({x:0.8,y:0.1});
    expect(rotateCorners(c,360)).toEqual(c);
  });
});
describe("local shadow correction", () => {
  it("leaves evenly lit paper, text, color and alpha unchanged", () => {
    const pixels = new Uint8ClampedArray([220,220,220,255,20,20,20,255,220,220,220,255,220,220,220,255]);
    expect(correctShadowPixels(pixels,4,1)).toEqual(pixels);
  });
  it("reduces a paper shadow while preserving dark text and source pixels", () => {
    const pixels = new Uint8ClampedArray(256*128*4);
    for(let y=0;y<128;y++) for(let x=0;x<256;x++) {
      const i=(y*256+x)*4, paper=x<128?140:240;
      pixels[i]=pixels[i+1]=pixels[i+2]=y===60?20:paper; pixels[i+3]=255;
    }
    const corrected=correctShadowPixels(pixels,256,128);
    expect(corrected[(30*256+16)*4]).toBeGreaterThan(220);
    expect(corrected[(60*256+16)*4]).toBeLessThan(40);
    expect(pixels[(30*256+16)*4]).toBe(140);
    expect(corrected[(30*256+16)*4+3]).toBe(255);
  });
  it("rejects malformed image dimensions",()=>expect(()=>correctShadowPixels(new Uint8ClampedArray(4),2,2)).toThrow());
});