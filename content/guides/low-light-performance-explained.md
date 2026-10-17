---
title: How to judge a camera's low-light performance
description: Why a camera's ISO range says little about low light, and what does matter: sensor size, read noise, dynamic range, stabilisation and fast lenses.
updated: 2026-10-17
---

Almost every camera spec sheet quotes a huge maximum ISO, and almost none of those numbers tells you how clean a photo taken in a dim room will look. Low-light performance comes from how much light reaches the sensor and how little noise the camera adds while reading it. This guide explains what to look at instead, and how to use the free measurements and test images that let you compare cameras fairly.

## Why the ISO range on a spec sheet says little

ISO on a digital camera is a brightness setting, not a measure of sensitivity you can buy more of. Raising it mostly amplifies the signal the sensor has already recorded, either in the sensor's analogue circuits or later in processing. It doesn't make the sensor collect more light.

That is why a maximum ISO is a poor guide:

- **It is the ceiling, not the usable range.** A camera can offer a very high setting whose images are too noisy for most uses.
- **Extended settings are often processing.** Many cameras list "extended" ISO values beyond the standard range. These are frequently the camera pushing a lower setting's data brighter, which you could do yourself later from a raw file.
- **Makers decide where to stop.** Two cameras with similar sensors can quote very different maximums simply because one maker chose to offer more settings.

A better question is how noisy a picture looks at the ISO you will actually use, when viewed at the size you will actually view it.

## What really sets low-light quality

### Total light: sensor size and the lens

Noise in a well-exposed photo comes mostly from the randomness of light itself, called shot noise. The more light the sensor collects in total, the smaller that randomness is relative to the image. Total light depends on three things: the sensor's area, the lens's aperture and the shutter speed.

At the same f-number and shutter speed, a full-frame sensor collects a little over a stop more light than APS-C and about two stops more than Micro Four Thirds, because it is larger. [Camera sensor sizes explained](/guides/sensor-sizes-explained) sets out the areas, and [full frame vs APS-C](/guides/full-frame-vs-aps-c) looks at what that difference is worth in practice.

### Pixel size matters less than you'd think

It is often said that bigger pixels mean less noise. Per pixel that is true, but you don't look at single pixels: you look at a whole picture. When two images from the same sensor size are viewed at the same size, a higher-resolution sensor's smaller pixels are averaged together, and the shot noise ends up broadly similar. Pixel size mostly matters at the extremes, in very dark shadows where the sensor's own electronic noise starts to dominate.

So don't rule out a high-resolution camera for low light on pixel count alone. Compare images scaled to the same size.

### Read noise and dynamic range

The sensor and its electronics add a little noise of their own each time an image is read out. This read noise matters most in the darkest parts of a picture and at low ISO settings, and it is a big part of why shadows look clean on some cameras and blotchy on others. Lower read noise usually means more dynamic range: more room to brighten shadows without them falling apart, and more usable detail in scenes that mix deep shadow and bright lights, such as streets at night.

Read noise is where sensor design and generation make the difference, rather than sensor size alone.

### BSI and stacked sensors

A back-side illuminated (BSI) sensor moves its wiring behind the light-sensitive layer, so more light reaches each pixel. The design began in small sensors; Sony's a7R II, launched in 2015, was described at launch as the first full-frame camera with a BSI sensor.

A stacked sensor adds a layer of fast circuitry or memory behind the pixels, mainly to read the sensor out faster. That helps with electronic-shutter distortion, burst rates and autofocus; Sony's a9 of 2017 was marketed as the first full-frame camera with one. Faster readout is not automatically lower noise, and some fast-readout sensors trade a little dynamic range for speed. Treat "BSI" and "stacked" as clues to look at measurements, not as a guarantee.

### Dual-gain sensors

Many current sensors can switch between two analogue gain modes. Above a certain ISO the camera changes to a high-gain mode with lower read noise, so shadows at that setting can look cleaner than at the setting just below it. Makers rarely publish where the switch happens, and some don't mention it at all, but it shows up clearly in independent measurements as a sudden drop in read noise. Knowing the switch point is useful: in a dark venue, shooting at or just above it can give cleaner results than staying just below.

## Shooting aids that buy you light

### Fast lenses

