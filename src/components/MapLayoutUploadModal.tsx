import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileCode2,
  Image as ImageIcon,
  Loader2,
  LogIn,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import sampleBlueprintImage from '../assets/images/campus_architectural_blueprint_1795062988387.jpg';
import { useCampus } from '../context/CampusContext';
import type { MapLayoutFormat } from '../types/campus';
import {
  analyzeMapLayout,
  MAX_LAYOUT_CONTENT_CHARS,
  SAMPLE_MAP_TEMPLATES,
  type SampleMapTemplate,
} from '../utils/mapLayoutValidator';
import { postJsonSafely } from '../utils/safeFetchJson';
import { ExtractedLayoutCanvas } from './ExtractedLayoutCanvas';

export interface UploadedLayoutPreviewPayload {
  title: string;
  fileName: string;
  format: MapLayoutFormat;
  layoutContent: string;
  status: 'preview' | 'pending';
  sourceImageDataUrl?: string;
  aiAssessment?: string;
  isCampusOrFloorMap?: boolean;
  warnings?: string[];
}

interface ImageAiAnalysisResponse {
  analysis: {
    isCampusOrFloorMap: boolean;
    legitimacyAssessment: string;
    detectedTitle: string;
    detectedCampusName: string;
    floorScope: string;
    warnings: string[];
    buildingCount: number;
    walkwayCount: number;
    landmarkCount: number;
  };
  structuredLayoutJson: string;
}

interface MapLayoutUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: (title: string) => void;
  onPreviewExtracted?: (preview: UploadedLayoutPreviewPayload) => void;
}

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

function isImageFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    IMAGE_MIME_TYPES.has(file.type.toLowerCase()) ||
    IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))
  );
}

