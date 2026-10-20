import React, { useState } from 'react';
import { Domain, ScenarioCondition, Report } from '../types/simulation';
import { MapPin, ShieldAlert, Radio, AlertTriangle, Eye, Zap, Layers } from 'lucide-react';

interface TacticalMapProps {
  conditions: ScenarioCondition[];
  deliveredReports: Report[];
  onSelectLocation?: (locationName: string) => void;
  selectedLocation?: string;
  isInstructorView?: boolean;
}

export const TacticalMap: React.FC<TacticalMapProps> = ({
  conditions,
  deliveredReports,
  onSelectLocation,
  selectedLocation,
  isInstructorView = false,
}) => {
  const [activeLayer, setActiveLayer] = useState<Domain | 'all'>('all');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Map nodes with coordinates (SVG 800x500 viewport)
  const nodes = [
    {
      id: 'NODE-ALPHA',
      name: 'Staging Area Alpha',
      grid: 'Grid 42-82',
      x: 120,
      y: 380,
      domain: 'land' as Domain,
      type: 'base',
      desc: '3rd Mechanized Logistics staging depot and vehicle marshalling yard.',
      status: 'Secured',
      isVerified: true,
    },
    {
      id: 'NODE-BRIDGE',
      name: 'Bridge Charlie',
      grid: 'Grid 46-84',
      x: 420,
      y: 260,
      domain: 'land' as Domain,
      type: 'chokepoint',
      desc: isInstructorView
        ? 'ACTUAL STATE: Rigged with C4 demolition charges by hostile recon; underdeck compromised (<10T capacity).'
        : conditions.find((c) => c.id === 'COND-01')?.traineePerceivedState || 'Two-lane steel truss crossing over River Kestrel.',
      status: isInstructorView ? 'Rigged / Compromised' : 'Contested Intel',
      isVerified: deliveredReports.some((r) => r.id === 'REP-L-102'),
      isContradicted: deliveredReports.some((r) => r.id === 'REP-L-102') && deliveredReports.some((r) => r.id === 'REP-A-201'),
    },
    {
      id: 'NODE-ECHO',
      name: 'Checkpoint Echo',
      grid: 'Grid 41-83',
      x: 230,
      y: 160,
      domain: 'land' as Domain,
      type: 'waypoint',
      desc: 'Mountain bypass gateway for Route Amber. Narrow unpaved track passing through rocky gorge.',
      status: 'Open (Dense Fog)',
      isVerified: true,
    },
    {
      id: 'NODE-CITADEL',
      name: 'FOB Citadel',
      grid: 'Grid 50-90',
      x: 690,
      y: 110,
      domain: 'joint' as Domain,
      type: 'destination',
      desc: 'Primary Forward Operating Base; awaiting critical ammunition and fuel resupply convoy.',
      status: 'Supplies Depleted (Urgent)',
      isVerified: true,
    },
    {
      id: 'NODE-HOSPITAL',
      name: 'Civilian Hospital',
      grid: 'Grid 44-88',
      x: 580,
      y: 390,
      domain: 'air' as Domain,
      type: 'sanctuary',
      desc: 'Sector Kestrel Regional Hospital (300+ patients). Protected sanctuary under RoE R-01 (5km exclusion radius).',
      status: 'Active Sanctuary (No-Strike)',
      isVerified: true,
    },
    {
      id: 'NODE-RIDGE12',
      name: 'Ridge 12 (EW Jammer)',
      grid: 'Grid 48-81',
      x: 640,
      y: 250,
      domain: 'ew' as Domain,
      type: 'threat',
      desc: isInstructorView
        ? 'ACTUAL STATE: Hostile high-power VHF jammer & GPS spoofer inducing 800m offset drift in Sector 4.'
        : 'Intermittent signal anomalies detected; directional RF emissions reported by SIGINT.',
      status: 'Hostile EW Emitter',
      isVerified: deliveredReports.some((r) => r.id === 'REP-EW-301'),
    },
    {
      id: 'NODE-DELTA',
      name: 'Substation Delta',
      grid: 'Grid 43-86',
      x: 320,
      y: 430,
      domain: 'cyber' as Domain,
      type: 'scada',
      desc: isInstructorView
        ? 'ACTUAL STATE: Zero-day PLC firmware breach; power metrics spoofed to mask transformer overload.'
        : 'Hydro-electric substation powering regional radar and water purification grids.',
      status: 'Telemetry Anomaly',
      isVerified: !deliveredReports.some((r) => r.id === 'REP-CY-401' && r.isIncomplete),
    },
  ];

  const filteredNodes = activeLayer === 'all' ? nodes : nodes.filter((n) => n.domain === activeLayer || n.domain === 'joint');

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Map Header & Layer Filters */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-medium">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sector Kestrel Schematic Grid</span>
          <span className="text-slate-500 font-mono">MGRS 40-80 : 50-90</span>
        </div>

        {/* Domain Layer Selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          {(['all', 'land', 'air', 'cyber', 'ew'] as const).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeLayer === layer
                  ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {layer.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative flex-1 min-h-[340px] bg-[#070d19] overflow-hidden select-none">
        <svg viewBox="0 0 800 500" className="w-full h-full">
          <defs>
            {/* Grid Pattern */}
            <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(51, 65, 85, 0.25)" strokeWidth="0.8" />
            </pattern>
            {/* Jamming Gradient */}
            <radialGradient id="ewJammingCone" cx="80%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(244, 63, 94, 0.35)" />
              <stop offset="60%" stopColor="rgba(244, 63, 94, 0.12)" />
              <stop offset="100%" stopColor="rgba(244, 63, 94, 0)" />
            </radialGradient>
            {/* Hospital Exclusion Zone Gradient */}
            <radialGradient id="hospitalZone" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(14, 165, 233, 0.25)" />
              <stop offset="85%" stopColor="rgba(14, 165, 233, 0.08)" />
              <stop offset="100%" stopColor="rgba(14, 165, 233, 0)" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect width="800" height="500" fill="url(#tacticalGrid)" />

          {/* River Kestrel (Geographic obstacle) */}
          <path
            d="M 280 0 Q 360 140 430 250 T 490 500"
            fill="none"
            stroke="#1e3a5f"
            strokeWidth="32"
            strokeLinecap="round"
          />
          <path
            d="M 280 0 Q 360 140 430 250 T 490 500"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeDasharray="6 4"
            opacity="0.6"
          />
          <text x="310" y="70" fill="#60a5fa" fontSize="10" fontFamily="JetBrains Mono, monospace" opacity="0.6" transform="rotate(35 310 70)">
            RIVER KESTREL (DEEP CANYON)
          </text>

          {/* EW Jamming Cone Layer */}
          {(activeLayer === 'all' || activeLayer === 'ew') && (
            <g>
              <circle cx="640" cy="250" r="140" fill="url(#ewJammingCone)" />
              <circle cx="640" cy="250" r="140" fill="none" stroke="#f43f5e" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
              <text x="540" y="160" fill="#fb7185" fontSize="9" fontFamily="JetBrains Mono, monospace">
                [EW JAMMING CONE - VHF/GPS DRIFT]
              </text>
            </g>
          )}

          {/* Hospital Exclusion Perimeter (5km RoE Rule R-01) */}
          {(activeLayer === 'all' || activeLayer === 'air') && (
            <g>
              <circle cx="580" cy="390" r="85" fill="url(#hospitalZone)" />
              <circle cx="580" cy="390" r="85" fill="none" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="5 3" />
              <text x="510" y="460" fill="#38bdf8" fontSize="9" fontFamily="JetBrains Mono, monospace">
                [ROE 5KM SANCTUARY EXCLUSION]
              </text>
            </g>
          )}

          {/* Route Obsidian: Highway across Bridge Charlie to FOB Citadel */}
          {(activeLayer === 'all' || activeLayer === 'land') && (
            <g>
              <path
                d="M 120 380 L 260 320 L 420 260 L 550 200 L 690 110"
                fill="none"
                stroke="#64748b"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 120 380 L 260 320 L 420 260 L 550 200 L 690 110"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="1.5"
                strokeDasharray="8 6"
              />
              <text x="210" y="325" fill="#94a3b8" fontSize="10" fontFamily="JetBrains Mono, monospace">
                ROUTE OBSIDIAN (PRIMARY HIGHWAY)
              </text>
            </g>
          )}

          {/* Route Amber: Mountain Pass bypass via Checkpoint Echo */}
          {(activeLayer === 'all' || activeLayer === 'land' || activeLayer === 'air') && (
            <g>
              <path
                d="M 120 380 L 170 250 L 230 160 Q 380 90 490 80 L 690 110"
                fill="none"
                stroke="#d97706"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
              <text x="200" y="145" fill="#fbbf24" fontSize="9" fontFamily="JetBrains Mono, monospace">
                ROUTE AMBER (MOUNTAIN PASS / CHECKPOINT ECHO)
              </text>
            </g>
          )}

          {/* Cyber SCADA link from Substation Delta to Citadel */}
          {(activeLayer === 'all' || activeLayer === 'cyber') && (
            <g>
              <path
                d="M 320 430 Q 500 460 620 310 T 690 110"
                fill="none"
                stroke="#a855f7"
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <text x="350" y="445" fill="#c084fc" fontSize="9" fontFamily="JetBrains Mono, monospace">
                SCADA TELEMETRY BUS (SUBSTATION DELTA)
              </text>
            </g>
          )}

          {/* Map Nodes */}
          {filteredNodes.map((node) => {
            const isSelected = selectedLocation === node.name;
            const isHovered = hoveredNode === node.id;

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform duration-150"
                onClick={() => onSelectLocation?.(node.name)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Highlight ring on hover or select */}
                {(isSelected || isHovered) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="22"
                    fill="none"
                    stroke={isSelected ? '#38bdf8' : '#94a3b8'}
                    strokeWidth="1.5"
                    strokeDasharray={isSelected ? undefined : '3 3'}
                  />
                )}

                {/* Node symbol based on type */}
                {node.type === 'destination' ? (
                  <rect x={node.x - 12} y={node.y - 12} width="24" height="24" rx="4" fill="#0284c7" stroke="#38bdf8" strokeWidth="2" />
                ) : node.type === 'threat' ? (
                  <polygon
                    points={`${node.x},${node.y - 14} ${node.x + 12},${node.y + 10} ${node.x - 12},${node.y + 10}`}
                    fill="#e11d48"
                    stroke="#fda4af"
                    strokeWidth="1.5"
                  />
                ) : node.type === 'sanctuary' ? (
                  <circle cx={node.x} cy={node.y} r="12" fill="#059669" stroke="#34d399" strokeWidth="2" />
                ) : node.type === 'chokepoint' ? (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r="11"
                    fill={node.isContradicted ? '#d97706' : '#1e293b'}
                    stroke={node.isContradicted ? '#f59e0b' : '#38bdf8'}
                    strokeWidth="2"
                    strokeDasharray={node.isVerified ? undefined : '3 2'}
                  />
                ) : (
                  <circle cx={node.x} cy={node.y} r="8" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" />
                )}

                {/* Label badge */}
                <text
                  x={node.x}
                  y={node.y + 24}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="Plus Jakarta Sans, sans-serif"
                >
                  {node.name}
                </text>
                <text
                  x={node.x}
                  y={node.y + 35}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {node.grid}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Selected or Hovered Node Detailed Overlay */}
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 max-w-sm bg-slate-950/95 border border-slate-700/80 rounded p-2.5 text-xs text-slate-200 shadow-xl backdrop-blur-sm pointer-events-none">
            {(() => {
              const n = nodes.find((item) => item.id === hoveredNode);
              if (!n) return null;
              return (
                <div>
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="font-semibold text-white">{n.name}</span>
                    <span className="font-mono text-cyan-400">{n.grid}</span>
                  </div>
                  <div className="text-slate-300 mb-1">{n.desc}</div>
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                    <span>Status: <strong className="text-slate-200">{n.status}</strong></span>
                    <span>·</span>
                    <span>Intel: {n.isVerified ? 'Confirmed' : 'Unverified / Discrepant'}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Map Legend */}
        <div className="absolute top-3 right-3 bg-slate-950/90 border border-slate-800 rounded p-2 text-[10px] text-slate-400 font-mono space-y-1 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            <span>Route Obsidian (Highway)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>Route Amber (Bypass Pass)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>Hostile EW Jamming Cone</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Hospital Sanctuary (5km RoE)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
