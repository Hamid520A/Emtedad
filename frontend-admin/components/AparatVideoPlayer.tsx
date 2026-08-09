// frontend-admin/components/AparatVideoPlayer.tsx
'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, Minimize2, ExternalLink } from 'lucide-react';
import { openExternalLink } from '@/lib/utils/url';

interface AparatVideoPlayerProps {
  videoUrl: string;
  title?: string;
}

export const getAparatEmbedUrl = (url: string) => {
  if (!url) return null;
  const match = url.match(/(?:v\/|videohash\/|frame\/v\/|embed\/v\/|v=)([a-zA-Z0-9]+)/);
  if (match && match[1]) {
    return `https://www.aparat.com/video/video/embed/videohash/${match[1]}/vt/frame?recreate=true`;
  }
  return null;
};

export default function AparatVideoPlayer({ videoUrl, title }: AparatVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const embedUrl = getAparatEmbedUrl(videoUrl);

  if (!videoUrl || !embedUrl) return null;

  const toggleFullscreen = async () => {
    const elem = containerRef.current;
    if (!elem) return;

    if (!isFullscreen) {
      let nativeSuccess = false;
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          nativeSuccess = true;
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
          nativeSuccess = true;
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen();
          nativeSuccess = true;
        }
      } catch (e) {
        console.warn("Native requestFullscreen failed or blocked by WebView", e);
      }

      setIsFullscreen(true);
    } else {
      try {
        if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
        }
      } catch (e) {}
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-[999999] bg-black w-screen h-screen flex flex-col justify-center items-center p-0 m-0'
          : 'w-full rounded-2xl shadow-sm border border-gray-100 bg-black aspect-video mt-2 overflow-hidden group'
      }`}
      dir="rtl"
    >
      {/* ویدیوی آی‌فرم آپارات */}
      <iframe
        src={embedUrl}
        allowFullScreen={true}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; full-screen; display-capture"
        className="w-full h-full border-0"
        title="Aparat Video Player"
        {...({ webkitallowfullscreen: 'true', mozallowfullscreen: 'true', allowfullscreen: 'true' } as any)}
      />

      {/* دکمه اختصاصی کنترل تمام‌صفحه هوشمند */}
      <div
        className={`absolute z-20 transition-opacity duration-200 ${
          isFullscreen
            ? 'top-4 right-4 flex items-center gap-2'
            : 'top-3 right-3 opacity-90 hover:opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          className="bg-black/75 hover:bg-black/90 text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 backdrop-blur-md border border-white/20 shadow-lg active:scale-95 transition"
        >
          {isFullscreen ? (
            <>
              <Minimize2 size={16} className="text-[#c5a059]" />
              <span>خروج از تمام‌صفحه</span>
            </>
          ) : (
            <>
              <Maximize2 size={16} className="text-[#c5a059]" />
              <span>تمام‌صفحه</span>
            </>
          )}
        </button>

        {isFullscreen && (
          <button
            type="button"
            onClick={() => openExternalLink(videoUrl)}
            className="bg-[#c5a059] text-[#1a2e44] px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition"
          >
            <ExternalLink size={14} />
            <span>پخش در اپ آپارات</span>
          </button>
        )}
      </div>
    </div>
  );
}
