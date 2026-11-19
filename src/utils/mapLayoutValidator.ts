import type { MapLayoutFormat, MapLayoutSubmission } from '../types/campus';

export interface LayoutAuditCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  detail: string;
}

export interface ParsedJsonBuilding {
  code: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floors?: number;
  category?: string;
}

export interface ParsedJsonWalkway {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label?: string;
}

export interface ParsedJsonLandmark {
  label: string;
  x: number;
  y: number;
}

export interface ParsedAiAnalysis {
  isCampusOrFloorMap: boolean;
  legitimacyAssessment: string;
  warnings: string[];
  sourceImageName?: string;
  analyzedAt?: string;
}

export interface MapLayoutAuditReport {
  checks: LayoutAuditCheck[];
  hasSecurityWarnings: boolean;
  isStructurallyValid: boolean;
  buildingCount: number;
  dimensionsLabel: string;
  parsedJsonBuildings: ParsedJsonBuilding[];
  parsedJsonWalkways: ParsedJsonWalkway[];
  parsedJsonLandmarks: ParsedJsonLandmark[];
  aiAnalysis: ParsedAiAnalysis | null;
  riskSummary: 'clean' | 'review_recommended' | 'flagged';
}

export interface SampleMapTemplate {
  id: string;
  label: string;
  badgeText: string;
  title: string;
  description: string;
  sourceReference: string;
  fileName: string;
  format: MapLayoutFormat;
  floorScope: string;
  layoutContent: string;
}

export const MAX_LAYOUT_CONTENT_CHARS = 100000;

