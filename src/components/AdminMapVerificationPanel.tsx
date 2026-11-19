import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Eye,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import type { MapLayoutStatus, MapLayoutSubmission } from '../types/campus';
import {
  analyzeMapLayout,
  buildSandboxedSvgPreviewDoc,
} from '../utils/mapLayoutValidator';
import { ExtractedLayoutCanvas } from './ExtractedLayoutCanvas';

interface AdminMapVerificationPanelProps {
  onOpenUploadModal: () => void;
  onStatusMessage: (msg: string) => void;
  onErrorMessage: (msg: string) => void;
}

type FilterStatus = 'all' | MapLayoutStatus;

export function AdminMapVerificationPanel({
  onOpenUploadModal,
  onStatusMessage,
  onErrorMessage,
}: AdminMapVerificationPanelProps) {
  const { mapLayouts, reviewMapLayout, setActiveMapLayout, deleteMapLayout } = useCampus();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(mapLayouts[0]?.id ?? null);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [reviewNotes, setReviewNotes] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const filteredLayouts = useMemo(() => {
    if (statusFilter === 'all') return mapLayouts;
    return mapLayouts.filter((l) => l.status === statusFilter);
  }, [mapLayouts, statusFilter]);

  const selectedLayout: MapLayoutSubmission | null = useMemo(() => {
    const exact = filteredLayouts.find((l) => l.id === selectedId);
    return exact ?? filteredLayouts[0] ?? null;
  }, [filteredLayouts, selectedId]);

  useEffect(() => {
    if (selectedLayout) {
      setReviewNotes(selectedLayout.reviewNotes || '');
    }
  }, [selectedLayout?.id]);

  const auditReport = useMemo(() => {
    if (!selectedLayout) return null;
    return analyzeMapLayout(
      selectedLayout.layoutContent,
      selectedLayout.format,
      selectedLayout.fileName
    );
  }, [selectedLayout]);

  const sandboxSrcDoc = useMemo(() => {
    if (!selectedLayout || selectedLayout.format !== 'svg') return '';
    return buildSandboxedSvgPreviewDoc(selectedLayout.layoutContent);
  }, [selectedLayout]);

  const counts = useMemo(
    () => ({
      all: mapLayouts.length,
      pending: mapLayouts.filter((l) => l.status === 'pending').length,
      verified: mapLayouts.filter((l) => l.status === 'verified').length,
      rejected: mapLayouts.filter((l) => l.status === 'rejected').length,
    }),
    [mapLayouts]
  );

  const handleDecision = async (
    decision: 'verified' | 'rejected',
    activateIfVerified = false
  ) => {
    if (!selectedLayout) return;
    if (decision === 'rejected' && reviewNotes.trim().length < 4) {
      onErrorMessage(
        'Please enter a brief rejection reason (at least 4 characters) explaining why the map layout is not legit.'
      );
      return;
    }

    setBusyAction(decision + (activateIfVerified ? '-activate' : ''));
    try {
      const finalNotes =
        reviewNotes.trim() ||
        (decision === 'verified'
          ? 'Verified against institutional geometry and security checks.'
          : 'Rejected during administrator verification.');
      await reviewMapLayout(selectedLayout.id, decision, finalNotes, activateIfVerified);
      onStatusMessage(
        decision === 'verified'
          ? activateIfVerified
            ? `Verified "${selectedLayout.title}" as legit and activated on Campus Map.`
            : `Marked "${selectedLayout.title}" as verified and legitimate.`
          : `Rejected "${selectedLayout.title}" as not legitimate.`
      );
    } catch (err) {
      onErrorMessage(err instanceof Error ? err.message : 'Failed to record verification.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleActive = async (layout: MapLayoutSubmission) => {
    setBusyAction('toggle-active');
    try {
      await setActiveMapLayout(layout.isActive ? null : layout.id);
      onStatusMessage(
        layout.isActive
          ? `Deactivated "${layout.title}" from the live Campus Map overlay.`
          : `Activated verified layout "${layout.title}" on the Campus Map.`
      );
    } catch (err) {
      onErrorMessage(err instanceof Error ? err.message : 'Failed to update active layout.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (layout: MapLayoutSubmission) => {
    setBusyAction('delete');
    try {
      await deleteMapLayout(layout.id);
      onStatusMessage(`Deleted map layout submission "${layout.title}".`);
    } catch (err) {
      onErrorMessage(err instanceof Error ? err.message : 'Failed to delete submission.');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'pending', label: `Pending Review (${counts.pending})` },
              { id: 'verified', label: `Verified (${counts.verified})` },
              { id: 'rejected', label: `Rejected (${counts.rejected})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === item.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenUploadModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0F2557] text-white text-xs font-medium rounded-lg hover:bg-blue-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Map / Image (AI)
        </button>
      </div>

      {filteredLayouts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500 space-y-2">
          <FileCheck2 className="w-7 h-7 mx-auto text-slate-300" />
          <p>No map layout submissions match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Submission Queue */}
          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Uploaded Map Queue ({filteredLayouts.length})
            </div>
            <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
              {filteredLayouts.map((item) => {
                const isSelected = selectedLayout?.id === item.id;
                const statusColor =
                  item.status === 'verified'
                    ? 'text-emerald-700'
                    : item.status === 'rejected'
                    ? 'text-red-700'
                    : 'text-amber-700';

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full text-left px-5 py-4 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 leading-snug">
                        {item.title}
                      </span>
                      <span
                        className={`text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 ${statusColor}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs text-slate-500 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="font-mono text-slate-700 uppercase">{item.format}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.buildingCount} blocks</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[160px]">{item.submittedByName}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      {item.hasSecurityWarnings ? (
                        <span className="inline-flex items-center gap-1 font-medium text-red-700">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                          Security warnings flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                          Clean security scan
                        </span>
                      )}
                      {item.isActive && (
                        <span className="font-semibold text-blue-700">Active on Map</span>
                      )}
                      {item.isDemoSample && (
                        <span className="text-slate-400">Demo Sample</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Verification Workbench */}
          {selectedLayout && auditReport && (
            <div className="xl:col-span-8 space-y-5">
              {/* Preview + Source Inspector Card */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-blue-700 uppercase">
                        {selectedLayout.format}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono truncate">{selectedLayout.fileName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {(selectedLayout.fileSizeBytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                      {selectedLayout.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0 w-fit">
                    <button
                      type="button"
                      onClick={() => setViewMode('preview')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        viewMode === 'preview'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Sandboxed Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('source')}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        viewMode === 'source'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      Source &amp; Hash
                    </button>
                  </div>
                </div>

                {viewMode === 'preview' ? (
                  <div className="bg-[#F4F7FB] p-4 border-b border-slate-200">
                    {selectedLayout.format === 'svg' ? (
                      <div className="space-y-2">
                        <iframe
                          title={`Sandboxed preview of ${selectedLayout.title}`}
                          sandbox=""
                          srcDoc={sandboxSrcDoc}
                          className="w-full h-[340px] rounded-lg border border-slate-200 bg-white"
                        />
                        <p className="text-[11px] text-slate-500">
                          Rendered inside a zero-script sandboxed iframe (scripts and inline event
                          handlers are stripped and blocked during inspection).
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ExtractedLayoutCanvas
                          layoutContent={selectedLayout.layoutContent}
                          fileName={selectedLayout.fileName}
                          title={selectedLayout.title}
                          heightClass="h-[360px]"
                        />
                        <p className="text-[11px] text-slate-500">
                          {auditReport.aiAnalysis
                            ? `Extracted by Gemini AI Vision from "${auditReport.aiAnalysis.sourceImageName || selectedLayout.fileName}" (${auditReport.dimensionsLabel}).`
                            : `Plotted directly from validated JSON coordinate geometry (${auditReport.dimensionsLabel}).`}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 bg-slate-950 text-slate-100 border-b border-slate-200 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                      <span>SHA-256: {selectedLayout.sha256Hash}</span>
                      <span>Dimensions: {auditReport.dimensionsLabel}</span>
                    </div>
                    <pre className="text-xs font-mono leading-relaxed overflow-x-auto max-h-[300px] text-blue-100 whitespace-pre-wrap break-words">
                      {selectedLayout.layoutContent.slice(0, 4000)}
                      {selectedLayout.layoutContent.length > 4000
                        ? '\n... [truncated preview]'
                        : ''}
                    </pre>
                  </div>
                )}

                {/* Submission Metadata & Automated Legitimacy Audit */}
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-slate-500">Submitted By</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {selectedLayout.submittedByName}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500">Declared Source Reference</div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {selectedLayout.sourceReference}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-slate-500">Description</div>
                      <div className="text-slate-700 mt-0.5 leading-relaxed">
                        {selectedLayout.description}
                      </div>
                    </div>
                  </div>

                  {/* AI Vision Image Analysis Summary (when layout was extracted from an uploaded image) */}
                  {auditReport.aiAnalysis && (
                    <div
                      className={`rounded-lg border p-4 text-xs space-y-2 ${
                        auditReport.aiAnalysis.isCampusOrFloorMap
                          ? 'bg-blue-50/50 border-blue-200 text-slate-800'
                          : 'bg-red-50/70 border-red-200 text-red-950'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
                          AI Vision Image Analysis
                          {auditReport.aiAnalysis.sourceImageName && (
                            <span className="font-mono font-normal text-slate-500">
                              · {auditReport.aiAnalysis.sourceImageName}
                            </span>
                          )}
                        </span>
                        <span
                          className={`font-semibold ${
                            auditReport.aiAnalysis.isCampusOrFloorMap
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {auditReport.aiAnalysis.isCampusOrFloorMap
                            ? 'Campus / Floor Map Detected'
                            : 'Flagged: Not a Legitimate Map Image'}
                        </span>
                      </div>

                      <p className="leading-relaxed">
                        {auditReport.aiAnalysis.legitimacyAssessment}
                      </p>

                      {auditReport.aiAnalysis.warnings.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/80 space-y-1 text-[11px] text-amber-900">
                          <div className="font-semibold">AI Authenticity Warnings:</div>
                          {auditReport.aiAnalysis.warnings.map((warning, idx) => (
                            <div key={idx}>· {warning}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Automated Legitimacy Checks */}
                  <div className="pt-5 border-t border-slate-200">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Automated Legitimacy &amp; Safety Audit
                      </h4>
                      <span
                        className={`text-xs font-semibold ${
                          auditReport.riskSummary === 'flagged'
                            ? 'text-red-700'
                            : auditReport.riskSummary === 'review_recommended'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {auditReport.riskSummary === 'flagged'
                          ? 'Flagged — Do Not Approve Without Review'
                          : auditReport.riskSummary === 'review_recommended'
                          ? 'Manual Metadata Review Suggested'
                          : 'All Automated Checks Passed'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                      {auditReport.checks.map((check) => (
                        <div
                          key={check.id}
                          className="px-4 py-3 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {check.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : check.severity === 'critical' ? (
                              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-semibold text-slate-900">{check.label}</div>
                              <div className="text-slate-600 mt-0.5 leading-relaxed">
                                {check.detail}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`font-semibold whitespace-nowrap shrink-0 ${
                              check.passed
                                ? 'text-emerald-700'
                                : check.severity === 'critical'
                                ? 'text-red-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {check.passed ? 'Pass' : 'Flagged'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Administrator Verification Decision */}
                  <div className="pt-5 border-t border-slate-200 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Administrator Legitimacy Decision
                      </h4>
                      {selectedLayout.reviewedBy && (
                        <span className="text-xs text-slate-500">
                          Last reviewed by <span className="font-medium text-slate-800">{selectedLayout.reviewedBy}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="admin-review-notes"
                        className="block text-xs font-medium text-slate-700 mb-1.5"
                      >
                        Verification Notes / Rejection Reason
                      </label>
                      <textarea
                        id="admin-review-notes"
                        rows={2}
                        maxLength={500}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Record why this uploaded map layout is verified as legit or rejected..."
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => void handleDecision('verified', false)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verify as Legit
                        </button>

                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => void handleDecision('verified', true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F2557] text-white text-xs font-medium rounded-lg hover:bg-blue-900 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verify &amp; Activate on Map
                        </button>

                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => void handleDecision('rejected', false)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Reject as Not Legit
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedLayout.status === 'verified' && (
                          <button
                            type="button"
                            disabled={busyAction !== null}
                            onClick={() => void handleToggleActive(selectedLayout)}
                            className="px-3 py-2 text-xs font-medium text-blue-800 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                          >
                            {selectedLayout.isActive ? 'Deactivate Overlay' : 'Set Active'}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => void handleDelete(selectedLayout)}
                          aria-label={`Delete ${selectedLayout.title}`}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
