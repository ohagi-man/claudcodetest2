"use client";

import { useState, useCallback } from "react";

type Library = {
  libkey: string;
  systemid: string;
  systemname: string;
  libid: string;
  formal: string;
  short: string;
  url_pc: string;
  address: string;
  tel: string;
  geocode: string;
  category: string;
  pref: string;
  city: string;
  post: string;
  hours: string;
  closed: string;
};

const CATEGORY_STYLE: Record<string, string> = {
  "公共": "bg-blue-600",
  "大学": "bg-purple-600",
  "高校": "bg-orange-600",
  "小中学校": "bg-green-600",
  "専門": "bg-yellow-600",
  "その他": "bg-gray-600",
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function parseGeocode(geocode: string): [number, number] | null {
  const parts = geocode.split(",").map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  // Calil response geocode is "lng,lat" format
  return [parts[1], parts[0]];
}

function LibraryCard({
  lib,
  userLat,
  userLng,
}: {
  lib: Library;
  userLat: number;
  userLng: number;
}) {
  const geo = parseGeocode(lib.geocode);
  const distance = geo ? haversineKm(userLat, userLng, geo[0], geo[1]) : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    lib.address || lib.formal
  )}`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col gap-2 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-bold text-base leading-snug">{lib.formal}</h3>
          {lib.systemname && lib.systemname !== lib.formal && (
            <p className="text-gray-500 text-xs mt-0.5 truncate">{lib.systemname}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {distance !== null && (
            <span className="text-yellow-300 font-mono font-bold text-sm">
              {fmtDist(distance)}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded text-xs font-bold text-white ${
              CATEGORY_STYLE[lib.category] ?? "bg-gray-600"
            }`}
          >
            {lib.category}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        {lib.address && <p className="text-gray-400">📍 {lib.address}</p>}
        {lib.tel && <p className="text-gray-400">📞 {lib.tel}</p>}
        {lib.hours && <p className="text-gray-400 text-xs">🕐 {lib.hours}</p>}
        {lib.closed && <p className="text-gray-500 text-xs">休館日: {lib.closed}</p>}
      </div>

      <div className="flex gap-2 flex-wrap mt-1">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded-lg transition-colors"
        >
          🗺 地図で見る
        </a>
        {lib.url_pc && (
          <a
            href={lib.url_pc}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded-lg transition-colors"
          >
            🔗 図書館サイト
          </a>
        )}
      </div>
    </div>
  );
}

type Phase = "idle" | "locating" | "fetching" | "done" | "error";

export default function LibraryFinder() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeCategory, setActiveCategory] = useState("すべて");

  const search = useCallback(async () => {
    setPhase("locating");
    setErrorMsg("");

    let lat: number, lng: number;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      setUserLat(lat);
      setUserLng(lng);
    } catch {
      setErrorMsg("位置情報を取得できませんでした。ブラウザの位置情報を許可してください。");
      setPhase("error");
      return;
    }

    setPhase("fetching");
    try {
      const res = await fetch(`/api/libraries?lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error("api error");
      const data: Library[] = await res.json();
      setLibraries(data);
      setActiveCategory("すべて");
      setPhase("done");
    } catch {
      setErrorMsg("図書館情報の取得に失敗しました。しばらくしてから再試行してください。");
      setPhase("error");
    }
  }, []);

  const categories = [
    "すべて",
    ...Array.from(new Set(libraries.map((l) => l.category))).filter(Boolean),
  ];

  const displayed = libraries
    .filter((l) => activeCategory === "すべて" || l.category === activeCategory)
    .sort((a, b) => {
      if (userLat == null || userLng == null) return 0;
      const ga = parseGeocode(a.geocode);
      const gb = parseGeocode(b.geocode);
      if (!ga || !gb) return 0;
      return (
        haversineKm(userLat, userLng, ga[0], ga[1]) -
        haversineKm(userLat, userLng, gb[0], gb[1])
      );
    });

  const isLoading = phase === "locating" || phase === "fetching";

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-4 pb-12">
      <div className="w-full max-w-xl">
        <div className="py-10 text-center">
          <h1
            className="text-3xl font-black text-white tracking-wide"
            style={{ fontFamily: "monospace" }}
          >
            📚 近くの図書館
          </h1>
          <p className="text-gray-500 text-sm mt-2">現在地から近い図書館を探します</p>
        </div>

        {!isLoading && phase !== "done" && (
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={search}
              className="px-12 py-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-lg font-bold rounded-2xl shadow-lg shadow-blue-900/40 transition-all duration-150"
            >
              📍 現在地から探す
            </button>
            {phase === "error" && (
              <p className="text-red-400 text-sm text-center max-w-xs">{errorMsg}</p>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm animate-pulse">
              {phase === "locating" ? "📍 位置情報を取得中..." : "🔍 図書館を検索中..."}
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col gap-4">
            {categories.length > 2 && (
              <div className="flex gap-2 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      activeCategory === cat
                        ? "bg-blue-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            <p className="text-gray-500 text-sm">
              {displayed.length} 件の図書館が見つかりました
            </p>

            <div className="flex flex-col gap-3">
              {displayed.map((lib) => (
                <LibraryCard
                  key={lib.libkey}
                  lib={lib}
                  userLat={userLat!}
                  userLng={userLng!}
                />
              ))}
            </div>

            <button
              onClick={search}
              className="mt-2 w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-xl transition-colors"
            >
              🔄 再検索
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