export async function computeSha256Hex(input: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(input);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback deterministic hex hash below
  }

  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}${part1}${part2}`;
}

export function analyzeMapLayout(
  content: string,
  format: MapLayoutFormat,
  fileName: string
): MapLayoutAuditReport {
  const trimmed = content.trim();
  const checks: LayoutAuditCheck[] = [];
  let hasSecurityWarnings = false;
  let buildingCount = 0;
  let dimensionsLabel = 'Not declared';
  let parsedJsonBuildings: ParsedJsonBuilding[] = [];
  let parsedJsonWalkways: ParsedJsonWalkway[] = [];
  let parsedJsonLandmarks: ParsedJsonLandmark[] = [];
  let aiAnalysis: ParsedAiAnalysis | null = null;

  // 1. Payload size & format check
  const sizeWithinLimit = trimmed.length >= 10 && trimmed.length <= MAX_LAYOUT_CONTENT_CHARS;
  checks.push({
    id: 'size',
    label: 'Payload Size & Format Bounds',
    passed: sizeWithinLimit,
    severity: 'critical',
    detail: sizeWithinLimit
      ? `${(trimmed.length / 1024).toFixed(1)} KB (${format.toUpperCase()}) within 100 KB storage ceiling.`
      : `Payload is ${trimmed.length.toLocaleString()} chars (must be between 10 and 100,000 chars).`,
  });

  // 2. Security & active content scan
  const unsafePatterns: Array<{ name: string; regex: RegExp }> = [
    { name: '<script> element', regex: /<script[\s>]/i },
    { name: 'Inline JS event handler (on*=)', regex: /\son[a-z]+\s*=/i },
    { name: 'javascript: URI', regex: /javascript\s*:/i },
    { name: '<foreignObject> / embedded HTML', regex: /<(foreignObject|iframe|object|embed)[\s>]/i },
    { name: 'External remote URL reference', regex: /(xlink:href|href|src)\s*=\s*["']https?:\/\//i },
  ];

  const foundThreats = unsafePatterns
    .filter((p) => p.regex.test(trimmed))
    .map((p) => p.name);

  if (foundThreats.length > 0) {
    hasSecurityWarnings = true;
  }

  checks.push({
    id: 'security',
    label: 'Active Script & Injection Scan',
    passed: foundThreats.length === 0,
    severity: 'critical',
    detail:
      foundThreats.length === 0
        ? 'No executable scripts, inline event handlers, foreignObject tags, or external remote links detected.'
        : `Flagged unsafe constructs: ${foundThreats.join(', ')}.`,
  });

  // 3. Format-specific structural & coordinate integrity
  if (format === 'svg') {
    const hasSvgRoot = /<svg[\s>]/i.test(trimmed) && /<\/svg>/i.test(trimmed);
    const viewBoxMatch = trimmed.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    const widthMatch = trimmed.match(/\bwidth\s*=\s*["']([^"']+)["']/i);
    const heightMatch = trimmed.match(/\bheight\s*=\s*["']([^"']+)["']/i);

    if (viewBoxMatch) {
      dimensionsLabel = `viewBox ${viewBoxMatch[1]}`;
    } else if (widthMatch && heightMatch) {
      dimensionsLabel = `${widthMatch[1]} × ${heightMatch[1]}`;
    }

    const rectCount = (trimmed.match(/<rect\b/gi) ?? []).length;
    const polyCount = (trimmed.match(/<polygon\b/gi) ?? []).length;
    const dataBlockCount = (trimmed.match(/data-building=/gi) ?? []).length;
    buildingCount = dataBlockCount > 0 ? dataBlockCount : Math.max(0, Math.min(200, rectCount + polyCount));

    const hasGeometry = hasSvgRoot && Boolean(viewBoxMatch) && buildingCount >= 1;
    checks.push({
      id: 'geometry',
      label: 'SVG ViewBox & Vector Geometry',
      passed: hasGeometry,
      severity: 'critical',
      detail: hasGeometry
        ? `Valid <svg> root with ${dimensionsLabel} and ${buildingCount} mapped vector blocks.`
        : !hasSvgRoot
        ? 'Missing valid <svg>...</svg> root wrapper.'
        : !viewBoxMatch
        ? 'Missing explicit viewBox attribute required for scale-accurate zooming.'
        : 'No vector building footprints (<rect> or <polygon>) detected.',
    });

    const hasLabels = /<text[\s>]/i.test(trimmed);
    const hasCampusReference = /msajce|siruseri|campus|block|gate|library|lab|admin/i.test(trimmed);
    checks.push({
      id: 'metadata',
      label: 'Institutional Labels & Legend Check',
      passed: hasLabels && hasCampusReference,
      severity: 'warning',
      detail:
        hasLabels && hasCampusReference
          ? 'Contains readable text annotations referencing campus blocks or landmarks.'
          : 'Missing readable campus block labels or MSAJCE / Siruseri institutional identifiers.',
    });
  } else {
    let jsonValid = false;
    let coordValid = false;
    let jsonDetail = 'Invalid JSON syntax.';

    try {
      const parsed = JSON.parse(trimmed) as {
        campusName?: string;
        sourceImageName?: string;
        viewBox?: { width?: number; height?: number };
        aiAnalysis?: {
          isCampusOrFloorMap?: boolean;
          legitimacyAssessment?: string;
          warnings?: string[];
          analyzedAt?: string;
        };
        buildings?: Array<Record<string, unknown>>;
        walkways?: Array<Record<string, unknown>>;
        landmarks?: Array<Record<string, unknown>>;
      };

      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.buildings)) {
        jsonValid = true;
        if (parsed.viewBox?.width && parsed.viewBox?.height) {
          dimensionsLabel = `${parsed.viewBox.width} × ${parsed.viewBox.height} units`;
        } else {
          dimensionsLabel = '1000 × 660 default canvas';
        }

        const validItems: ParsedJsonBuilding[] = [];
        for (const item of parsed.buildings) {
          const x = Number(item.x);
          const y = Number(item.y);
          const w = Number(item.width);
          const h = Number(item.height);
          const code = typeof item.code === 'string' ? item.code.trim() : '';
          const name = typeof item.name === 'string' ? item.name.trim() : '';
          if (
            code.length > 0 &&
            name.length > 0 &&
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(w) &&
            Number.isFinite(h) &&
            x >= 0 &&
            x <= 2000 &&
            y >= 0 &&
            y <= 2000 &&
            w >= 20 &&
            w <= 800 &&
            h >= 20 &&
            h <= 800
          ) {
            validItems.push({
              code,
              name,
              x,
              y,
              width: w,
              height: h,
              floors: Number.isFinite(Number(item.floors)) ? Number(item.floors) : 1,
              category: typeof item.category === 'string' ? item.category : 'academic',
            });
          }
        }

        if (Array.isArray(parsed.walkways)) {
          parsedJsonWalkways = parsed.walkways
            .map((w) => ({
              fromX: Number(w.fromX),
              fromY: Number(w.fromY),
              toX: Number(w.toX),
              toY: Number(w.toY),
              label: typeof w.label === 'string' ? w.label : undefined,
            }))
            .filter(
              (w) =>
                Number.isFinite(w.fromX) &&
                Number.isFinite(w.fromY) &&
                Number.isFinite(w.toX) &&
                Number.isFinite(w.toY)
            );
        }

        if (Array.isArray(parsed.landmarks)) {
          parsedJsonLandmarks = parsed.landmarks
            .map((lm) => ({
              label: typeof lm.label === 'string' ? lm.label.trim() : '',
              x: Number(lm.x),
              y: Number(lm.y),
            }))
            .filter(
              (lm) => lm.label.length > 0 && Number.isFinite(lm.x) && Number.isFinite(lm.y)
            );
        }

        if (parsed.aiAnalysis && typeof parsed.aiAnalysis === 'object') {
          aiAnalysis = {
            isCampusOrFloorMap: Boolean(parsed.aiAnalysis.isCampusOrFloorMap),
            legitimacyAssessment:
              typeof parsed.aiAnalysis.legitimacyAssessment === 'string'
                ? parsed.aiAnalysis.legitimacyAssessment
                : '',
            warnings: Array.isArray(parsed.aiAnalysis.warnings)
              ? parsed.aiAnalysis.warnings.filter((w): w is string => typeof w === 'string')
              : [],
            sourceImageName:
              typeof parsed.sourceImageName === 'string' ? parsed.sourceImageName : undefined,
            analyzedAt:
              typeof parsed.aiAnalysis.analyzedAt === 'string'
                ? parsed.aiAnalysis.analyzedAt
                : undefined,
          };

          if (!aiAnalysis.isCampusOrFloorMap) {
            hasSecurityWarnings = true;
          }
        }

        parsedJsonBuildings = validItems;
        buildingCount = validItems.length;
        coordValid = validItems.length > 0 && validItems.length === parsed.buildings.length;
        jsonDetail = coordValid
          ? `Parsed ${validItems.length} building footprints${parsedJsonWalkways.length ? `, ${parsedJsonWalkways.length} walkways` : ''}${parsedJsonLandmarks.length ? `, and ${parsedJsonLandmarks.length} landmarks` : ''} within [0..2000] bounds.`
          : validItems.length === 0
          ? 'No valid building coordinate objects found inside "buildings" array.'
          : `${validItems.length} of ${parsed.buildings.length} building records passed coordinate validation.`;
      } else {
        jsonDetail = 'JSON root must include a "buildings" array of coordinate footprints.';
      }
    } catch {
      jsonDetail = 'Could not parse file as valid JSON.';
    }

    checks.push({
      id: 'geometry',
      label: 'JSON Schema & Coordinate Bounds',
      passed: jsonValid && coordValid,
      severity: 'critical',
      detail: jsonDetail,
    });

    if (aiAnalysis) {
      checks.push({
        id: 'ai_vision',
        label: 'AI Vision Image Legitimacy Check',
        passed: aiAnalysis.isCampusOrFloorMap && aiAnalysis.warnings.length === 0,
        severity: aiAnalysis.isCampusOrFloorMap ? 'warning' : 'critical',
        detail:
          aiAnalysis.legitimacyAssessment +
          (aiAnalysis.warnings.length > 0
            ? ` Warnings: ${aiAnalysis.warnings.join('; ')}`
            : ''),
      });
    } else {
      const hasFilenameExt = fileName.toLowerCase().endsWith('.json');
      checks.push({
        id: 'metadata',
        label: 'File Extension & Institutional Metadata',
        passed: hasFilenameExt && buildingCount >= 1,
        severity: 'warning',
        detail:
          hasFilenameExt && buildingCount >= 1
            ? `File "${fileName}" matches structured campus JSON layout convention.`
            : 'Confirm file extension and institutional metadata before approval.',
      });
    }
  }

  const criticalFailed = checks.some((c) => c.severity === 'critical' && !c.passed);
  const anyWarning = checks.some((c) => c.severity === 'warning' && !c.passed);
  const isStructurallyValid = !criticalFailed;
  const riskSummary: MapLayoutAuditReport['riskSummary'] =
    hasSecurityWarnings || criticalFailed
      ? 'flagged'
      : anyWarning
      ? 'review_recommended'
      : 'clean';

  return {
    checks,
    hasSecurityWarnings,
    isStructurallyValid,
    buildingCount,
    dimensionsLabel,
    parsedJsonBuildings,
    parsedJsonWalkways,
    parsedJsonLandmarks,
    aiAnalysis,
    riskSummary,
  };
}

/**
 * Wraps an uploaded SVG string in a static HTML document intended strictly for
 * an `<iframe sandbox="" />` (no scripts, no same-origin access, no forms).
 */
export function buildSandboxedSvgPreviewDoc(svgContent: string): string {
  const safeStripped = svgContent
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    padding: 12px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    background: #F4F7FB;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
  }
  svg {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    background: #FFFFFF;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
</style>
</head>
<body>${safeStripped}</body>
</html>`;
}

