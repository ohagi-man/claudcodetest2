"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A878", fire: "#F08030", water: "#6890F0", electric: "#F8D030",
  grass: "#78C850", ice: "#98D8D8", fighting: "#C03028", poison: "#A040A0",
  ground: "#E0C068", flying: "#A890F0", psychic: "#F85888", bug: "#A8B820",
  rock: "#B8A038", ghost: "#705898", dragon: "#7038F8", dark: "#705848",
  steel: "#B8B8D0", fairy: "#EE99AC",
};

type PokemonStat = { base_stat: number; stat: { name: string } };
type PokemonType = { slot: number; type: { name: string } };
type PokemonMove = { move: { name: string } };
type Pokemon = {
  id: number;
  name: string;
  stats: PokemonStat[];
  types: PokemonType[];
  moves: PokemonMove[];
  sprites: {
    front_default: string | null;
    back_default: string | null;
    other: { "official-artwork": { front_default: string | null } };
  };
};

type BattlePokemon = { pokemon: Pokemon; currentHp: number; maxHp: number };
type BattlePhase = "idle" | "loading" | "intro" | "battle" | "result";
type LogEntry = { id: number; text: string; type: "info" | "attack" | "damage" };
type AnimState = "idle" | "attack" | "hit" | "faint";

const getStat = (p: Pokemon, name: string) =>
  p.stats.find((s) => s.stat.name === name)?.base_stat ?? 50;

const calcMaxHp = (p: Pokemon) => Math.floor(getStat(p, "hp") * 2 + 60);

const calcDamage = (atk: Pokemon, def: Pokemon) => {
  const a = getStat(atk, "attack");
  const d = getStat(def, "defense");
  return Math.max(1, Math.floor((a / d) * 15 + 5) + Math.floor(Math.random() * 8) - 3);
};

async function fetchRandomPokemon(): Promise<Pokemon> {
  const id = Math.floor(Math.random() * 898) + 1;
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

function HpBar({ current, max }: { current: number; max: number }) {
  const pct = Math.max(0, (current / max) * 100);
  const color = pct > 50 ? "#4ade80" : pct > 20 ? "#facc15" : "#f87171";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 font-mono tabular-nums w-16 text-right">
        {current}/{max}
      </span>
      <div className="w-24 h-2.5 bg-gray-700 rounded-full overflow-hidden border border-gray-600">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function TypeBadge({ name }: { name: string }) {
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-bold text-white uppercase tracking-wide"
      style={{ backgroundColor: TYPE_COLORS[name] ?? "#888" }}
    >
      {name}
    </span>
  );
}

function PokemonSprite({
  src,
  alt,
  anim,
  size,
}: {
  src: string;
  alt: string;
  anim: AnimState;
  size: number;
}) {
  const transform =
    anim === "attack" ? "translateX(18px) scale(1.1)"
    : anim === "hit" ? "translateX(-10px) rotate(-5deg)"
    : anim === "faint" ? "translateY(20px) rotate(-30deg)"
    : "translateX(0) scale(1) rotate(0deg)";
  const filter =
    anim === "hit" ? "brightness(5) saturate(0)"
    : anim === "faint" ? "grayscale(1) opacity(0.4)"
    : "drop-shadow(2px 4px 6px rgba(0,0,0,0.6))";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      style={{
        imageRendering: "pixelated",
        transform,
        filter,
        transition: "transform 0.18s ease, filter 0.18s ease",
        opacity: anim === "faint" ? 0.3 : 1,
      }}
    />
  );
}