async function prepareImageForAnalysis(
  blob: Blob
): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode the selected image file.'));
      el.src = objectUrl;
    });

    const maxDim = 1400;
    let targetW = img.naturalWidth || img.width;
    let targetH = img.naturalHeight || img.height;

    if (targetW > maxDim || targetH > maxDim) {
      const ratio = Math.min(maxDim / targetW, maxDim / targetH);
      targetW = Math.max(1, Math.round(targetW * ratio));
      targetH = Math.max(1, Math.round(targetH * ratio));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser canvas is unavailable for image preprocessing.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const outputMime = 'image/jpeg';
    const dataUrl = canvas.toDataURL(outputMime, 0.82);
    const base64 = dataUrl.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    return { dataUrl, base64, mimeType: outputMime };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function MapLayoutUploadModal({
  open,
  onClose,
  onSubmitted,
  onPreviewExtracted,
}: MapLayoutUploadModalProps) {
  const { user, openAuthPage, submitMapLayout } = useCampus();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [floorScope, setFloorScope] = useState('Campus Masterplan');
  const [fileName, setFileName] = useState('');
  const [format, setFormat] = useState<MapLayoutFormat>('svg');
  const [layoutContent, setLayoutContent] = useState('');

  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadedImageName, setUploadedImageName] = useState<string | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [aiResult, setAiResult] = useState<ImageAiAnalysisResponse['analysis'] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const preScan = useMemo(() => {
    if (!layoutContent.trim()) return null;
    return analyzeMapLayout(layoutContent, format, fileName || `upload.${format}`);
  }, [layoutContent, format, fileName]);

  if (!open) return null;

  const isVerifiedUser = Boolean(user && user.emailVerified);

  const resetFormState = () => {
    setTitle('');
    setDescription('');
    setSourceReference('');
    setFloorScope('Campus Masterplan');
    setFileName('');
    setFormat('svg');
    setLayoutContent('');
    setUploadedImageUrl(null);
    setUploadedImageName(null);
    setAiResult(null);
    setError(null);
    setSuccessMsg(null);
  };

  const runImageAiAnalysis = async (blob: Blob, originalName: string) => {
    setError(null);
    setSuccessMsg(null);
    setAiResult(null);
    setAnalyzingImage(true);
    setUploadedImageName(originalName);

    try {
      const { dataUrl, base64, mimeType } = await prepareImageForAnalysis(blob);
      setUploadedImageUrl(dataUrl);

      const payload = await postJsonSafely<Partial<ImageAiAnalysisResponse>>(
        '/api/analyze-map-image',
        {
          imageBase64: base64,
          mimeType,
          fileName: originalName,
        },
        'Gemini AI could not analyze this map image.'
      );

      if (!payload.analysis || !payload.structuredLayoutJson) {
        throw new Error(
          'Gemini AI returned an incomplete map layout response. Please try another image.'
        );
      }

      const safeBaseName = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const generatedFileName = `${safeBaseName || 'campus-map'}-ai-layout.json`;

      setAiResult(payload.analysis);
      setFormat('json');
      setFileName(generatedFileName);
      setLayoutContent(payload.structuredLayoutJson);
      setTitle(payload.analysis.detectedTitle || `AI Extracted Map — ${safeBaseName}`);
      setFloorScope(payload.analysis.floorScope || 'Campus Masterplan');
      setSourceReference(`AI Vision Extraction from ${originalName}`);
      setDescription(payload.analysis.legitimacyAssessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze map image with AI.');
    } finally {
      setAnalyzingImage(false);
    }
  };

  const processSelectedFile = (file: File) => {
    setError(null);
    setSuccessMsg(null);

    if (isImageFile(file)) {
      if (file.size > 12 * 1024 * 1024) {
        setError('Image exceeds 12 MB. Please select a smaller PNG, JPEG, or WebP image.');
        return;
      }
      void runImageAiAnalysis(file, file.name);
      return;
    }

    const lower = file.name.toLowerCase();
    const detectedFormat: MapLayoutFormat | null = lower.endsWith('.svg')
      ? 'svg'
      : lower.endsWith('.json')
      ? 'json'
      : null;

    if (!detectedFormat) {
      setError(
        'Unsupported file type. Upload a campus map image (.png, .jpg, .webp) or vector layout (.svg, .json).'
      );
      return;
    }

    if (file.size > MAX_LAYOUT_CONTENT_CHARS) {
      setError('SVG/JSON file exceeds the 100 KB limit for map layout verification documents.');
      return;
    }

    setUploadedImageUrl(null);
    setUploadedImageName(null);
    setAiResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setFormat(detectedFormat);
      setFileName(file.name);
      setLayoutContent(text);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(svg|json)$/i, '').replace(/[-_]+/g, ' ').slice(0, 120));
      }
    };
    reader.onerror = () => {
      setError('Could not read the selected file.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleAnalyzeSampleBlueprint = async () => {
    setError(null);
    try {
      const res = await fetch(sampleBlueprintImage);
      if (!res.ok) {
        throw new Error('Could not load the sample campus blueprint image.');
      }
      const blob = await res.blob();
      await runImageAiAnalysis(blob, 'msajce-campus-blueprint-sample.jpg');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load sample campus blueprint image.'
      );
    }
  };

  const applySampleTemplate = (tpl: SampleMapTemplate) => {
    setError(null);
    setSuccessMsg(null);
    setUploadedImageUrl(null);
    setUploadedImageName(null);
    setAiResult(null);
    setTitle(tpl.title);
    setDescription(tpl.description);
    setSourceReference(tpl.sourceReference);
    setFileName(tpl.fileName);
    setFormat(tpl.format);
    setFloorScope(tpl.floorScope);
    setLayoutContent(tpl.layoutContent);
  };

  const handleShowOnCampusMap = () => {
    if (!layoutContent.trim() || !onPreviewExtracted) return;
    onPreviewExtracted({
      title: title.trim() || fileName || 'Uploaded Map Layout',
      fileName: fileName || `campus-layout.${format}`,
      format,
      layoutContent,
      status: 'preview',
      sourceImageDataUrl: uploadedImageUrl ?? undefined,
      aiAssessment: aiResult?.legitimacyAssessment,
      isCampusOrFloorMap: aiResult?.isCampusOrFloorMap,
      warnings: aiResult?.warnings,
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isVerifiedUser) {
      setError('Please sign in with a verified account to submit layouts to the Admin Verification queue.');
      return;
    }

    if (!layoutContent.trim()) {
      setError('Please upload a map image (.png/.jpg/.webp) or an .svg/.json layout first.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitMapLayout({
        title,
        description,
        sourceReference,
        fileName: fileName || `campus-layout.${format}`,
        format,
        floorScope,
        layoutContent,
      });

      onPreviewExtracted?.({
        title: created.title,
        fileName: created.fileName,
        format: created.format,
        layoutContent: created.layoutContent,
        status: 'pending',
        sourceImageDataUrl: uploadedImageUrl ?? undefined,
        aiAssessment: aiResult?.legitimacyAssessment,
        isCampusOrFloorMap: aiResult?.isCampusOrFloorMap,
        warnings: aiResult?.warnings,
      });

      setSuccessMsg(
        `Uploaded "${created.title}" — now visible on the Campus Map and queued for Admin Verification.`
      );
      onSubmitted?.(created.title);
      setTimeout(() => {
        resetFormState();
        onClose();
      }, 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload map layout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-layout-modal-title"
    >
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden my-6">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h2
              id="upload-layout-modal-title"
              className="font-display text-base font-bold text-slate-900"
            >
              Upload Campus Map Image or Layout (AI Analysis)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a PNG, JPG, or WebP map image for Gemini AI layout extraction, or upload an
              SVG/JSON file directly for admin verification.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[82vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Dropzone for Image (AI) + SVG/JSON */}
            <div className="space-y-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/70'
                    : 'border-slate-300 bg-slate-50/70 hover:border-blue-400'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#0F2557] text-white flex items-center justify-center shrink-0">
                      {analyzingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ImageIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {analyzingImage
                          ? `Analyzing "${uploadedImageName}" with Gemini AI...`
                          : 'Drop a Campus Map Image, Blueprint Photo, or SVG / JSON File'}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                        {analyzingImage
                          ? 'Detecting buildings, walkways, landmarks, and verifying map authenticity.'
                          : 'Supports PNG, JPG, WebP images (auto-converted to interactive vector map layout by AI) plus .svg and .json.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={analyzingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F2557] text-white rounded-lg text-xs font-medium hover:bg-blue-900 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Choose Image / File
                    </button>
                    <button
                      type="button"
                      disabled={analyzingImage}
                      onClick={() => void handleAnalyzeSampleBlueprint()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-900 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                      Try Sample Blueprint (AI)
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp,.svg,.json,image/svg+xml,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Vector / JSON Quick Templates */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-[11px] font-medium text-slate-500 mb-2">
                  Or load a vector / coordinate test template for the admin verification queue:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SAMPLE_MAP_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      disabled={analyzingImage}
                      onClick={() => applySampleTemplate(tpl)}
                      className="text-left p-2 rounded-lg border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/40 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="text-xs font-semibold text-slate-900 leading-snug">
                        {tpl.badgeText}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {tpl.fileName}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Side-by-Side AI Image Analysis & Extracted Map Layout Preview */}
            {uploadedImageUrl && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>Gemini AI Map Vision Extraction</span>
                    {uploadedImageName && (
                      <span className="font-mono font-normal text-slate-500">
                        · {uploadedImageName}
                      </span>
                    )}
                  </div>

                  {aiResult && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        aiResult.isCampusOrFloorMap ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {aiResult.isCampusOrFloorMap ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      )}
                      {aiResult.isCampusOrFloorMap
                        ? 'Campus / Floor Map Detected'
                        : 'Flagged: Not a Campus Map'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  {/* Left: Uploaded Source Image + AI Verdict */}
                  <div className="lg:col-span-5 space-y-2.5">
                    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <img
                        src={uploadedImageUrl}
                        alt={uploadedImageName || 'Uploaded campus map image'}
                        className="w-full h-[210px] object-contain bg-slate-100"
                      />
                    </div>

                    {analyzingImage ? (
                      <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-blue-700" />
                        <span>
                          Extracting building footprints, walkways, and landmarks with Gemini AI...
                        </span>
                      </div>
                    ) : aiResult ? (
                      <div
                        className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                          aiResult.isCampusOrFloorMap
                            ? 'bg-white border-slate-200 text-slate-700'
                            : 'bg-red-50 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="font-semibold text-slate-900">
                          AI Assessment ({aiResult.buildingCount} blocks · {aiResult.walkwayCount}{' '}
                          walkways · {aiResult.landmarkCount} landmarks)
                        </div>
                        <p className="leading-relaxed">{aiResult.legitimacyAssessment}</p>
                        {aiResult.warnings.length > 0 && (
                          <div className="pt-1.5 border-t border-slate-200/80 text-[11px] text-amber-800 space-y-0.5">
                            <div className="font-semibold">AI Warnings for Admin Review:</div>
                            {aiResult.warnings.map((w, idx) => (
                              <div key={idx}>· {w}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Right: Extracted Interactive Vector Layout */}
                  <div className="lg:col-span-7">
                    {analyzingImage ? (
                      <div className="h-[296px] rounded-lg border border-slate-200 bg-white flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-700" />
                        <span>Generating interactive vector campus layout...</span>
                      </div>
                    ) : layoutContent ? (
                      <ExtractedLayoutCanvas
                        layoutContent={layoutContent}
                        fileName={fileName || 'ai-extracted-layout.json'}
                        title={title || 'AI Extracted Campus Layout'}
                        heightClass="h-[260px]"
                        compact
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Standalone JSON Preview (when JSON file/template loaded directly without an image) */}
            {!uploadedImageUrl && format === 'json' && layoutContent.trim() && (
              <ExtractedLayoutCanvas
                layoutContent={layoutContent}
                fileName={fileName || 'layout.json'}
                title={title || fileName}
                heightClass="h-[240px]"
                compact
              />
            )}

            {/* Automated Pre-Upload Scan Summary */}
            {preScan && !analyzingImage && (
              <div
                className={`rounded-lg border p-3.5 text-xs space-y-1.5 ${
                  preScan.riskSummary === 'flagged'
                    ? 'bg-red-50/70 border-red-200 text-red-900'
                    : preScan.riskSummary === 'review_recommended'
                    ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {preScan.riskSummary === 'flagged' ? (
                      <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    ) : preScan.riskSummary === 'review_recommended' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    Pre-Upload Verification Scan:{' '}
                    {preScan.riskSummary === 'flagged'
                      ? 'Issues Flagged (Admin will see warnings)'
                      : preScan.riskSummary === 'review_recommended'
                      ? 'Needs Manual Metadata Check'
                      : 'Clean Structure Ready'}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums">
                    {fileName} · {preScan.buildingCount} blocks
                  </span>
                </div>
                <div className="text-[11px] opacity-90">
                  {preScan.checks.map((c) => `${c.passed ? 'Pass' : 'Flag'}: ${c.label}`).join(' · ')}
                </div>
              </div>
            )}

            {/* Metadata Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label
                  htmlFor="layout-title"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Layout Title
                </label>
                <input
                  id="layout-title"
                  type="text"
                  required
                  minLength={3}
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="MSAJCE Siruseri Verified Block Layout 2026"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="layout-source"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Source / Survey Reference
                </label>
                <input
                  id="layout-source"
                  type="text"
                  required
                  minLength={2}
                  maxLength={200}
                  value={sourceReference}
                  onChange={(e) => setSourceReference(e.target.value)}
                  placeholder="Estate Office CAD Export / Blueprint Photo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="layout-scope"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Floor / Area Scope
                </label>
                <input
                  id="layout-scope"
                  type="text"
                  required
                  minLength={2}
                  maxLength={40}
                  value={floorScope}
                  onChange={(e) => setFloorScope(e.target.value)}
                  placeholder="Campus Masterplan / Ground Floor"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="layout-desc"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Submission Notes for Admin Verification
                </label>
                <textarea
                  id="layout-desc"
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what blocks, entrances, or floor changes this layout introduces..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {fileName && (
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="inline-flex items-center gap-2 truncate">
                  <FileCode2 className="w-4 h-4 text-blue-700 shrink-0" />
                  <span className="font-mono truncate">{fileName}</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                  {(layoutContent.length / 1024).toFixed(1)} KB · {format.toUpperCase()}
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {!isVerifiedUser && (
              <div className="p-3.5 rounded-lg bg-blue-50/70 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="text-blue-950 leading-relaxed">
                  You can analyze map images with AI and view the extracted layout on the Campus Map
                  immediately. Sign in with a verified account to submit it to the Cloud Admin
                  Verification queue.
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuthPage('signin');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F2557] text-white font-medium rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In / Sign Up
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex flex-wrap items-center gap-2">
                {onPreviewExtracted && (
                  <button
                    type="button"
                    disabled={analyzingImage || !layoutContent.trim()}
                    onClick={handleShowOnCampusMap}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-[#0F2557] border border-blue-200 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Show Layout on Campus Map
                  </button>
                )}

                {isVerifiedUser && (
                  <button
                    type="submit"
                    disabled={submitting || analyzingImage || !layoutContent.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F2557] text-white text-xs font-medium rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {submitting ? 'Uploading...' : 'Upload & Submit for Admin Review'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
