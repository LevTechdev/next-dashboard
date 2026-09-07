/**
 * Code 128-B Barcode Generator (Pure TypeScript / Zero Dependencies)
 * Generates crisp vector SVG and data URLs conforming to GS1-128 / Code 128 standard.
 */

// Code 128 pattern table: 107 symbols. Each pattern is a series of bar/space widths (sum = 11 modules).
const CODE128_PATTERNS: number[] = [
  0x6cc,
  0x66c,
  0x666,
  0x498,
  0x48c,
  0x44c,
  0x4c8,
  0x4c4,
  0x464,
  0x648, // 0-9
  0x644,
  0x624,
  0x59c,
  0x4dc,
  0x4ce,
  0x5cc,
  0x4ec,
  0x4e6,
  0x672,
  0x65c, // 10-19
  0x64e,
  0x6e4,
  0x674,
  0x76e,
  0x74c,
  0x72c,
  0x726,
  0x764,
  0x734,
  0x72e, // 20-29
  0x6cc,
  0x6ac,
  0x6a6,
  0x438,
  0x42c,
  0x426,
  0x42e,
  0x41c,
  0x416,
  0x618, // 30-39
  0x614,
  0x60c,
  0x5b8,
  0x4f8,
  0x4f4,
  0x5b4,
  0x4f2,
  0x4ee,
  0x71c,
  0x716, // 40-49
  0x638,
  0x634,
  0x632,
  0x61c,
  0x616,
  0x60e,
  0x70c,
  0x706,
  0x5e8,
  0x4f6, // 50-59
  0x778,
  0x774,
  0x772,
  0x5a8,
  0x5a4,
  0x598,
  0x58c,
  0x4ac,
  0x4a6,
  0x468, // 60-69
  0x462,
  0x434,
  0x432,
  0x428,
  0x424,
  0x422,
  0x628,
  0x622,
  0x5a2,
  0x592, // 70-79
  0x586,
  0x4a2,
  0x466,
  0x42e,
  0x62e,
  0x58e,
  0x728,
  0x724,
  0x722,
  0x718, // 80-89
  0x714,
  0x712,
  0x708,
  0x704,
  0x702,
  0x77a,
  0x75c,
  0x74e,
  0x744,
  0x732, // 90-99
  0x72a,
  0x728,
  0x726,
  0x70e,
  0x6be,
  0x6b6,
  0x776, // 100-106 (104=Start B)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes an ASCII string into Code 128B module array (1s for black bars, 0s for white spaces).
 */
export function encodeCode128B(text: string): number[] {
  const codes: number[] = [START_CODE_B];
  let checkSum = START_CODE_B;

  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const codeVal = charCode - 32;
    if (codeVal < 0 || codeVal > 95) {
      // Fallback for non-printable characters to space
      codes.push(0);
      checkSum += 0 * (i + 1);
    } else {
      codes.push(codeVal);
      checkSum += codeVal * (i + 1);
    }
  }

  const checkDigit = checkSum % 103;
  codes.push(checkDigit);
  codes.push(STOP_CODE);

  // Convert codes into 1/0 bit array
  const modules: number[] = [];
  // 10 quiet modules at start
  for (let q = 0; q < 10; q++) modules.push(0);

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const pattern = CODE128_PATTERNS[code] || 0;
    const isStop = i === codes.length - 1;
    const bitCount = isStop ? 13 : 11;

    for (let b = bitCount - 1; b >= 0; b--) {
      modules.push((pattern >> b) & 1);
    }
  }

  // 10 quiet modules at end
  for (let q = 0; q < 10; q++) modules.push(0);

  return modules;
}

export interface BarcodeOptions {
  height?: number;
  moduleWidth?: number;
  color?: string;
  bgColor?: string;
  showText?: boolean;
  fontSize?: number;
  margin?: number;
}

/**
 * Generates an SVG string representation of the Code 128-B barcode.
 */
export function generateBarcodeSvg(text: string, options: BarcodeOptions = {}): string {
  const {
    height = 50,
    moduleWidth = 2,
    color = "#18181b",
    bgColor = "transparent",
    showText = true,
    fontSize = 11,
    margin = 8,
  } = options;

  const modules = encodeCode128B(text);
  const totalWidth = modules.length * moduleWidth + margin * 2;
  const textHeight = showText ? fontSize + 4 : 0;
  const totalHeight = height + textHeight + margin * 2;

  let rects = "";
  let barStart: number | null = null;

  for (let i = 0; i < modules.length; i++) {
    const isBar = modules[i] === 1;
    if (isBar) {
      if (barStart === null) barStart = i;
    } else {
      if (barStart !== null) {
        const x = margin + barStart * moduleWidth;
        const w = (i - barStart) * moduleWidth;
        rects += `<rect x="${x}" y="${margin}" width="${w}" height="${height}" fill="${color}" />`;
        barStart = null;
      }
    }
  }

  if (barStart !== null) {
    const x = margin + barStart * moduleWidth;
    const w = (modules.length - barStart) * moduleWidth;
    rects += `<rect x="${x}" y="${margin}" width="${w}" height="${height}" fill="${color}" />`;
  }

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${margin + height + fontSize + 2}" font-family="monospace, sans-serif" font-size="${fontSize}" font-weight="600" text-anchor="middle" fill="${color}" letter-spacing="2">${text}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  ${bgColor !== "transparent" ? `<rect width="${totalWidth}" height="${totalHeight}" fill="${bgColor}" />` : ""}
  ${rects}
  ${textElement}
</svg>`;
}

/**
 * Generates a data URL representation of the barcode SVG.
 */
export function generateBarcodeDataUrl(text: string, options: BarcodeOptions = {}): string {
  const svg = generateBarcodeSvg(text, options);
  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}
