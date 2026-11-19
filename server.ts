import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface AssistantRequestBody {
  message?: string;
  history?: ChatTurn[];
  campusContext?: {
    campusInfo?: {
      campusName?: string;
      locationText?: string;
      dataNotice?: string;
      announcement?: string;
    };
    buildings?: Array<{
      id: string;
      code: string;
      name: string;
      shortName: string;
      category: string;
      floors: number;
      description: string;
      hours: string;
      accessible: boolean;
      isDemo: boolean;
    }>;
    locations?: Array<{
      id: string;
      name: string;
      buildingId: string;
      buildingName?: string;
      floor: number;
      roomNumber: string;
      category: string;
      department?: string;
      capacity?: number;
      hours: string;
      description?: string;
      status?: string;
      isDemo: boolean;
    }>;
    sampleRoutes?: Array<{
      fromLabel: string;
      toLabel: string;
      distanceMeters: number;
      pathLabel?: string;
    }>;
  };
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'smart-campus-api' });
  });

  app.post('/api/assistant', async (req: Request, res: Response) => {
    const body = req.body as AssistantRequestBody;
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
      res.status(400).json({ error: 'Please enter a question for the AI Campus Assistant.' });
      return;
    }

    if (message.length > 1000) {
      res.status(400).json({ error: 'Message exceeds the 1000-character limit.' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please check Settings > Secrets for GEMINI_API_KEY.',
      });
      return;
    }

    const campusContext = body.campusContext ?? {};
    const buildingsSummary = (campusContext.buildings ?? [])
      .map(
        (b) =>
          `- [${b.code}] ${b.name} (ID: ${b.id}, Category: ${b.category}, Floors: ${b.floors}, Hours: ${b.hours}, Accessible: ${b.accessible ? 'Yes' : 'No'}, DemoData: ${b.isDemo}): ${b.description}`
      )
      .join('\n');

    const locationsSummary = (campusContext.locations ?? [])
      .map(
        (l) =>
          `- ${l.name} | Room: ${l.roomNumber} | Building: ${l.buildingName ?? l.buildingId} | Floor: ${l.floor} | Category: ${l.category}${l.department ? ` | Dept: ${l.department}` : ''} | Hours: ${l.hours} | Availability: ${l.status ?? 'unknown'}${l.description ? ` | Details: ${l.description}` : ''}`
      )
      .join('\n');

    const routesSummary = (campusContext.sampleRoutes ?? [])
      .map(
        (r) =>
          `- ${r.fromLabel} <-> ${r.toLabel}: ${r.distanceMeters}m${r.pathLabel ? ` via ${r.pathLabel}` : ''}`
      )
      .join('\n');

    const systemInstruction = `You are the Smart Campus AI Assistant for Mohamed Sathak A.J. College of Engineering and Technology (MSAJCE), Siruseri, Chennai.

CRITICAL GROUNDING RULES:
1. You must ONLY answer using the Campus Knowledge Base provided below.
2. NEVER invent, guess, or fabricate room numbers, building names, coordinates, phone numbers, faculty names, or facilities that are not explicitly listed in the knowledge base below.
3. If a user asks about a room, department, or facility not present in the knowledge base, clearly state: "I do not have a record of that room or facility in the current campus directory." and suggest checking with the Administration Office or opening Find a Location.
4. Clearly note when referencing demonstration map entries that the current directory uses editable demonstration campus data until verified MSAJCE records are uploaded by an administrator.
5. Keep answers concise, structured, helpful, and easy to follow for students, faculty, and campus visitors. When giving walking directions, reference the listed buildings, walkways, and distances accurately.

CAMPUS METADATA:
Institution: ${campusContext.campusInfo?.campusName ?? 'Mohamed Sathak A.J. College of Engineering and Technology (MSAJCE)'}
Location: ${campusContext.campusInfo?.locationText ?? 'Siruseri, Chennai'}
Data Notice: ${campusContext.campusInfo?.dataNotice ?? 'Demonstration campus dataset — editable for verified MSAJCE replacement.'}
Announcement: ${campusContext.campusInfo?.announcement ?? 'None'}

BUILDINGS IN DIRECTORY:
${buildingsSummary || 'No buildings loaded.'}

LOCATIONS, ROOMS & FACILITIES IN DIRECTORY:
${locationsSummary || 'No locations loaded.'}

CAMPUS WALKWAY CONNECTIONS:
${routesSummary || 'No walkway routes loaded.'}`;

    const history = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .filter(
            (turn): turn is ChatTurn =>
              (turn.role === 'user' || turn.role === 'model') &&
              typeof turn.text === 'string' &&
              turn.text.trim().length > 0
          )
      : [];

    try {
      const contents = [
        ...history.map((turn) => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        {
          role: 'user' as const,
          parts: [{ text: message }],
        },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'The assistant returned an empty response. Please try again.' });
        return;
      }

      res.json({ reply });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to contact Gemini API.';
      console.error('Gemini assistant error:', error);
      res.status(500).json({ error: errMsg });
    }
  });

  app.post('/api/analyze-map-image', async (req: Request, res: Response) => {
    const body = req.body as {
      imageBase64?: string;
      mimeType?: string;
      fileName?: string;
    };

    const rawBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64.trim() : '';
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
    const fileName =
      typeof body?.fileName === 'string' && body.fileName.trim()
        ? body.fileName.trim().slice(0, 120)
        : 'uploaded-map.png';

    const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    if (!rawBase64 || !allowedMimeTypes.has(mimeType)) {
      res.status(400).json({
        error: 'Please upload a valid PNG, JPEG, or WebP map image.',
      });
      return;
    }

    const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    if (cleanBase64.length > 9_000_000) {
      res.status(400).json({
        error: 'Image payload is too large. Please choose an image under 6 MB.',
      });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
      res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please check Settings > Secrets for GEMINI_API_KEY.',
      });
      return;
    }

    const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

    const extractionPrompt = `Analyze this uploaded image for the Smart Campus navigation platform (Mohamed Sathak A.J. College of Engineering and Technology, Siruseri, Chennai).

Tasks:
1. Determine objectively whether the image is actually a campus map, site plan, architectural masterplan, or building floor plan (set isCampusOrFloorMap = true or false). If it is an unrelated photo (e.g. selfie, food, landscape, random object, meme), set isCampusOrFloorMap = false and explain why in legitimacyAssessment and warnings.
2. Extract a clean structured 2D vector layout mapped onto a 1000 x 660 coordinate canvas (keep all rectangles within x: 40..880, y: 40..540, width: 65..320, height: 48..220 without overlapping unreadable text).
3. For every visible building, wing, block, room, courtyard, or major structure on the map/floorplan, output a building entry with:
   - code: short concise label (max 12 chars, e.g. "ADM", "BLK-A", "LIB", "LAB-1", "R-101")
   - name: readable name observed in the image (do not invent specific room numbers that are not visible; if unlabeled on a real blueprint, label transparently as "West Wing Block", "North Academic Wing", etc.)
   - category: one of "academic", "labs", "admin", "facilities", "sports"
   - floors: estimated integer 1..6 (default 1 if single-floor plan)
   - x, y, width, height positioned to accurately reflect the spatial layout shown in the image.
4. Extract primary visible walkways/roads/corridors as line segments (fromX, fromY, toX, toY within 40..960 and 40..620) and key landmarks (gates, parking, lawns, lakes, entrances).
5. List any objective quality or authenticity warnings (e.g., "Hand-drawn sketch without scale bar", "Unlabeled blocks", "Not a campus map or floor plan", "Blurry text").`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: normalizedMime,
                data: cleanBase64,
              },
            },
            { text: extractionPrompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isCampusOrFloorMap: {
                type: Type.BOOLEAN,
                description:
                  'True if the image depicts a campus map, architectural site plan, or floor plan; false otherwise.',
              },
              legitimacyAssessment: {
                type: Type.STRING,
                description:
                  'Concise 1-2 sentence objective assessment of what the image shows and whether it appears to be a legitimate map layout.',
              },
              detectedTitle: {
                type: Type.STRING,
                description: 'Concise descriptive title for the detected map layout.',
              },
              detectedCampusName: {
                type: Type.STRING,
                description: 'Institution or building name visible on the map, or "Unspecified".',
              },
              floorScope: {
                type: Type.STRING,
                description: 'Scope such as "Campus Masterplan", "Ground Floor", or "Site Blueprint".',
              },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Objective quality, legibility, or authenticity warnings.',
              },
              buildings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    code: { type: Type.STRING },
                    name: { type: Type.STRING },
                    category: {
                      type: Type.STRING,
                      enum: ['academic', 'labs', 'admin', 'facilities', 'sports'],
                    },
                    floors: { type: Type.INTEGER },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    width: { type: Type.NUMBER },
                    height: { type: Type.NUMBER },
                  },
                  required: ['code', 'name', 'category', 'floors', 'x', 'y', 'width', 'height'],
                },
              },
              walkways: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fromX: { type: Type.NUMBER },
                    fromY: { type: Type.NUMBER },
                    toX: { type: Type.NUMBER },
                    toY: { type: Type.NUMBER },
                    label: { type: Type.STRING },
                  },
                  required: ['fromX', 'fromY', 'toX', 'toY'],
                },
              },
              landmarks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                  },
                  required: ['label', 'x', 'y'],
                },
              },
            },
            required: [
              'isCampusOrFloorMap',
              'legitimacyAssessment',
              'detectedTitle',
              'detectedCampusName',
              'floorScope',
              'warnings',
              'buildings',
              'walkways',
              'landmarks',
            ],
          },
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Gemini returned an empty analysis response.' });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        isCampusOrFloorMap?: boolean;
        legitimacyAssessment?: string;
        detectedTitle?: string;
        detectedCampusName?: string;
        floorScope?: string;
        warnings?: string[];
        buildings?: Array<{
          code?: string;
          name?: string;
          category?: string;
          floors?: number;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
        }>;
        walkways?: Array<{
          fromX?: number;
          fromY?: number;
          toX?: number;
          toY?: number;
          label?: string;
        }>;
        landmarks?: Array<{
          label?: string;
          x?: number;
          y?: number;
        }>;
      };

      const allowedCats = new Set(['academic', 'labs', 'admin', 'facilities', 'sports']);
      const clamp = (val: number, min: number, max: number) =>
        Math.round(Math.max(min, Math.min(max, Number.isFinite(val) ? val : min)));

      const sanitizedBuildings = (Array.isArray(parsed.buildings) ? parsed.buildings : [])
        .slice(0, 30)
        .map((b, idx) => {
          const width = clamp(Number(b.width ?? 150), 65, 340);
          const height = clamp(Number(b.height ?? 85), 48, 220);
          const x = clamp(Number(b.x ?? 80 + (idx % 4) * 210), 40, Math.max(40, 960 - width));
          const y = clamp(Number(b.y ?? 80 + Math.floor(idx / 4) * 140), 40, Math.max(40, 610 - height));
          const cat = typeof b.category === 'string' && allowedCats.has(b.category)
            ? b.category
            : 'academic';
          return {
            code: (typeof b.code === 'string' && b.code.trim() ? b.code.trim() : `BLK-${idx + 1}`).slice(0, 14),
            name: (typeof b.name === 'string' && b.name.trim() ? b.name.trim() : `Campus Zone ${idx + 1}`).slice(0, 80),
            category: cat,
            floors: clamp(Number(b.floors ?? 1), 1, 12),
            x,
            y,
            width,
            height,
          };
        });

      const sanitizedWalkways = (Array.isArray(parsed.walkways) ? parsed.walkways : [])
        .slice(0, 40)
        .map((w) => ({
          fromX: clamp(Number(w.fromX ?? 100), 30, 970),
          fromY: clamp(Number(w.fromY ?? 330), 30, 630),
          toX: clamp(Number(w.toX ?? 900), 30, 970),
          toY: clamp(Number(w.toY ?? 330), 30, 630),
          label: typeof w.label === 'string' ? w.label.trim().slice(0, 60) : undefined,
        }));

      const sanitizedLandmarks = (Array.isArray(parsed.landmarks) ? parsed.landmarks : [])
        .slice(0, 20)
        .map((lm) => ({
          label: (typeof lm.label === 'string' && lm.label.trim() ? lm.label.trim() : 'Landmark').slice(0, 50),
          x: clamp(Number(lm.x ?? 500), 45, 955),
          y: clamp(Number(lm.y ?? 580), 45, 625),
        }));

      const sanitizedWarnings = (Array.isArray(parsed.warnings) ? parsed.warnings : [])
        .filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
        .map((w) => w.trim().slice(0, 180))
        .slice(0, 8);

      const isCampusOrFloorMap = Boolean(parsed.isCampusOrFloorMap);
      const legitimacyAssessment =
        typeof parsed.legitimacyAssessment === 'string' && parsed.legitimacyAssessment.trim()
          ? parsed.legitimacyAssessment.trim().slice(0, 400)
          : isCampusOrFloorMap
          ? 'Image appears to depict a structured campus or building layout.'
          : 'Image does not appear to be a valid campus map or architectural floor plan.';

      const detectedTitle =
        typeof parsed.detectedTitle === 'string' && parsed.detectedTitle.trim()
          ? parsed.detectedTitle.trim().slice(0, 110)
          : `AI Extracted Map — ${fileName.replace(/\.[^.]+$/, '')}`;

      const floorScope =
        typeof parsed.floorScope === 'string' && parsed.floorScope.trim()
          ? parsed.floorScope.trim().slice(0, 38)
          : 'Campus Masterplan';

      const detectedCampusName =
        typeof parsed.detectedCampusName === 'string' && parsed.detectedCampusName.trim()
          ? parsed.detectedCampusName.trim().slice(0, 120)
          : 'Unspecified';

      const structuredLayout = {
        campusName: detectedCampusName,
        sourceType: 'ai_image_analysis',
        sourceImageName: fileName,
        viewBox: { width: 1000, height: 660 },
        aiAnalysis: {
          isCampusOrFloorMap,
          legitimacyAssessment,
          warnings: sanitizedWarnings,
          analyzedAt: new Date().toISOString(),
        },
        buildings: sanitizedBuildings,
        walkways: sanitizedWalkways,
        landmarks: sanitizedLandmarks,
      };

      res.json({
        analysis: {
          isCampusOrFloorMap,
          legitimacyAssessment,
          detectedTitle,
          detectedCampusName,
          floorScope,
          warnings: sanitizedWarnings,
          buildingCount: sanitizedBuildings.length,
          walkwayCount: sanitizedWalkways.length,
          landmarkCount: sanitizedLandmarks.length,
        },
        structuredLayoutJson: JSON.stringify(structuredLayout, null, 2),
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to analyze map image.';
      console.error('Gemini map image analysis error:', error);
      res.status(500).json({ error: errMsg });
    }
  });

  // Never allow unknown /api/* routes to fall through to SPA HTML (<!doctype html>)
  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Always return JSON for Express body-parser / payload-size / runtime errors on /api/*
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) {
      next(err);
      return;
    }
    const status =
      typeof err === 'object' &&
      err !== null &&
      'status' in err &&
      typeof (err as { status?: unknown }).status === 'number'
        ? (err as { status: number }).status
        : 500;
    const message =
      status === 413
        ? 'Uploaded payload is too large for server processing. Please choose a smaller image.'
        : err instanceof Error
        ? err.message
        : 'Unexpected server error while processing API request.';
    res.status(status).json({ error: message });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Campus server listening on http://localhost:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
