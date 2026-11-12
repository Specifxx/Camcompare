// Christmas (owner, 2026-11-01: "now that it's November, we want to make all of the sites Christmas themed"): from
// 1 November through Boxing Day, every year, by the VISITOR'S OWN calendar. Decided in the browser before first paint by
// SEASON_BOOT_SCRIPT, never on the server, so the cached pages serve everyone and the look turns itself off on
// 27 December with no deploy. globals.css keys everything on `html[data-season="christmas"]` ("xmas-common"); without
// JavaScript the site keeps its usual look.
//
// To switch it off early, set CHRISTMAS_TO to yesterday's month and day: no other file decides it. `?season=christmas`
// previews it out of season, `?season=off` hides it.

export const CHRISTMAS_FROM = 1101; // mmdd, inclusive
export const CHRISTMAS_TO = 1226;

// Festive layer (owner, 2026-11-12): the Christmas card on the home page, the 3px cranberry-and-pine hairline at the top and
// the colour accents on the deals pill and the sale strip, all inside the window above. ONE off switch: set this to false
// (after New Year) and the card falls back to the plain deals pill and the layout stops stamping data-festive, so every
// festive rule in globals.css stops matching. The window ending on 26 December removes it too, with no deploy.
export const CHRISTMAS_FESTIVE_LAYER = true;

/** Whether a local calendar date falls in the Christmas window (any year). */
export function isChristmas(d: Date): boolean {
  const k = (d.getMonth() + 1) * 100 + d.getDate();
  return k >= CHRISTMAS_FROM && k <= CHRISTMAS_TO;
}

export const SEASON_BOOT_SCRIPT = `(function(){try{var s=null,q=(typeof location!="undefined"&&location.search.match(/[?&]season=([a-z]+)/)||[])[1];if(q){if(q==="christmas")s=q}else{var n=new Date(),m=(n.getMonth()+1)*100+n.getDate();if(m>=${CHRISTMAS_FROM}&&m<=${CHRISTMAS_TO})s="christmas"}if(s)document.documentElement.setAttribute("data-season",s)}catch(e){}})();`;