export const SAMPLE_MAP_TEMPLATES: SampleMapTemplate[] = [
  {
    id: 'tpl-legit-svg',
    label: 'Legit Survey SVG (MSAJCE Siruseri Proposal)',
    badgeText: 'Clean Vector SVG',
    title: 'MSAJCE Siruseri East Wing & Academic Quad Survey (SVG)',
    description:
      'Proposed verified architectural site plan showing Administration Block, CSE/IT Academic Blocks, Central Library, R&D Innovation Wing, and OMR Main Gate approach.',
    sourceReference: 'Estate Office CAD Export · Drawing Ref MSAJCE-SITE-2026-R1 (Demo Sample)',
    fileName: 'msajce-siruseri-siteplan-r1.svg',
    format: 'svg',
    floorScope: 'Campus Masterplan',
    layoutContent: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640">
  <rect x="0" y="0" width="1000" height="640" fill="#F8FAFC" />
  <rect x="36" y="32" width="928" height="540" rx="14" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="2" />
  <text x="58" y="64" font-family="sans-serif" font-size="14" font-weight="700" fill="#0F2557">MSAJCE SIRUSERI — PROPOSED CAMPUS SITE LAYOUT (FOR ADMIN VERIFICATION)</text>
  <line x1="120" y1="310" x2="880" y2="310" stroke="#E2E8F0" stroke-width="14" stroke-linecap="round" />
  <line x1="500" y1="110" x2="500" y2="565" stroke="#E2E8F0" stroke-width="14" stroke-linecap="round" />
  <g data-building="ADM">
    <rect x="405" y="425" width="190" height="86" rx="8" fill="#EEF2FF" stroke="#1E3A8A" stroke-width="2" />
    <text x="500" y="466" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#1E1B4B">ADM · Administration Block</text>
    <text x="500" y="486" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">3 Floors · Main Reception</text>
  </g>
  <g data-building="BLK-A">
    <rect x="115" y="135" width="210" height="115" rx="8" fill="#EFF6FF" stroke="#1D4ED8" stroke-width="2" />
    <text x="220" y="188" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#1E3A8A">BLK-A · CSE &amp; IT Block</text>
    <text x="220" y="208" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">4 Floors · Computing Labs</text>
  </g>
  <g data-building="BLK-B">
    <rect x="675" y="135" width="210" height="115" rx="8" fill="#EFF6FF" stroke="#1D4ED8" stroke-width="2" />
    <text x="780" y="188" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#1E3A8A">BLK-B · ECE &amp; EEE Block</text>
    <text x="780" y="208" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">4 Floors · Signal &amp; VLSI</text>
  </g>
  <g data-building="LIB">
    <rect x="405" y="115" width="190" height="96" rx="8" fill="#F0F9FF" stroke="#0369A1" stroke-width="2" />
    <text x="500" y="160" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0C4A6E">LIB · Central Library</text>
    <text x="500" y="180" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">3 Floors · Digital Archive</text>
  </g>
  <g data-building="RND">
    <rect x="115" y="365" width="200" height="96" rx="8" fill="#F0F9FF" stroke="#0369A1" stroke-width="2" />
    <text x="215" y="410" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0C4A6E">LAB-1 · Innovation Wing</text>
    <text x="215" y="430" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">2 Floors · Robotics &amp; IoT</text>
  </g>
  <g data-building="AUD">
    <rect x="685" y="365" width="200" height="96" rx="8" fill="#F8FAFC" stroke="#334155" stroke-width="2" />
    <text x="785" y="410" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#0F172A">AUD · Main Auditorium</text>
    <text x="785" y="430" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">600 Seats · Seminar Hall</text>
  </g>
  <rect x="435" y="556" width="130" height="24" rx="4" fill="#0F2557" />
  <text x="500" y="572" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#FFFFFF">OMR MAIN GATE</text>
  <text x="860" y="612" font-family="monospace" font-size="11" fill="#64748B">N ↑ · SCALE 1:500</text>
</svg>`,
  },
  {
    id: 'tpl-legit-json',
    label: 'Structured JSON Layout (Block Coordinates)',
    badgeText: 'Valid JSON Schema',
    title: 'MSAJCE Ground Floor Block Geometry Export (JSON)',
    description:
      'Structured coordinate file defining 6 verified academic and facility blocks with floor counts and canvas bounding rectangles.',
    sourceReference: 'Campus Facilities Survey · Coordinate Sheet v2.1 (Demo Sample)',
    fileName: 'msajce-blocks-coordinates.json',
    format: 'json',
    floorScope: 'All Floors (Structured)',
    layoutContent: JSON.stringify(
      {
        campusName: 'Mohamed Sathak A.J. College of Engineering & Technology',
        location: 'Siruseri, OMR, Chennai',
        viewBox: { width: 1000, height: 660 },
        buildings: [
          { code: 'ADM', name: 'Administration Block', category: 'admin', floors: 3, x: 400, y: 455, width: 200, height: 85 },
          { code: 'BLK-A', name: 'CSE & IT Academic Block', category: 'academic', floors: 4, x: 105, y: 145, width: 215, height: 110 },
          { code: 'BLK-B', name: 'ECE & EEE Academic Block', category: 'academic', floors: 4, x: 680, y: 145, width: 215, height: 110 },
          { code: 'LIB', name: 'Central Library & Media Center', category: 'facilities', floors: 3, x: 405, y: 105, width: 190, height: 95 },
          { code: 'LAB-1', name: 'AI & Embedded Systems Center', category: 'labs', floors: 2, x: 105, y: 340, width: 205, height: 95 },
          { code: 'AUD', name: 'Main Auditorium & Placement Wing', category: 'facilities', floors: 2, x: 690, y: 340, width: 205, height: 95 },
        ],
      },
      null,
      2
    ),
  },
  {
    id: 'tpl-suspicious-svg',
    label: 'Suspicious / Unverified SVG (Test Rejection Flow)',
    badgeText: 'Triggers Security Flags',
    title: 'Unverified Third-Party Sketch Upload (Test Case)',
    description:
      'Demonstration test submission containing an embedded script tag and missing viewBox dimensions so administrators can test rejecting illegitimate map layouts.',
    sourceReference: 'Unknown external source (Unverified Test)',
    fileName: 'unverified-sketch-test.svg',
    format: 'svg',
    floorScope: 'Unspecified',
    layoutContent: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500">
  <script>alert('unsafe script payload for security scanner testing')</script>
  <rect x="40" y="40" width="220" height="120" fill="#FEE2E2" stroke="#DC2626" stroke-width="2" />
  <rect x="340" y="180" width="180" height="90" fill="#FEF3C7" stroke="#D97706" stroke-width="2" />
</svg>`,
  },
];

