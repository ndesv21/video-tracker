"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { detectPlatform, generateId } from "@/lib/storage";
import { VideoEntry } from "@/lib/types";

interface Props {
  onClose: () => void;
  onAdd: (video: VideoEntry) => void;
}

export default function AddVideoModal({ onClose, onAdd }: Props) {
  const [url, setUrl] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [postedDate, setPostedDate] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("URL is required");
      return;
    }

    const platform = detectPlatform(url.trim());
    if (!platform) {
      setError("URL must be from TikTok, Facebook, or Instagram");
      return;
    }

    const video: VideoEntry = {
      id: generateId(),
      url: url.trim(),
      platform,
      creatorName: creatorName.trim(),
      postedDate: postedDate || "",
      dateAdded: new Date().toISOString(),
      viewsOnAdd: null,
      viewsDay14: null,
      lastCheckedDate: null,
      lastCheckedViews: null,
      manualViews: false,
      status: "tracking",
      paid: false,
      notes: "",
    };

    onAdd(video);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add Video</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL *</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.tiktok.com/@user/video/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            {url && detectPlatform(url) && (
              <p className="mt-1 text-xs text-green-600">
                Detected: {detectPlatform(url)?.charAt(0).toUpperCase()}{detectPlatform(url)?.slice(1)}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Creator Name</label>
            <input
              type="text"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value)}
              placeholder="e.g. @creator_handle"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video Posted Date</label>
            <input
              type="date"
              value={postedDate}
              onChange={(e) => setPostedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Add & Fetch Views
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
