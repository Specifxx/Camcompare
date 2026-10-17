import type { Camera } from "../src/lib/catalog/schema";

const SPECS: Camera["specs"] = {
  sensorFormat: "full-frame", sensorType: "BSI CMOS", megapixels: 24, isoMin: 100, isoMax: 51200, ibis: true, ibisStops: 5,
  burstMechFps: 10, burstElecFps: 20, shutterMaxMech: 8000, shutterMaxElec: 16000, afPoints: null, afSubjects: ["human"],
  videoMaxRes: "4K", video4kMaxFps: 60, video10bit: true, rawVideoInternal: false, evfDotsM: 3.69, viewfinderType: "electronic",
  screenSizeIn: 3, screenDotsM: 1.62, screenType: "fully-articulating", touchscreen: true, weightG: 650, dimensionsMm: [130, 95, 80],
  weatherSealed: true, cardSlots: 2, cardTypes: "SD UHS-II x2", batteryShotsCipa: 500, usbC: true, micJack: true, headphoneJack: true,
  builtInFlash: false, wifi: true, bluetooth: true,
};

export function cam(slug: string, brand: string, aliases: string[], over: Partial<Camera> = {}, specs: Partial<Camera["specs"]> = {}): Camera {
  return {
    slug, brand, name: aliases[0], shortName: aliases[0], aliases, modelCodes: [], gtins: [], type: "mirrorless",
    announced: "2022-01-01", launchPriceUsd: 2000, status: "current", predecessor: null, successor: null, rivals: [],
    mount: "sony-e", fixedLens: null, specs: { ...SPECS, ...specs }, ...over,
  };
}

export const CAMERAS: Camera[] = [
  cam("sony-a7-iv", "sony", ["a7 IV", "a7IV", "Alpha 7 IV", "A7M4"], { modelCodes: ["ILCE-7M4"], gtins: ["027242923577"], launchPriceUsd: 2499 }, { megapixels: 33 }),
  cam("sony-a7-iii", "sony", ["a7 III", "a7III", "Alpha 7 III"], { modelCodes: ["ILCE-7M3"], launchPriceUsd: 1999 }),
  cam("sony-a7r-iv", "sony", ["a7R IV", "a7RIV"], { modelCodes: ["ILCE-7RM4"], launchPriceUsd: 3499 }, { megapixels: 61 }),
  cam("sony-a7c", "sony", ["a7C"], { modelCodes: ["ILCE-7C"], launchPriceUsd: 1799 }),
  cam("sony-a7c-ii", "sony", ["a7C II", "a7CII"], { modelCodes: ["ILCE-7CM2"], launchPriceUsd: 2199 }),
  cam("sony-a7cr", "sony", ["a7CR"], { modelCodes: ["ILCE-7CR"], launchPriceUsd: 2999 }),
  cam("nikon-z6-ii", "nikon", ["Z6 II", "Z 6II", "Z6II"], { mount: "nikon-z", launchPriceUsd: 1999 }),
  cam("nikon-z6-iii", "nikon", ["Z6 III", "Z 6III", "Z6III"], { mount: "nikon-z", launchPriceUsd: 2499 }),
  cam("nikon-z50", "nikon", ["Z50", "Z 50"], { mount: "nikon-z", launchPriceUsd: 859 }, { sensorFormat: "aps-c" }),
  cam("canon-eos-r5", "canon", ["EOS R5", "R5"], { mount: "canon-rf", launchPriceUsd: 3899 }),
  cam("canon-eos-r50", "canon", ["EOS R50", "R50"], { mount: "canon-rf", launchPriceUsd: 679 }, { sensorFormat: "aps-c" }),
  cam("canon-eos-r6-mark-ii", "canon", ["EOS R6 Mark II", "R6 Mark II", "R6 II"], { mount: "canon-rf", launchPriceUsd: 2499 }),
  cam("fujifilm-x100v", "fujifilm", ["X100V"], { mount: null, fixedLens: { focalMm: [35], aperture: "f/2" }, type: "compact", launchPriceUsd: 1399 }),
  cam("fujifilm-x100vi", "fujifilm", ["X100VI"], { mount: null, fixedLens: { focalMm: [35], aperture: "f/2" }, type: "compact", launchPriceUsd: 1599 }),
];
