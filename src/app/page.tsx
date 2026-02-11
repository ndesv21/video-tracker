"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, RefreshCw, Settings, Trash2, ExternalLink, Download, Upload,
  DollarSign, Eye, Clock, AlertCircle, CheckCircle2, Edit3,
} from "lucide-react";
import { detectPlatform, generateId, calculatePayout, getDaysUntil14, is14DaysPassed } from "@/lib/storage";
import { apiGetVideos, apiAddVideo, apiUpdateVideo, apiDeleteVideo, apiGetSettings, apiSaveSettings } from "@/lib/api";
import { VideoEntry, Settings as SettingsType } from "@/lib/types";
import { formatNumber, formatCurrency, platformColor, platformLabel } from "@/lib/utils";
import AddVideoModal from "@/components/AddVideoModal";
import SettingsModal from "@/components/SettingsModal";

export default function Home() {
  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [settings, setSettingsState] = useState<SettingsType>({ rpm: 0.2 });
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [scraping, setScraping] = useState<Record<string, boolean>>({});
  const [bulkScraping, setBulkScraping] = useState(false);
  const [editingViews, setEditingViews] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  useEffect(() => {
    apiGetVideos().then(setVideos).catch(() => {});
    apiGetSettings().then(setSettingsState).catch(() => {});
  }, []);

  async function refreshVideos() {
    const v = await apiGetVideos();
    setVideos(v);
    return v;
  }

  const notify = useCallback((msg: string, type: "ok" | "err") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function fetchViews(video: VideoEntry): Promise<{ views: number | null; creator: string | null }> {
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: video.url, platform: video.platform }),
      });
      const data = await res.json();
      return {
        views: data.success && data.views !== null ? data.views : null,
        creator: data.creator || null,
      };
    } catch {
      return { views: null, creator: null };
    }
  }

  async function handleRefresh(video: VideoEntry) {
    setScraping((p) => ({ ...p, [video.id]: true }));
    const { views, creator } = await fetchViews(video);
    const now = new Date().toISOString();
    if (views !== null) {
      const u: Partial<VideoEntry> = { lastCheckedViews: views, lastCheckedDate: now, manualViews: false };
      if (video.viewsOnAdd === null) u.viewsOnAdd = views;
      if (creator && !video.creatorName) u.creatorName = creator;
      if (is14DaysPassed(video.dateAdded) && video.viewsDay14 === null) {
        u.viewsDay14 = views;
        u.status = "completed";
      }
      await apiUpdateVideo(video.id, u);
      await refreshVideos();
      notify(`Views: ${formatNumber(views)}`, "ok");
    } else {
      const u: Partial<VideoEntry> = { status: "error" as const, lastCheckedDate: now };
      if (creator && !video.creatorName) u.creatorName = creator;
      await apiUpdateVideo(video.id, u);
      await refreshVideos();
      notify("Scrape failed — enter views manually", "err");
    }
    setScraping((p) => ({ ...p, [video.id]: false }));
  }

  async function handleBulkRefresh() {
    setBulkScraping(true);
    let ok = 0, fail = 0;
    const all = await apiGetVideos();
    for (const v of all) {
      if (v.status === "completed") continue;
      setScraping((p) => ({ ...p, [v.id]: true }));
      const { views, creator } = await fetchViews(v);
      const now = new Date().toISOString();
      if (views !== null) {
        const u: Partial<VideoEntry> = { lastCheckedViews: views, lastCheckedDate: now, manualViews: false };
        if (v.viewsOnAdd === null) u.viewsOnAdd = views;
        if (creator && !v.creatorName) u.creatorName = creator;
        if (is14DaysPassed(v.dateAdded) && v.viewsDay14 === null) { u.viewsDay14 = views; u.status = "completed"; }
        await apiUpdateVideo(v.id, u);
        ok++;
      } else {
        const u: Partial<VideoEntry> = { status: "error" as const, lastCheckedDate: now };
        if (creator && !v.creatorName) u.creatorName = creator;
        await apiUpdateVideo(v.id, u);
        fail++;
      }
      setScraping((p) => ({ ...p, [v.id]: false }));
      await new Promise((r) => setTimeout(r, 2000));
    }
    await refreshVideos();
    setBulkScraping(false);
    notify(`Done: ${ok} success, ${fail} failed`, ok > 0 ? "ok" : "err");
  }

  async function handleManualSubmit(id: string) {
    const views = parseInt(manualInput, 10);
    if (isNaN(views) || views < 0) { notify("Invalid number", "err"); return; }
    const v = videos.find((x) => x.id === id);
    if (!v) return;
    const now = new Date().toISOString();
    const u: Partial<VideoEntry> = { lastCheckedViews: views, lastCheckedDate: now, manualViews: true, status: "tracking" };
    if (v.viewsOnAdd === null) u.viewsOnAdd = views;
    if (is14DaysPassed(v.dateAdded) && v.viewsDay14 === null) { u.viewsDay14 = views; u.status = "completed"; }
    await apiUpdateVideo(id, u);
    await refreshVideos();
    setEditingViews(null);
    setManualInput("");
    notify(`Views set: ${formatNumber(views)}`, "ok");
  }

  async function handleAddVideo(video: VideoEntry) {
    await apiAddVideo(video);
    await refreshVideos();
    handleRefresh(video);
  }

  async function handleSaveSettings(s: SettingsType) {
    await apiSaveSettings(s);
    setSettingsState(s);
    notify("Settings saved", "ok");
  }

  async function handleExport() {
    const data = JSON.stringify({ videos, settings }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-tracker-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.videos) {
            for (const v of data.videos) {
              await apiAddVideo(v);
            }
          }
          if (data.settings) await apiSaveSettings(data.settings);
          await refreshVideos();
          if (data.settings) setSettingsState(data.settings);
          notify("Imported", "ok");
        } catch { notify("Import failed", "err"); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  const totalVideos = videos.length;
  const completedVideos = videos.filter((v) => v.status === "completed").length;
  const totalViews = videos.reduce((s, v) => s + (v.viewsDay14 || v.lastCheckedViews || 0), 0);
  const totalPayout = videos.filter((v) => v.viewsDay14 !== null)
    .reduce((s, v) => s + calculatePayout(v.viewsDay14!, settings.rpm), 0);

  return (
    <div className="min-h-screen bg-gray-50 font-[family-name:var(--font-geist-sans)]">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 ${toast.type === "ok" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
          {toast.type === "ok" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}
      {showAdd && <AddVideoModal onClose={() => setShowAdd(false)} onAdd={handleAddVideo} />}
      {showSettings && <SettingsModal settings={settings} onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />}

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Video Tracker</h1>
            <p className="text-sm text-gray-500">Creator payment tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleBulkRefresh} disabled={bulkScraping} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
              <RefreshCw size={16} className={bulkScraping ? "animate-spin" : ""} />
              {bulkScraping ? "Refreshing..." : "Refresh All"}
            </button>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              <Plus size={16} /> Add Video
            </button>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Settings"><Settings size={18} /></button>
            <button onClick={handleExport} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Export"><Download size={18} /></button>
            <button onClick={handleImport} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Import"><Upload size={18} /></button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: <Eye size={20} className="text-indigo-600" />, bg: "bg-indigo-50", label: "Total Videos", val: totalVideos },
            { icon: <CheckCircle2 size={20} className="text-green-600" />, bg: "bg-green-50", label: "Completed (14d)", val: completedVideos },
            { icon: <Eye size={20} className="text-blue-600" />, bg: "bg-blue-50", label: "Total Views", val: formatNumber(totalViews) },
            { icon: <DollarSign size={20} className="text-yellow-600" />, bg: "bg-yellow-50", label: "Total Payout", val: formatCurrency(totalPayout) },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${c.bg}`}>{c.icon}</div>
                <div>
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{c.val}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mb-4 text-xs text-gray-400">RPM: ${settings.rpm} per 1,000 views &middot; Payout on 14-day views</p>

        {videos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <Eye size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No videos tracked yet</h3>
            <p className="text-sm text-gray-500 mb-4">Add your first video link to start tracking views.</p>
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
              <Plus size={16} /> Add Video
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {["Platform","Creator","Posted","Added","Status","Views (Add)","Views (14d)","Current","Payout","Paid","Actions"].map((h) => (
                      <th key={h} className={`px-4 py-3 font-medium text-gray-600 ${["Views (Add)","Views (14d)","Current","Payout"].includes(h) ? "text-right" : (h === "Actions" || h === "Paid") ? "text-center" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {videos.map((video) => {
                    const daysLeft = getDaysUntil14(video.dateAdded);
                    const payout = video.viewsDay14 !== null ? calculatePayout(video.viewsDay14, settings.rpm) : null;
                    const loading = scraping[video.id];
                    return (
                      <tr key={video.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${platformColor(video.platform)}`}>{platformLabel(video.platform)}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{video.creatorName || "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{video.postedDate ? new Date(video.postedDate).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(video.dateAdded).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {video.status === "error" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><AlertCircle size={12} /> Error</span>
                          ) : video.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle2 size={12} /> Done</span>
                          ) : daysLeft <= 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700"><Clock size={12} /> Ready</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"><Clock size={12} /> {daysLeft}d left</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">{formatNumber(video.viewsOnAdd)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">{formatNumber(video.viewsDay14)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {editingViews === video.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input type="number" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit(video.id)}
                                className="w-24 px-2 py-1 border border-gray-300 rounded text-xs text-right" autoFocus placeholder="views" />
                              <button onClick={() => handleManualSubmit(video.id)} className="text-green-600 hover:text-green-800 p-1"><CheckCircle2 size={14} /></button>
                              <button onClick={() => setEditingViews(null)} className="text-gray-400 hover:text-gray-600 p-1"><AlertCircle size={14} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 justify-end">
                              <span>{formatNumber(video.lastCheckedViews)}</span>
                              <button onClick={() => { setEditingViews(video.id); setManualInput(video.lastCheckedViews?.toString() || ""); }}
                                className="text-gray-400 hover:text-gray-600 p-0.5" title="Edit manually"><Edit3 size={12} /></button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-700">{payout !== null ? formatCurrency(payout) : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={video.paid || false}
                            onChange={async (e) => {
                              await apiUpdateVideo(video.id, { paid: e.target.checked });
                              await refreshVideos();
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            title={video.paid ? "Marked as paid" : "Mark as paid"}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={() => handleRefresh(video)} disabled={loading} className="p-1.5 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50" title="Fetch views">
                              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                            </button>
                            <a href={video.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-600" title="Open video">
                              <ExternalLink size={14} />
                            </a>
                            <button onClick={async () => { if (confirm("Delete?")) { await apiDeleteVideo(video.id); await refreshVideos(); } }} className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