export const INITIAL_DEMO_MAP_LAYOUTS: MapLayoutSubmission[] = [
  {
    id: 'demo-layout-msajce-r1',
    title: SAMPLE_MAP_TEMPLATES[0].title,
    description: SAMPLE_MAP_TEMPLATES[0].description,
    sourceReference: SAMPLE_MAP_TEMPLATES[0].sourceReference,
    fileName: SAMPLE_MAP_TEMPLATES[0].fileName,
    format: 'svg',
    fileSizeBytes: SAMPLE_MAP_TEMPLATES[0].layoutContent.length,
    buildingCount: 6,
    floorScope: 'Campus Masterplan',
    layoutContent: SAMPLE_MAP_TEMPLATES[0].layoutContent,
    sha256Hash: 'a94c71b2e4d80f12c9a6e823f7b14d2081c4a9e6f3b02d17c5a18e4f9b03d2e1',
    hasSecurityWarnings: false,
    submittedByUid: 'demo-faculty-survey',
    submittedByName: 'Campus Estate Office (Demo Sample)',
    status: 'pending',
    isActive: false,
    reviewedBy: '',
    reviewNotes: '',
    createdAtLabel: 'Demo queue item · Awaiting admin review',
    isDemoSample: true,
  },
  {
    id: 'demo-layout-suspicious-01',
    title: SAMPLE_MAP_TEMPLATES[2].title,
    description: SAMPLE_MAP_TEMPLATES[2].description,
    sourceReference: SAMPLE_MAP_TEMPLATES[2].sourceReference,
    fileName: SAMPLE_MAP_TEMPLATES[2].fileName,
    format: 'svg',
    fileSizeBytes: SAMPLE_MAP_TEMPLATES[2].layoutContent.length,
    buildingCount: 2,
    floorScope: 'Unspecified',
    layoutContent: SAMPLE_MAP_TEMPLATES[2].layoutContent,
    sha256Hash: 'f4029e81c7b305d21a8e4c9f01237a5b6c4d8e9f1a2b3c4d5e6f7a8b9c0d1e2f',
    hasSecurityWarnings: true,
    submittedByUid: 'demo-external-upload',
    submittedByName: 'External Upload (Demo Test)',
    status: 'pending',
    isActive: false,
    reviewedBy: '',
    reviewNotes: '',
    createdAtLabel: 'Demo queue item · Security flags detected',
    isDemoSample: true,
  },
];
