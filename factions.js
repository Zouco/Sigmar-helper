// Per-army accent colour and a simple original symbol (24x24, drawn with currentColor).
// These are generic glyphs, not the official Games Workshop logos.
const star = (n, ro, ri) => Array.from({ length: n * 2 }, (_, i) => { const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? ri : ro; return (12 + r * Math.cos(a)).toFixed(1) + "," + (12 + r * Math.sin(a)).toFixed(1); }).join(" ");

const THEMES = {
  "Stormcast Eternals": { color: "#3b8fe0", on: "#04101f", symbol: `<path d="M14 1 5 14h6l-2 9 10-14h-6z" fill="currentColor"/>` },
  "Slaves to Darkness": { color: "#d0463a", on: "#ffffff", symbol: `<polygon points="${star(8, 11, 3.5)}" fill="currentColor"/>` },
  "Sylvaneth":          { color: "#5cb85c", on: "#06170a", symbol: `<path d="M12 1C5 6 3 13 7 18c1.5 2 3.5 3 5 5 1.5-2 3.5-3 5-5 4-5 2-12-5-17z" fill="currentColor"/><path d="M12 7v13" stroke="#14110f" stroke-width="1.6" fill="none"/>` },
  "Seraphon":           { color: "#f08a24", on: "#1f1002", symbol: `<path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="currentColor"/>` },
  "Idoneth Deepkin":    { color: "#2aa6b8", on: "#021417", symbol: `<path d="M12 1C8 7 5 11 5 15a7 7 0 0 0 14 0c0-4-3-8-7-14z" fill="currentColor"/><path d="M7.5 15c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0" stroke="#14110f" stroke-width="1.6" fill="none"/>` },
  "Skaven":           { color: "#2f8a52", on: "#ffffff", symbol: `<path d="M3 2c0 6 3 9 9 9s9-3 9-9c-1 4-4 6-9 6S4 6 3 2z" fill="currentColor"/><path d="M12 10l4.5 12h-9z" fill="currentColor"/>` },
};
const themeOf = (army) => THEMES[army.name] || { color: "#d4a73c", on: "#1a1408", symbol: "" };
const symbolSvg = (army, size = 24) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${themeOf(army).symbol}</svg>`;
