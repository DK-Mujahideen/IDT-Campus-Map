import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Compass,
  Navigation,
  Send,
  User,
} from 'lucide-react';
import { useCampus } from '../context/CampusContext';
import { postJsonSafely } from '../utils/safeFetchJson';

interface MessageItem {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const STARTER_PROMPTS = [
  'Where is the AI & Data Science Computing Lab located?',
  'How do I walk from Main Campus Gate to Central Digital Library?',
  'Which classrooms or laboratories are currently available?',
  'Where is the Training & Placement Cell and what are its hours?',
];

export function AssistantPage() {
  const {
    campusInfo,
    buildings,
    locations,
    mapNodes,
    routes,
    roomStatuses,
    setActivePage,
  } = useCampus();

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello. I am the MSAJCE Smart Campus Assistant. Ask me to locate classrooms, departments, labs, or explain walking directions across campus. All answers are strictly grounded in the current campus directory (currently loaded with editable demonstration records).',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const campusContextPayload = useMemo(() => {
    const buildingNameMap = new Map(buildings.map((b) => [b.id, `${b.name} (${b.code})`]));
    const statusMap = new Map(roomStatuses.map((r) => [r.locationId, r.status]));
    const nodeLabelMap = new Map(mapNodes.map((n) => [n.id, n.label]));

    return {
      campusInfo: {
        campusName: campusInfo.campusName,
        locationText: campusInfo.locationText,
        dataNotice: campusInfo.dataNotice,
        announcement: campusInfo.announcement,
      },
      buildings: buildings.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.name,
        shortName: b.shortName,
        category: b.category,
        floors: b.floors,
        description: b.description,
        hours: b.hours,
        accessible: b.accessible,
        isDemo: b.isDemo,
      })),
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        buildingId: l.buildingId,
        buildingName: buildingNameMap.get(l.buildingId) ?? l.buildingId,
        floor: l.floor,
        roomNumber: l.roomNumber,
        category: l.category,
        department: l.department,
        capacity: l.capacity,
        hours: l.hours,
        description: l.description,
        status: statusMap.get(l.id) ?? 'not tracked',
        isDemo: l.isDemo,
      })),
      sampleRoutes: routes.map((r) => ({
        fromLabel: nodeLabelMap.get(r.fromNodeId) ?? r.fromNodeId,
        toLabel: nodeLabelMap.get(r.toNodeId) ?? r.toNodeId,
        distanceMeters: r.distanceMeters,
        pathLabel: r.pathLabel,
      })),
    };
  }, [campusInfo, buildings, locations, mapNodes, routes, roomStatuses]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: MessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    try {
      const historyPayload = nextMessages
        .filter((m) => m.id !== 'welcome')
        .slice(0, -1)
        .map((m) => ({ role: m.role, text: m.text }));

      const data = await postJsonSafely<{ reply?: string }>(
        '/api/assistant',
        {
          message: trimmed,
          history: historyPayload,
          campusContext: campusContextPayload,
        },
        'Assistant service returned an error.'
      );

      if (!data.reply) {
        throw new Error('Assistant service returned an empty response.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: data.reply!,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reach the AI Campus Assistant right now.'
      );
    } finally {
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Chat Panel */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[640px] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-900 text-white flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Smart Campus AI Assistant
              </h2>
              <p className="text-xs text-slate-500">
                Grounded in live campus directory &amp; footpath data · Never fabricates unknown
                rooms
              </p>
            </div>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-blue-900 border border-slate-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>

              <div
                className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-900 text-white'
                    : 'bg-slate-50 border border-slate-200 text-slate-800'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-blue-900 border border-slate-200 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
                Searching campus directory and calculating directions...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-t border-slate-200 bg-slate-50/70 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder="Ask about a classroom, lab, department, availability, or route..."
            className="flex-1 px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-900 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
      </div>

      {/* Right Context & Starter Questions */}
      <div className="lg:col-span-4 space-y-5">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Suggested Questions
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Click a prompt below to query the Gemini campus assistant using the active directory.
          </p>
          <div className="space-y-2 pt-1">
            {STARTER_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => void sendMessage(q)}
                className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-3">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Visual Map &amp; Route Tools
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Need to inspect a building footprint or draw a walking path? Jump directly to the
            interactive views.
          </p>
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setActivePage('map')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Compass className="w-3.5 h-3.5 text-blue-700" />
              Campus Map
            </button>
            <button
              type="button"
              onClick={() => setActivePage('navigation')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
            >
              <Navigation className="w-3.5 h-3.5" />
              Route Planner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
