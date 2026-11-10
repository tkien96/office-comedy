import React from "react";
import { FONT_FAMILY } from "../design/fonts";
import { VIDEO } from "../design/tokens";

// Full-frame (1080x1920) backgrounds drawn in SVG. Static by design: motion
// comes from characters and camera. Optional props allow tiny, frame-driven
// details (clock hands, steam) without randomness.

const O = { stroke: "#2b2118", strokeWidth: 4, strokeLinejoin: "round" as const };

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg
    viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
    width={VIDEO.width}
    height={VIDEO.height}
    style={{ position: "absolute", inset: 0 }}
  >
    {children}
  </svg>
);

const Plant: React.FC<{ x: number; y: number; s?: number }> = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x},${y}) scale(${s})`}>
    <path d="M0,0 C-60,-40 -70,-120 -30,-170 C-20,-110 -10,-60 0,0 Z" fill="#16a34a" {...O} strokeWidth={3} />
    <path d="M0,0 C50,-50 80,-130 40,-190 C20,-120 10,-70 0,0 Z" fill="#22c55e" {...O} strokeWidth={3} />
    <path d="M0,0 C-10,-60 0,-150 10,-210 C20,-140 16,-60 0,0 Z" fill="#15803d" {...O} strokeWidth={3} />
    <path d="M-50,0 L50,0 L38,90 L-38,90 Z" fill="#c2410c" {...O} />
  </g>
);

const WallClock: React.FC<{ x: number; y: number; hour: number; minute: number }> = ({ x, y, hour, minute }) => (
  <g transform={`translate(${x},${y})`}>
    <circle r={62} fill="#ffffff" {...O} strokeWidth={6} />
    {Array.from({ length: 12 }, (_, i) => (
      <line key={i} x1={0} y1={-50} x2={0} y2={-42} stroke="#334155" strokeWidth={4} transform={`rotate(${i * 30})`} />
    ))}
    <line x1={0} y1={0} x2={0} y2={-30} stroke="#1f2937" strokeWidth={7} strokeLinecap="round" transform={`rotate(${(hour % 12) * 30 + minute * 0.5})`} />
    <line x1={0} y1={0} x2={0} y2={-46} stroke="#1f2937" strokeWidth={4} strokeLinecap="round" transform={`rotate(${minute * 6})`} />
    <circle r={6} fill="#ef4444" />
  </g>
);

// ---------------------------------------------------------------------------

export const OfficeBackground: React.FC<{ clockHour?: number; clockMinute?: number }> = ({
  clockHour = 4,
  clockMinute = 55,
}) => (
  <Frame>
    <rect width={1080} height={1920} fill="#e6edf5" />
    {/* ceiling + lights */}
    <rect width={1080} height={120} fill="#f8fafc" />
    {[180, 540, 900].map((x) => (
      <rect key={x} x={x - 110} y={84} width={220} height={22} rx={8} fill="#fef9c3" stroke="#cbd5e1" strokeWidth={3} />
    ))}
    {/* window with city */}
    <g>
      <rect x={90} y={250} width={520} height={470} rx={10} fill="#bae6fd" {...O} strokeWidth={8} />
      <rect x={110} y={540} width={70} height={170} fill="#93c5fd" />
      <rect x={190} y={470} width={90} height={240} fill="#7dd3fc" />
      <rect x={300} y={520} width={80} height={190} fill="#93c5fd" />
      <rect x={400} y={440} width={100} height={270} fill="#60a5fa" />
      <rect x={515} y={560} width={80} height={150} fill="#93c5fd" />
      <circle cx={520} cy={330} r={40} fill="#fde68a" opacity={0.9} />
      <line x1={350} y1={250} x2={350} y2={720} stroke="#2b2118" strokeWidth={8} />
      <line x1={90} y1={485} x2={610} y2={485} stroke="#2b2118" strokeWidth={8} />
    </g>
    {/* clock + poster */}
    <WallClock x={850} y={330} hour={clockHour} minute={clockMinute} />
    <g transform="translate(720,470)">
      <rect width={250} height={190} rx={10} fill="#ffffff" {...O} />
      <text x={125} y={50} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={34} fill="#1e3a8a">
        MỤC TIÊU
      </text>
      <polyline points="30,160 85,120 135,135 215,70" fill="none" stroke="#16a34a" strokeWidth={8} strokeLinecap="round" />
      <path d="M215,70 L192,74 L208,92 Z" fill="#16a34a" />
    </g>
    {/* floor */}
    <rect y={1150} width={1080} height={770} fill="#a8b4c4" />
    <rect y={1150} width={1080} height={10} fill="#8795a8" />
    {/* cubicle partition behind desks */}
    <rect x={0} y={900} width={1080} height={260} fill="#94a3b8" {...O} />
    {[0, 360, 720].map((x) => (
      <rect key={x} x={x + 12} y={914} width={336} height={232} rx={6} fill="#a5b4c8" />
    ))}
    <rect x={0} y={890} width={1080} height={22} fill="#64748b" {...O} />
    {/* sticky notes on partition */}
    <rect x={60} y={940} width={46} height={46} fill="#fde047" transform="rotate(-6 83 963)" />
    <rect x={960} y={950} width={46} height={46} fill="#f9a8d4" transform="rotate(5 983 973)" />
    <Plant x={985} y={800} s={0.9} />
  </Frame>
);

export const MeetingRoomBackground: React.FC = () => (
  <Frame>
    <rect width={1080} height={1920} fill="#eef2f6" />
    <rect width={1080} height={120} fill="#f8fafc" />
    <rect x={0} y={1180} width={1080} height={740} fill="#9aa8b8" />
    {/* glass wall stripes */}
    {[30, 1010].map((x) => (
      <rect key={x} x={x} y={150} width={40} height={1030} fill="#dbeafe" opacity={0.8} />
    ))}
    {/* whiteboard */}
    <g transform="translate(120,250)">
      <rect width={840} height={560} rx={14} fill="#ffffff" {...O} strokeWidth={8} />
      <text x={40} y={80} fontFamily={FONT_FAMILY} fontWeight={800} fontSize={52} fill="#1e3a8a">
        KPI QUÝ 4
      </text>
      {[
        { x: 60, h: 120, c: "#93c5fd" },
        { x: 150, h: 190, c: "#60a5fa" },
        { x: 240, h: 160, c: "#3b82f6" },
        { x: 330, h: 290, c: "#2563eb" },
      ].map((b) => (
        <rect key={b.x} x={b.x} y={490 - b.h} width={66} height={b.h} fill={b.c} {...O} strokeWidth={3} />
      ))}
      <line x1={40} y1={492} x2={440} y2={492} stroke="#334155" strokeWidth={5} />
      {/* process flow */}
      {["Đề xuất", "Duyệt", "Làm", "Báo cáo"].map((s, i) => (
        <g key={s} transform={`translate(500,${120 + i * 100})`}>
          <rect width={290} height={70} rx={14} fill={i === 3 ? "#fee2e2" : "#e0f2fe"} {...O} strokeWidth={3} />
          <text x={145} y={46} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={700} fontSize={32} fill="#0f172a">
            {s}
          </text>
          {i < 3 ? <path d="M145,72 L145,98" stroke="#334155" strokeWidth={5} /> : null}
        </g>
      ))}
      <rect x={300} y={560} width={240} height={22} rx={6} fill="#cbd5e1" {...O} strokeWidth={3} />
    </g>
    {/* chair backs along the wall */}
    {[160, 400, 680, 920].map((x) => (
      <rect key={x} x={x - 80} y={930} width={160} height={250} rx={36} fill="#475569" {...O} />
    ))}
    <Plant x={70} y={1110} s={0.8} />
  </Frame>
);

export const PantryBackground: React.FC<{ steam?: number }> = ({ steam = 0 }) => (
  <Frame>
    <rect width={1080} height={1920} fill="#fdf6e9" />
    {/* backsplash tiles */}
    <g opacity={0.9}>
      {Array.from({ length: 8 }, (_, r) =>
        Array.from({ length: 10 }, (_, c) => (
          <rect key={`${r}-${c}`} x={c * 108} y={600 + r * 56} width={108} height={56} fill={(r + c) % 2 ? "#fef3c7" : "#fde68a"} stroke="#f5deb3" strokeWidth={2} />
        )),
      )}
    </g>
    {/* upper cabinets */}
    <rect x={40} y={180} width={700} height={360} rx={10} fill="#b45309" {...O} strokeWidth={6} />
    {[40, 273, 506].map((x) => (
      <g key={x}>
        <rect x={x + 14} y={196} width={205} height={328} rx={8} fill="#d97706" {...O} strokeWidth={3} />
        <rect x={x + 180} y={340} width={12} height={50} rx={6} fill="#78350f" />
      </g>
    ))}
    {/* notice */}
    <g transform="translate(780,230) rotate(3)">
      <rect width={240} height={170} fill="#ffffff" {...O} />
      <text x={120} y={70} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={800} fontSize={30} fill="#b91c1c">
        Rửa cốc
      </text>
      <text x={120} y={115} textAnchor="middle" fontFamily={FONT_FAMILY} fontWeight={700} fontSize={26} fill="#334155">
        sau khi dùng!
      </text>
    </g>
    {/* fridge */}
    <rect x={790} y={540} width={250} height={830} rx={22} fill="#e2e8f0" {...O} strokeWidth={6} />
    <line x1={790} y1={830} x2={1040} y2={830} stroke="#2b2118" strokeWidth={5} />
    <rect x={810} y={700} width={14} height={90} rx={7} fill="#94a3b8" />
    <rect x={810} y={860} width={14} height={120} rx={7} fill="#94a3b8" />
    {/* counter */}
    <rect x={0} y={1040} width={780} height={34} fill="#e7e5e4" {...O} />
    <rect x={0} y={1074} width={780} height={296} fill="#a16207" {...O} />
    {[0, 260, 520].map((x) => (
      <rect key={x} x={x + 16} y={1090} width={228} height={262} rx={8} fill="#ca8a04" {...O} strokeWidth={3} />
    ))}
    {/* coffee machine */}
    <g transform="translate(110,780)">
      <rect width={200} height={260} rx={18} fill="#334155" {...O} />
      <rect x={30} y={30} width={140} height={60} rx={8} fill="#0f172a" />
      <circle cx={60} cy={60} r={10} fill="#22c55e" />
      <rect x={70} y={150} width={60} height={20} fill="#1f2937" />
      <rect x={72} y={200} width={56} height={56} rx={8} fill="#ffffff" {...O} strokeWidth={3} />
      {steam > 0 ? (
        <path
          d={`M100,${190 - steam * 10} q-14,-20 0,-40 t0,-40`}
          stroke="#cbd5e1"
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          opacity={0.7}
        />
      ) : null}
    </g>
    {/* water dispenser + mugs */}
    <g transform="translate(420,700)">
      <rect x={40} y={0} width={110} height={130} rx={40} fill="#bfdbfe" opacity={0.9} {...O} />
      <rect x={20} y={130} width={150} height={210} rx={10} fill="#f1f5f9" {...O} />
      <rect x={60} y={200} width={20} height={26} fill="#ef4444" />
      <rect x={110} y={200} width={20} height={26} fill="#3b82f6" />
    </g>
    {[640, 700].map((x, i) => (
      <g key={x} transform={`translate(${x},990)`}>
        <rect width={46} height={50} rx={6} fill={i ? "#f97316" : "#3b82f6"} {...O} strokeWidth={3} />
        <path d="M46,12 q18,0 18,14 t-18,14" fill="none" stroke="#2b2118" strokeWidth={4} />
      </g>
    ))}
    {/* floor tiles */}
    {Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => (
        <rect key={`f${r}-${c}`} x={c * 120} y={1370 + r * 60} width={120} height={60} fill={(r + c) % 2 ? "#e7e5e4" : "#d6d3d1"} />
      )),
    )}
  </Frame>
);

// ---------------------------------------------------------------------------
// Foreground pieces (drawn in front of characters).

/** Long office desk spanning the frame. `top` = desk surface y in px. */
export const OfficeDeskRow: React.FC<{ top: number; children?: React.ReactNode }> = ({ top, children }) => (
  <svg
    viewBox={`0 0 ${VIDEO.width} ${VIDEO.height}`}
    width={VIDEO.width}
    height={VIDEO.height}
    style={{ position: "absolute", inset: 0 }}
  >
    <rect x={-10} y={top} width={1100} height={28} fill="#d6b48c" {...O} />
    <rect x={-10} y={top + 28} width={1100} height={170} fill="#b98d5f" {...O} />
    <line x1={540} y1={top + 28} x2={540} y2={top + 198} stroke="#2b2118" strokeWidth={4} />
    <rect x={-10} y={top + 198} width={1100} height={14} fill="#8b6a46" />
    {children}
  </svg>
);

export const DeskMug: React.FC<{ x: number; y: number; color: string }> = ({ x, y, color }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-24} y={-56} width={48} height={56} rx={6} fill={color} {...O} strokeWidth={3} />
    <path d="M24,-44 q18,0 18,14 t-18,14" fill="none" stroke="#2b2118" strokeWidth={4} />
  </g>
);

export const DeskPapers: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <g transform={`translate(${x},${y})`}>
    <rect x={-60} y={-24} width={120} height={24} fill="#ffffff" {...O} strokeWidth={3} />
    <rect x={-54} y={-46} width={110} height={22} fill="#f1f5f9" {...O} strokeWidth={3} transform="rotate(-4)" />
  </g>
);