The simplest way to collect more light is a brighter lens. Each full stop of aperture doubles the light: f/1.8 lets in about two and a half times as much as f/2.8, and nearly ten times as much as f/5.6. A kit zoom that closes down to f/5.6 or f/6.3 at its long end is often the weakest link in low light. A fast prime can make a bigger difference than a new body; [the first lens to buy after the kit lens](/guides/first-lens-upgrade) explains the options. [Lenses](/lenses) can be filtered by mount and aperture.

### In-body and lens stabilisation

Stabilisation lets you hand-hold slower shutter speeds, so you can use a lower ISO for the same brightness. Makers quote stabilisation in stops, usually measured under the CIPA standard, and real results depend on the focal length and how steady you are. It only helps with still subjects. A person walking or a child at a party still needs a fast enough shutter to freeze them, and there the aperture and sensor are what count.

### Other factors

- **Autofocus in low light.** Some cameras quote a low-light autofocus limit in EV. A lower (more negative) figure means it can focus in dimmer light, but the test conditions and lens used differ between makers, so compare with care.
- **Raw files.** Shooting raw lets you apply your own noise reduction, which often beats the camera's JPEG processing at high ISO.
- **Video.** Video noise depends on the recording mode, crop and any line-skipping, so a camera that is clean in stills may not be in every video mode.

## How to compare cameras yourself

Two free resources do most of the work.

### Photons to Photos charts

Bill Claff's Photons to Photos site publishes measurements from raw files for a large number of cameras. Two of its charts are especially useful:

- **Photographic dynamic range (PDR).** This plots dynamic range against ISO. It adjusts its noise threshold to each sensor's size, so cameras of different formats and resolutions are compared on a like-for-like basis. Higher is better, and the curve shows how quickly a camera loses range as ISO rises.
- **Read noise.** This plots read noise against ISO setting. A sudden step down is the signature of a dual-gain sensor, and the ISO where it happens is the switch point.

Read them as relative comparisons. Small differences, a fraction of a stop, are hard to see in real photos. Large gaps, a stop or more, usually are visible. The x-axis is the ISO setting the camera reports, which isn't always exactly comparable between makers.

### DPReview's studio scene

DPReview's studio comparison tool shows the same detailed test scene shot by many cameras at each ISO setting, as JPEG and as raw files processed in a standard way. Besides the daylight scene, there is a low-light mode lit by a single tungsten bulb, which is a much harsher test of noise. A few tips:

- **Compare raw, not only JPEG.** JPEGs show each maker's processing choices; raw shows more of what the sensor itself can do.
- **Match the output size.** Viewing a high-resolution camera at full size against a lower-resolution one exaggerates its noise. Scale images to a common size where the tool allows it.
- **Look at shadows and fine detail,** not just flat grey areas. Heavy noise reduction can make a flat area look clean while smearing texture.

### A sensible order

1. Decide what light you shoot in and what shutter speeds you need.
2. Narrow by sensor size and the fastest lenses you'd actually carry.
3. Check Photons to Photos for dynamic range and any dual-gain switch.
4. Look at studio images at the ISO you expect to use.
5. Then weigh price, handling and autofocus.

## Quick reference

| Spec or claim | What it tells you | How much weight to give it |
|---|---|---|
| Maximum ISO | The highest setting offered | Very little |
| Extended ISO | Often processing of a lower setting | Very little |
| Sensor size | Total light at the same settings | A lot |
| Megapixels | Detail; little effect on noise at the same viewing size | Some, for shadows at the extremes |
| BSI or stacked | Design clues, mainly for speed | Check measurements |
| Dual-gain ISO | A cleaner setting above the switch | Useful, if measured |
| Stabilisation (stops) | Slower hand-held shutter speeds, still subjects only | Useful for still scenes |
| Maximum aperture of your lens | Light reaching the sensor | A lot |

## Find a camera for low light

[Cameras](/cameras) lets you filter by sensor size, and each camera's page has a low light and noise section with its approximate pixel size and links to these measurements; and [compare](/compare) puts models side by side so you can check sensor size, stabilisation and video modes in one view. The [finder](/finder) suggests cameras by how you shoot, including low light. Prices differ by market, so check today's offers on each product page or on [deals](/deals) before you buy.