export default function PokemonBattle() {
  const [phase, setPhase] = useState<BattlePhase>("idle");
  const [player, setPlayer] = useState<BattlePokemon | null>(null);
  const [enemy, setEnemy] = useState<BattlePokemon | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);
  const [playerAnim, setPlayerAnim] = useState<AnimState>("idle");
  const [enemyAnim, setEnemyAnim] = useState<AnimState>("idle");
  const logRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const cancelRef = useRef(false);

  const addLog = useCallback((text: string, type: LogEntry["type"] = "info") => {
    setLog((prev) => [...prev.slice(-40), { id: ++logIdRef.current, text, type }]);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log]);

  const startBattle = useCallback(async () => {
    cancelRef.current = true;
    setPhase("loading");
    setLog([]);
    setWinner(null);
    setPlayerAnim("idle");
    setEnemyAnim("idle");
    try {
      const [p, e] = await Promise.all([fetchRandomPokemon(), fetchRandomPokemon()]);
      const pb: BattlePokemon = { pokemon: p, currentHp: calcMaxHp(p), maxHp: calcMaxHp(p) };
      const eb: BattlePokemon = { pokemon: e, currentHp: calcMaxHp(e), maxHp: calcMaxHp(e) };
      setPlayer(pb);
      setEnemy(eb);
      cancelRef.current = false;
      setPhase("intro");
    } catch {
      setPhase("idle");
      alert("ポケモンの取得に失敗しました。もう一度お試しください。");
    }
  }, []);

  useEffect(() => {
    if (phase !== "intro") return;
    const t = setTimeout(() => setPhase("battle"), 2200);
    return () => clearTimeout(t);
  }, [phase]);

  // Battle loop — runs once when phase becomes "battle"
  useEffect(() => {
    if (phase !== "battle" || !player || !enemy) return;
    cancelRef.current = false;

    const sleep = (ms: number) =>
      new Promise<void>((res) => {
        const id = setTimeout(res, ms);
        const check = setInterval(() => {
          if (cancelRef.current) { clearTimeout(id); clearInterval(check); res(); }
        }, 50);
        setTimeout(() => clearInterval(check), ms + 100);
      });

    const p = player.pokemon;
    const e = enemy.pokemon;
    let hp1 = player.currentHp;
    let hp2 = enemy.currentHp;
    const pSpeed = getStat(p, "speed");
    const eSpeed = getStat(e, "speed");
    let turn: "player" | "enemy" = pSpeed >= eSpeed ? "player" : "enemy";

    addLog(`バトル開始！`);
    addLog(`${p.name.toUpperCase()} vs ${e.name.toUpperCase()}`);
    if (pSpeed !== eSpeed) {
      addLog(`${turn === "player" ? p.name.toUpperCase() : e.name.toUpperCase()} の先制！`);
    }

    const runBattle = async () => {
      while (hp1 > 0 && hp2 > 0 && !cancelRef.current) {
        await sleep(1100);
        if (cancelRef.current) return;

        if (turn === "player") {
          const move = p.moves[Math.floor(Math.random() * Math.min(4, p.moves.length))];
          const moveName = move?.move.name.replace(/-/g, " ") ?? "tackle";
          addLog(`${p.name.toUpperCase()} の ${moveName}！`, "attack");
          setPlayerAnim("attack");
          await sleep(350);
          if (cancelRef.current) return;
          setPlayerAnim("idle");
          setEnemyAnim("hit");
          const dmg = calcDamage(p, e);
          hp2 = Math.max(0, hp2 - dmg);
          setEnemy((prev) => (prev ? { ...prev, currentHp: hp2 } : prev));
          addLog(`${e.name.toUpperCase()} に ${dmg} ダメージ！`, "damage");
          await sleep(400);
          if (cancelRef.current) return;
          setEnemyAnim(hp2 <= 0 ? "faint" : "idle");
          if (hp2 <= 0) break;
          turn = "enemy";
        } else {
          const move = e.moves[Math.floor(Math.random() * Math.min(4, e.moves.length))];
          const moveName = move?.move.name.replace(/-/g, " ") ?? "tackle";
          addLog(`${e.name.toUpperCase()} の ${moveName}！`, "attack");
          setEnemyAnim("attack");
          await sleep(350);
          if (cancelRef.current) return;
          setEnemyAnim("idle");
          setPlayerAnim("hit");
          const dmg = calcDamage(e, p);
          hp1 = Math.max(0, hp1 - dmg);
          setPlayer((prev) => (prev ? { ...prev, currentHp: hp1 } : prev));
          addLog(`${p.name.toUpperCase()} に ${dmg} ダメージ！`, "damage");
          await sleep(400);
          if (cancelRef.current) return;
          setPlayerAnim(hp1 <= 0 ? "faint" : "idle");
          if (hp1 <= 0) break;
          turn = "player";
        }
      }

      if (!cancelRef.current) {
        await sleep(600);
        if (hp2 <= 0) {
          addLog(`${e.name.toUpperCase()} は たおれた！`);
          setWinner("player");
        } else {
          addLog(`${p.name.toUpperCase()} は たおれた！`);
          setWinner("enemy");
        }
        setPhase("result");
      }
    };

    runBattle();
    return () => { cancelRef.current = true; };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    cancelRef.current = true;
    setPhase("idle");
    setPlayer(null);
    setEnemy(null);
    setLog([]);
    setWinner(null);
    setPlayerAnim("idle");
    setEnemyAnim("idle");
  }, []);

  const showArena = phase === "intro" || phase === "battle" || phase === "result";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 select-none">
      {/* Title */}
      <h1
        className="text-3xl font-black text-white mb-8 tracking-widest uppercase"
        style={{ fontFamily: "monospace", textShadow: "0 0 20px rgba(239,68,68,0.5)" }}
      >
        ⚔ POKEMON BATTLE
      </h1>

      {/* Idle screen */}
      {phase === "idle" && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-gray-400 font-mono text-sm">ランダムポケモンでバトル！</p>
          <button
            onClick={startBattle}
            className="px-14 py-5 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-2xl font-black rounded-2xl shadow-lg shadow-red-900/60 transition-all duration-150 font-mono tracking-widest"
          >
            バトル開始！
          </button>
        </div>
      )}

      {/* Loading */}
      {phase === "loading" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-mono text-sm animate-pulse">ポケモンを選出中...</p>
        </div>
      )}

      {/* Battle screen */}
      {showArena && player && enemy && (
        <div className="w-full max-w-xl flex flex-col gap-3">
          {/* Arena */}
          <div
            className="relative rounded-2xl overflow-hidden h-60 border border-gray-700"
            style={{
              background:
                "linear-gradient(180deg, #0f2347 0%, #1a3a6b 30%, #2d6a22 65%, #3d8a2d 100%)",
            }}
          >
            {/* Stars */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-white opacity-70"
                style={{
                  width: i % 3 === 0 ? 3 : 2,
                  height: i % 3 === 0 ? 3 : 2,
                  top: `${5 + (i * 17) % 40}%`,
                  left: `${(i * 23 + 7) % 100}%`,
                }}
              />
            ))}

            {/* Ground */}
            <div
              className="absolute bottom-0 left-0 right-0 h-12 opacity-30"
              style={{
                background:
                  "repeating-linear-gradient(90deg,rgba(255,255,255,0.3) 0,rgba(255,255,255,0.3) 1px,transparent 1px,transparent 32px)",
              }}
            />

            {/* Enemy info — top left */}
            <div
              className="absolute top-3 left-3 flex flex-col gap-1"
              style={{
                animation: phase === "intro" ? "fadeSlideDown 0.6s ease-out 0.3s both" : undefined,
              }}
            >
              <div className="text-white font-bold text-sm uppercase drop-shadow font-mono">
                {enemy.pokemon.name}
                <span className="text-gray-400 text-xs ml-2">#{enemy.pokemon.id}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {enemy.pokemon.types.map((t) => (
                  <TypeBadge key={t.type.name} name={t.type.name} />
                ))}
              </div>
              <HpBar current={enemy.currentHp} max={enemy.maxHp} />
            </div>

            {/* Enemy sprite — top right */}
            <div
              className="absolute top-3 right-6"
              style={{
                animation: phase === "intro" ? "slideFromRight 0.7s ease-out both" : undefined,
              }}
            >
              {enemy.pokemon.sprites.front_default && (
                <PokemonSprite
                  src={enemy.pokemon.sprites.front_default}
                  alt={enemy.pokemon.name}
                  anim={enemyAnim}
                  size={96}
                />
              )}
            </div>

            {/* Player info — bottom right */}
            <div
              className="absolute bottom-3 right-3 flex flex-col items-end gap-1"
              style={{
                animation: phase === "intro" ? "fadeSlideUp 0.6s ease-out 0.3s both" : undefined,
              }}
            >
              <div className="text-white font-bold text-sm uppercase drop-shadow font-mono">
                {player.pokemon.name}
                <span className="text-gray-400 text-xs ml-2">#{player.pokemon.id}</span>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {player.pokemon.types.map((t) => (
                  <TypeBadge key={t.type.name} name={t.type.name} />
                ))}
              </div>
              <HpBar current={player.currentHp} max={player.maxHp} />
            </div>

            {/* Player sprite — bottom left (back sprite) */}
            <div
              className="absolute bottom-2 left-6"
              style={{
                animation: phase === "intro" ? "slideFromLeft 0.7s ease-out both" : undefined,
              }}
            >
              {(player.pokemon.sprites.back_default || player.pokemon.sprites.front_default) && (
                <PokemonSprite
                  src={
                    player.pokemon.sprites.back_default ??
                    player.pokemon.sprites.front_default ??
                    ""
                  }
                  alt={player.pokemon.name}
                  anim={playerAnim}
                  size={112}
                />
              )}
            </div>

            {/* VS label during intro */}
            {phase === "intro" && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ animation: "vsAppear 0.4s ease-out 0.8s both" }}
              >
                <span
                  className="text-5xl font-black text-yellow-300"
                  style={{
                    fontFamily: "monospace",
                    textShadow: "0 0 20px rgba(253,224,71,0.8), 2px 2px 0 #b45309",
                  }}
                >
                  VS
                </span>
              </div>
            )}
          </div>

          {/* Battle log */}
          <div
            ref={logRef}
            className="bg-gray-900 border border-gray-700 rounded-xl p-3 h-32 overflow-y-auto flex flex-col gap-0.5 font-mono text-sm"
          >
            {log.map((entry) => (
              <div
                key={entry.id}
                className={
                  entry.type === "attack"
                    ? "text-yellow-300"
                    : entry.type === "damage"
                    ? "text-red-400"
                    : "text-gray-300"
                }
              >
                ▶ {entry.text}
              </div>
            ))}
            {phase === "battle" && (
              <span className="text-gray-500 animate-pulse ml-1">▌</span>
            )}
          </div>

          {/* Result */}
          {phase === "result" && winner && (
            <div className="flex flex-col items-center gap-3 py-2">
              <div
                className="text-2xl font-black text-yellow-300 font-mono animate-bounce"
                style={{ textShadow: "0 0 16px rgba(253,224,71,0.6)" }}
              >
                🏆{" "}
                {(winner === "player"
                  ? player.pokemon.name
                  : enemy.pokemon.name
                ).toUpperCase()}{" "}
                の勝ち！
              </div>
              <button
                onClick={startBattle}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-base font-black rounded-xl transition-all duration-150 font-mono tracking-widest"
              >
                もう一度バトル
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideFromLeft {
          from { transform: translateX(-280px); opacity: 0; }
          to   { transform: translateX(0);      opacity: 1; }
        }
        @keyframes slideFromRight {
          from { transform: translateX(280px);  opacity: 0; }
          to   { transform: translateX(0);      opacity: 1; }
        }
        @keyframes fadeSlideDown {
          from { transform: translateY(-16px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes vsAppear {
          from { transform: scale(2.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
