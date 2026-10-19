// @vitest-environment node
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
  it("lifts uneven gray paper towards 240 while retaining handwriting below 40", () => {
    const width = 384, height = 192;
    const source = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const value = y === 80 ? 35 : x < 192 ? 150 : 205;
      source.set([value, value, value, 255], (y * width + x) * 4);
    }
    const corrected = correctShadowPixels(source, width, height);
    expect(corrected[(40 * width + 30) * 4]).toBeGreaterThanOrEqual(235);
    expect(corrected[(80 * width + 30) * 4]).toBeLessThan(40);
    expect(corrected[(40 * width + 340) * 4]).toBeGreaterThanOrEqual(235);
  });
});
import { correctShadowPixels as correctTint } from "./scanQuality";
describe("shadow correction colour cast", () => {
  it("neutralises yellowed, shaded paper while keeping ink dark", () => {
    const w = 120, h = 120, px = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, shade = x < 60 ? 0.7 : 1, ink = y === 60 && x % 3 === 0;
      px[i] = ink ? 30 : 230 * shade; px[i + 1] = ink ? 30 : 215 * shade; px[i + 2] = ink ? 30 : 160 * shade; px[i + 3] = 255;
    }
    const out = correctTint(px, w, h);
    const at = (x: number, y: number) => Array.from(out.slice((y * w + x) * 4, (y * w + x) * 4 + 3));
    const [r, g, b] = at(20, 20);
    expect(r - b).toBeLessThan(25);
    expect(Math.min(r, g, b)).toBeGreaterThan(220);
    expect(at(60, 60)[0]).toBeLessThan(80);
  });
});
