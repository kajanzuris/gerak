import React from "react";
import { AbsoluteFill, Audio, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";
import { Block } from "./VectorStory";
import type { StoryProps } from "./VectorStory";

// Tema "explainer": latar krem berbintik, header merek, judul 2 tingkat (kecil + besar) yang muncul per kata
// mengikuti suara, blok UI (jendela chat, dialog, folder, perbandingan, pohon) di tengah, maskot di bawah.
// Aktif bila scenes.src.json punya  "style": "explainer".

const { fontFamily: FONT } = loadFont("normal", { weights: ["400", "600", "800"], subsets: ["latin"] });

const C = { bg: "#f3efe6", ink: "#16161a", mute: "#6b665c", red: "#e5252a", blue: "#3b6fd8", green: "#1f9d8a", line: "#e2dccf", soft: "#efeadd" };
const FILE_COL = ["#2aa876", "#3b6fd8", "#7b4fd8", "#e5252a"];

type Pose = React.ComponentProps<typeof Block>["pose"];
type W = { w: string; hl: boolean; a: number; b: number; s: number };
type Row = {
  k: "bubble" | "check" | "input" | "note" | "buttons" | "files";
  text?: string;
  from?: "user" | "bot";
  state?: "done" | "busy" | "todo";
  items?: string[];
  groups?: string[];
  n?: number;
  at?: string | number; // kata (dari title) atau detik relatif awal adegan
};
type Col = { title: string; tone?: string; items: string[] };
type TreeCol = { head: string; mid?: string; tag?: string; low?: string };
type Item = {
  type: "window" | "compare" | "tree" | "files" | "dialog" | "callout" | "list" | "stat" | "image";
  src?: string;
  caption?: string;
  h?: number;
  at?: string | number;
  title?: string;
  tone?: string;
  rows?: Row[];
  items?: string[];
  left?: Col;
  right?: Col;
  cols?: TreeCol[];
  text?: string;
  sub?: string;
  buttons?: string[];
  cta?: string;
  value?: string;
  label?: string;
  n?: number;
  groups?: string[];
};
type Scene = { title: string; start: number; small?: number; pose?: string; mascot?: "left" | "center" | "right"; stage?: Item[] };
type Data = {
  durationInFrames: number;
  brand?: string;
  tag?: string;
  accent?: string;
  char?: string;
  charColor?: string;
  cta?: string;
  words?: W[];
  env?: number[];
  scenes: Scene[];
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

type Cx = { ws: W[]; base: number; t: number; accent: string; name: string };
const Ctx = React.createContext<Cx>({ ws: [], base: 0, t: 0, accent: C.red, name: "" });

// waktu (detik, absolut) kapan sebuah elemen muncul: kata tertentu di title, detik relatif, atau default
const resolveT = (at: string | number | undefined, cx: Cx, fallback: number) => {
  if (typeof at === "number") return cx.base + at;
  if (typeof at === "string") {
    const k = norm(at);
    const h = k ? cx.ws.find((w) => norm(w.w).startsWith(k)) : undefined;
    if (h) return h.a;
  }
  return cx.base + fallback;
};

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 32,
  boxShadow: "0 10px 30px rgba(40,30,10,.10)",
  border: `2px solid ${C.line}`,
  fontFamily: FONT,
  overflow: "hidden",
};

const Appear: React.FC<{ t0: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ t0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = clamp01(spring({ frame: frame - Math.round(t0 * fps), fps, config: { damping: 15, stiffness: 150 } }));
  return (
    <div style={{ opacity: clamp01(s * 1.6), transform: `translateY(${(1 - s) * 40}px) scale(${0.94 + 0.06 * s})`, ...style }}>{children}</div>
  );
};

const Check = () => (
  <svg width={22} height={22} viewBox="0 0 24 24">
    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#fff" strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Arrow = () => (
  <svg width={26} height={26} viewBox="0 0 24 24">
    <path d="M4 12h15M13 6l6 6-6 6" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Trash = () => (
  <svg width={46} height={52} viewBox="0 0 46 52">
    <rect x={6} y={14} width={34} height={34} rx={6} fill={C.red} />
    <rect x={2} y={8} width={42} height={6} rx={3} fill={C.red} />
    <rect x={16} y={2} width={14} height={6} rx={3} fill={C.red} />
    <rect x={14} y={20} width={4} height={22} rx={2} fill="#fff" />
    <rect x={21} y={20} width={4} height={22} rx={2} fill="#fff" />
    <rect x={28} y={20} width={4} height={22} rx={2} fill="#fff" />
  </svg>
);
const FileIcon: React.FC<{ i: number; s?: number }> = ({ i, s = 44 }) => (
  <svg width={s} height={s * 1.2} viewBox="0 0 40 48">
    <rect x={2} y={2} width={36} height={44} rx={7} fill="#fff" stroke={FILE_COL[i % 4]} strokeWidth={3} />
    <rect x={9} y={12} width={22} height={14} rx={3} fill={FILE_COL[i % 4]} opacity={0.85} />
    <rect x={9} y={32} width={14} height={5} rx={2} fill="#d6d0c2" />
  </svg>
);

const Btn: React.FC<{ label: string; main?: boolean }> = ({ label, main }) => {
  const { accent } = React.useContext(Ctx);
  return (
    <div style={{ padding: "14px 32px", borderRadius: 22, fontSize: 28, fontWeight: 800, background: main ? accent : "#e9e4d6", color: main ? "#fff" : C.mute }}>{label}</div>
  );
};

const FilesGrid: React.FC<{ n: number; groups?: string[]; t0: number }> = ({ n, groups, t0 }) => {
  const { t } = React.useContext(Ctx);
  if (groups && groups.length) {
    return (
      <div style={{ display: "flex", gap: 18, justifyContent: "center" }}>
        {groups.map((g, gi) => (
          <div key={g} style={{ flex: 1, border: `3px dashed ${FILE_COL[gi % 4]}`, borderRadius: 20, padding: "14px 10px", textAlign: "center", opacity: clamp01((t - t0 - gi * 0.25) * 3), fontFamily: FONT }}>
            <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
              {[0, 1, 2].map((j) => <FileIcon key={j} i={gi} s={30} />)}
            </div>
            <div style={{ fontWeight: 800, fontSize: 26, color: FILE_COL[gi % 4] }}>{g}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8,1fr)", gap: "10px 6px", justifyItems: "center" }}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ opacity: clamp01((t - t0 - i * 0.02) * 6), transform: `translate(${Math.sin(i * 7.3) * 8}px,${Math.cos(i * 3.1) * 8}px) rotate(${Math.sin(i * 5.7) * 14}deg)` }}>
          <FileIcon i={i} s={42} />
        </div>
      ))}
    </div>
  );
};

const RowView: React.FC<{ r: Row; t0: number }> = ({ r, t0 }) => {
  const { t, accent } = React.useContext(Ctx);
  let body: React.ReactNode = null;
  if (r.k === "bubble") {
    const user = r.from === "user";
    body = (
      <div style={{ display: "flex", justifyContent: user ? "flex-end" : "flex-start", gap: 12, alignItems: "flex-start" }}>
        {!user && (
          <div style={{ width: 46, height: 46, borderRadius: 23, background: "#dfe8ff", color: C.blue, fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>AI</div>
        )}
        <div style={{ maxWidth: "78%", padding: "16px 22px", borderRadius: 24, fontSize: 28, fontWeight: 600, lineHeight: 1.3, background: user ? accent : C.soft, color: user ? "#fff" : C.ink }}>{r.text}</div>
      </div>
    );
  } else if (r.k === "check") {
    const st = r.state || "done";
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#f4f1e8", borderRadius: 18, padding: "12px 18px" }}>
        {st === "done" ? (
          <div style={{ width: 34, height: 34, borderRadius: 17, background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}><Check /></div>
        ) : st === "busy" ? (
          <div style={{ width: 34, height: 34, borderRadius: 17, border: `4px solid ${C.line}`, borderTopColor: C.green, boxSizing: "border-box", transform: `rotate(${t * 540}deg)` }} />
        ) : (
          <div style={{ width: 34, height: 34, borderRadius: 17, border: `4px solid ${C.line}`, boxSizing: "border-box" }} />
        )}
        <div style={{ fontSize: 28, fontWeight: 600 }}>{r.text}</div>
      </div>
    );
  } else if (r.k === "input") {
    const full = r.text || "";
    const n = Math.floor(Math.max(0, t - t0 - 0.25) * 18);
    const cursor = n < full.length || Math.floor(t * 2) % 2 === 0 ? "|" : "";
    body = (
      <div style={{ display: "flex", alignItems: "center", gap: 12, border: `3px solid ${C.green}`, borderRadius: 40, padding: "10px 12px 10px 26px", background: "#fff" }}>
        <div style={{ flex: 1, fontSize: 28, fontWeight: 600, minHeight: 40, display: "flex", alignItems: "center" }}>{full.slice(0, n)}{cursor}</div>
        <div style={{ width: 54, height: 54, borderRadius: 27, background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}><Arrow /></div>
      </div>
    );
  } else if (r.k === "note") {
    body = (
      <div style={{ background: "#fff3cf", border: "2px solid #f1d98a", borderRadius: 22, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 600, flex: 1 }}>{r.text}</div>
        {(r.items || []).map((it, i, a) => <Btn key={i} label={it} main={i === a.length - 1} />)}
      </div>
    );
  } else if (r.k === "buttons") {
    body = (
      <div style={{ display: "flex", gap: 14, justifyContent: "flex-end" }}>
        {(r.items || []).map((it, i, a) => <Btn key={i} label={it} main={i === a.length - 1} />)}
      </div>
    );
  } else if (r.k === "files") {
    body = <FilesGrid n={r.n || 18} groups={r.groups} t0={t0} />;
  }
  return <Appear t0={t0}>{body}</Appear>;
};

const WindowView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => {
  const cx = React.useContext(Ctx);
  const tone = b.tone || C.blue;
  return (
    <Appear t0={t0}>
      <div style={card}>
        <div style={{ background: `${tone}26`, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          {["#ff6159", "#ffbd2e", "#27c93f"].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />)}
          <div style={{ marginLeft: 10, fontWeight: 800, fontSize: 28, color: tone }}>{b.title}</div>
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {(b.rows || []).map((r, i) => <RowView key={i} r={r} t0={resolveT(r.at, cx, (t0 - cx.base) + 0.4 + i * 0.45)} />)}
        </div>
      </div>
    </Appear>
  );
};

const CompareView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => (
  <div style={{ display: "flex", gap: 24, width: "100%" }}>
    {[b.left, b.right].map((c, ci) => {
      if (!c) return null;
      const tone = c.tone || (ci ? C.green : C.blue);
      return (
        <Appear key={ci} t0={t0 + ci * 0.25} style={{ flex: 1 }}>
          <div style={card}>
            <div style={{ background: tone, color: "#fff", fontWeight: 800, fontSize: 30, padding: "16px 0", textAlign: "center", letterSpacing: 1 }}>{c.title}</div>
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {c.items.map((it, k) => (
                <Appear key={k} t0={t0 + ci * 0.25 + 0.4 + k * 0.3}>
                  <div style={{ background: `${tone}22`, borderRadius: 18, padding: "14px 18px", fontSize: 26, fontWeight: 600 }}>{it}</div>
                </Appear>
              ))}
            </div>
          </div>
        </Appear>
      );
    })}
  </div>
);

const TreeView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => (
  <div style={{ display: "flex", gap: 20, width: "100%", fontFamily: FONT }}>
    {(b.cols || []).map((c, i) => (
      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Appear t0={t0 + i * 0.15} style={{ width: "100%" }}>
          <div style={{ ...card, borderRadius: 18, padding: "14px 0", textAlign: "center", fontWeight: 800, fontSize: 28 }}>{c.head}</div>
        </Appear>
        {c.mid ? (
          <>
            <div style={{ width: 3, height: 26, background: C.line }} />
            <Appear t0={t0 + 0.5 + i * 0.15} style={{ width: "100%" }}>
              <div style={{ ...card, borderRadius: 18, border: `3px solid ${C.blue}`, padding: "14px 0", textAlign: "center", fontWeight: 800, fontSize: 28 }}>
                {c.mid}
                {c.tag ? <div style={{ display: "inline-block", marginLeft: 8, background: C.blue, color: "#fff", borderRadius: 12, padding: "2px 12px", fontSize: 20 }}>{c.tag}</div> : null}
              </div>
            </Appear>
          </>
        ) : null}
        {c.low ? (
          <>
            <div style={{ width: 3, height: 26, background: C.line }} />
            <Appear t0={t0 + 1.0 + i * 0.15} style={{ width: "100%" }}>
              <div style={{ ...card, borderRadius: 18, padding: "14px 0", textAlign: "center", fontWeight: 600, fontSize: 26 }}>{c.low}</div>
            </Appear>
          </>
        ) : null}
      </div>
    ))}
  </div>
);

const DialogView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => (
  <Appear t0={t0}>
    <div style={card}>
      <div style={{ background: "#fff3cf", padding: "16px 24px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 20, background: "#f5a623", color: "#fff", fontWeight: 800, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center" }}>!</div>
        <div style={{ fontWeight: 800, fontSize: 28 }}>{b.title}</div>
      </div>
      <div style={{ padding: "30px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 38, fontWeight: 800 }}>{b.text}</div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 20, margin: "26px 0 10px" }}>
          {[0, 1, 2].map((i) => <FileIcon key={i} i={i} s={44} />)}
          <svg width={40} height={24} viewBox="0 0 40 24"><path d="M2 12h32M26 4l8 8-8 8" stroke={C.mute} strokeWidth={3.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <Trash />
        </div>
        {b.sub ? <div style={{ fontSize: 22, color: C.mute }}>{b.sub}</div> : null}
        <div style={{ display: "flex", gap: 18, justifyContent: "center", marginTop: 26 }}>
          {(b.buttons || []).map((x, i, a) => <Btn key={i} label={x} main={i === a.length - 1} />)}
        </div>
      </div>
    </div>
  </Appear>
);

const CalloutView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => {
  const { accent } = React.useContext(Ctx);
  return (
    <Appear t0={t0}>
      <div style={{ ...card, padding: "48px 40px", textAlign: "center", background: "linear-gradient(180deg,#fff,#ffe9d6)" }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: accent, letterSpacing: 1 }}>{b.title}</div>
        {b.sub ? <div style={{ fontSize: 28, color: C.mute, margin: "12px 0 28px" }}>{b.sub}</div> : null}
        {b.cta ? <div style={{ display: "inline-block", background: accent, color: "#fff", borderRadius: 40, padding: "14px 36px", fontWeight: 800, fontSize: 30 }}>{b.cta}</div> : null}
      </div>
    </Appear>
  );
};

const ListView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => {
  const { accent } = React.useContext(Ctx);
  const items = b.items || [];
  return (
    <Appear t0={t0}>
      <div style={card}>
        <div style={{ background: accent, color: "#fff", fontWeight: 800, fontSize: 34, padding: "18px 28px" }}>{b.title}</div>
        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((it, i) => (
            <Appear key={i} t0={t0 + 0.35 + i * 0.3}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, background: "#f7f3ea", borderRadius: 20, padding: "14px 18px" }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: C.green, color: "#fff", fontWeight: 800, fontSize: 26, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ fontSize: 30, fontWeight: 600 }}>{it}</div>
              </div>
            </Appear>
          ))}
          {b.cta ? (
            <Appear t0={t0 + 0.5 + items.length * 0.3}>
              <div style={{ background: C.green, color: "#fff", borderRadius: 40, padding: "16px 0", textAlign: "center", fontWeight: 800, fontSize: 30 }}>{b.cta}</div>
            </Appear>
          ) : null}
        </div>
      </div>
    </Appear>
  );
};

const StatView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => {
  const { t, accent } = React.useContext(Ctx);
  const m = (b.value || "").match(/[\d.,]+/);
  const num = m ? parseFloat(m[0].replace(",", ".")) : NaN;
  const k = clamp01((t - t0) / 1.2);
  const shown = m && !isNaN(num) ? (b.value || "").replace(m[0], String(Math.round(num * k))) : b.value;
  return (
    <Appear t0={t0}>
      <div style={{ ...card, padding: "40px 30px", textAlign: "center" }}>
        <div style={{ fontSize: 190, fontWeight: 800, color: accent, lineHeight: 1 }}>{shown}</div>
        <div style={{ fontSize: 44, fontWeight: 600, marginTop: 12 }}>{b.label}</div>
      </div>
    </Appear>
  );
};

const ImageView: React.FC<{ b: Item; t0: number }> = ({ b, t0 }) => {
  const { t, name } = React.useContext(Ctx);
  const zoom = 1 + 0.06 * clamp01((t - t0) / 6); // zoom pelan supaya gambar diam tidak terasa mati
  return (
    <Appear t0={t0}>
      <div style={{ ...card, padding: 14 }}>
        <div style={{ height: b.h || 640, borderRadius: 22, overflow: "hidden", background: C.soft }}>
          {b.src ? <Img src={staticFile(`${name}/${b.src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})` }} /> : null}
        </div>
        {b.caption ? <div style={{ fontSize: 28, fontWeight: 600, textAlign: "center", margin: "14px 0 4px", color: C.mute }}>{b.caption}</div> : null}
      </div>
    </Appear>
  );
};

const StageItem: React.FC<{ b: Item; i: number }> = ({ b, i }) => {
  const cx = React.useContext(Ctx);
  const t0 = resolveT(b.at, cx, 0.15 + i * 0.35);
  switch (b.type) {
    case "window": return <WindowView b={b} t0={t0} />;
    case "compare": return <CompareView b={b} t0={t0} />;
    case "tree": return <TreeView b={b} t0={t0} />;
    case "dialog": return <DialogView b={b} t0={t0} />;
    case "callout": return <CalloutView b={b} t0={t0} />;
    case "list": return <ListView b={b} t0={t0} />;
    case "stat": return <StatView b={b} t0={t0} />;
    case "image": return <ImageView b={b} t0={t0} />;
    case "files":
      return (
        <Appear t0={t0}>
          <div style={{ ...card, padding: 24 }}>
            {b.title ? <div style={{ fontWeight: 800, fontSize: 28, marginBottom: 14 }}>{b.title}</div> : null}
            <FilesGrid n={b.n || 24} groups={b.groups} t0={t0} />
          </div>
        </Appear>
      );
    default: return null;
  }
};

const Header: React.FC<{ brand: string; tag: string }> = ({ brand, tag }) => (
  <div style={{ position: "absolute", left: 30, right: 30, top: 60, height: 78, borderRadius: 39, background: "#fff", boxShadow: "0 4px 18px rgba(0,0,0,.08)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontWeight: 800, fontSize: 34 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: C.red, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{brand.slice(0, 1)}</div>
      {brand}
    </div>
    {tag ? <div style={{ background: C.ink, color: "#fff", borderRadius: 30, padding: "8px 22px", fontSize: 26, fontWeight: 600 }}>{tag}</div> : null}
  </div>
);

// judul 2 tingkat: `small` kata pertama = baris kecil, sisanya = baris besar; tiap kata muncul saat diucapkan
const Headline: React.FC<{ ws: W[]; small: number }> = ({ ws, small }) => {
  const { accent } = React.useContext(Ctx);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const big = ws.slice(small);
  const bigSize = big.length <= 3 ? 124 : big.length <= 5 ? 100 : big.length <= 8 ? 82 : 68;
  const line = (arr: W[], size: number, weight: number, base: string) => (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${size * 0.28}px`, fontSize: size, fontWeight: weight, lineHeight: 1.15 }}>
      {arr.map((w, i) => {
        const s = clamp01(spring({ frame: frame - Math.round(w.a * fps), fps, config: { damping: 14, stiffness: 200 } }));
        return (
          <span key={i} style={{ display: "inline-block", opacity: s > 0.02 ? clamp01(s * 2) : 0, transform: `translateY(${(1 - s) * 24}px)`, color: w.hl ? accent : base }}>{w.w}</span>
        );
      })}
    </div>
  );
  return (
    <>
      {small > 0 ? line(ws.slice(0, small), 56, 600, C.mute) : null}
      {line(big, bigSize, 800, C.ink)}
    </>
  );
};

const fallbackWords = (title: string, start: number, idx: number): W[] =>
  title.split(" ").filter(Boolean).map((raw, i) => ({ w: raw.replace(/\*/g, ""), hl: raw.includes("*"), a: start + i * 0.25, b: start + i * 0.25 + 0.25, s: idx }));

export const Explainer: React.FC<StoryProps> = ({ name, data: d }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (!d) return null;
  const data = d as unknown as Data;
  const t = frame / fps;
  const accent = data.accent || C.red;

  let idx = 0;
  data.scenes.forEach((s, i) => { if (t >= s.start - 1e-6) idx = i; });
  const sc = data.scenes[idx];
  const prev = idx > 0 ? data.scenes[idx - 1] : undefined;
  const base = sc.start;
  const fromSrt = (data.words || []).filter((w) => w.s === idx);
  const ws = fromSrt.length ? fromSrt : fallbackWords(sc.title, sc.start, idx);

  const talk = data.env ? data.env[Math.min(data.env.length - 1, frame)] : undefined;
  const hasMascot = !!sc.mascot;
  const persist = hasMascot && prev?.mascot === sc.mascot;
  const ent = persist ? 1 : clamp01(spring({ frame: frame - Math.round(base * fps), fps, config: { damping: 14 } }));
  const mx = sc.mascot === "left" ? 250 : sc.mascot === "right" ? 830 : 540;
  const flip = sc.mascot === "right";
  const ctaStart = durationInFrames - Math.round(2 * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, backgroundImage: "radial-gradient(#d9d2c1 2px, transparent 2.5px)", backgroundSize: "36px 36px", fontFamily: FONT, color: C.ink }}>
      <Audio src={staticFile(name + "/mix.wav")} />
      <Ctx.Provider value={{ ws, base, t, accent, name }}>
        <Header brand={data.brand || "Brand"} tag={data.tag || ""} />
        <div style={{ position: "absolute", left: 50, right: 50, top: 190, height: 300, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10, textAlign: "center" }}>
          <Headline key={idx} ws={ws} small={sc.small ?? 0} />
        </div>
        <div key={"st" + idx} style={{ position: "absolute", left: 60, right: 60, top: hasMascot ? 500 : 520, bottom: hasMascot ? 520 : 200, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28 }}>
          {(sc.stage || []).map((b, i) => <StageItem key={i} b={b} i={i} />)}
        </div>
        {hasMascot ? (
          <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
            <g transform={`translate(${mx},${1800 + (1 - ent) * 420}) scale(${flip ? -0.62 : 0.62},0.62)`}>
              <ellipse cx={0} cy={4} rx={100} ry={14} fill="#000" opacity={0.15} />
              <Block pose={(sc.pose || "idle") as Pose} color={data.charColor || "#222"} f={frame} type={data.char} talk={talk} />
            </g>
          </svg>
        ) : null}
      </Ctx.Provider>
      {data.cta && frame >= ctaStart ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 110 }}>
          <div style={{ padding: "22px 52px", borderRadius: 60, background: accent, color: "#fff", fontWeight: 800, fontSize: 46, fontFamily: FONT }}>{data.cta}</div>
        </AbsoluteFill>
      ) : null}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 8, width: `${(frame / durationInFrames) * 100}%`, backgroundColor: accent }} />
    </AbsoluteFill>
  );
};
