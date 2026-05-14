import React, { useEffect, useState, useRef, useCallback } from "react";
import { PresentationView } from "./components/PresentationView.jsx";
import { CarouselStrip } from "./components/CarouselStrip.jsx";
import { MediaInfo } from "./components/MediaInfo.jsx";
import { NavArrows } from "./components/NavArrows.jsx";
import { useGallery } from "./hooks/useGallery.js";
import { useCarouselReveal } from "./hooks/useCarouselReveal.js";
import { useSwipe } from "./hooks/useSwipe.js";
import clsx from "clsx";

export default function App() {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const videoRef = useRef(null);

  // Detect platform for Mac-specific shortcuts
  const isMac =
    typeof window !== "undefined" &&
    (navigator.platform.toUpperCase().indexOf("MAC") >= 0 || navigator.platform === "iPhone");

  // ── Load manifest ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}manifest.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`manifest.json not found (${r.status})`);
        return r.json();
      })
      .then(setManifest)
      .catch((err) => setError(err.message));
  }, []);

  // ── Gallery state ──────────────────────────────────────────────────────────
  const { flatItems, pins, activeIndex, setActiveIndex, navigate, activeItem } = useGallery(
    manifest ?? [],
  );

  // ── Carousel auto-hide ─────────────────────────────────────────────────────
  const { revealed, reveal, hide, scheduleHide } = useCarouselReveal(isZoomed);

  const handleTap = useCallback(() => {
    // 1. Play/Pause toggle for videos
    if (activeItem?.type === "video" && videoRef.current) {
      const v = videoRef.current;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    }
    // 2. Hide carousel when tapping the main view
    scheduleHide(600);
  }, [activeItem, scheduleHide]);

  // ── Swipe state lifted for NavArrow synchronization ────────────────────────
  const handleNext = useCallback(() => {
    if (!document.fullscreenElement) navigate(1);
  }, [navigate]);

  const handlePrev = useCallback(() => {
    if (!document.fullscreenElement) navigate(-1);
  }, [navigate]);

  const swipeOptions = React.useMemo(
    () => ({
      onNext: handleNext,
      onPrev: handlePrev,
      onUp: reveal,
      onDown: hide,
      onTap: handleTap,
      threshold: 60,
      velocityMin: 0.3,
    }),
    [handleNext, handlePrev, reveal, hide, handleTap],
  );

  const { ref: swipeRef, dragOffset, isDragging, swipePower, direction } = useSwipe(swipeOptions);

  // Find the previous and next pinned landmarks based on activeIndex
  const prevPin =
    pins.length > 0
      ? [...pins].reverse().find((p) => p.pinIndex < activeIndex) || pins[pins.length - 1]
      : null;
  const nextPin = pins.length > 0 ? pins.find((p) => p.pinIndex > activeIndex) || pins[0] : null;

  // Resolve display labels with fallbacks to avoid "undefined"
  const prevLabel = prevPin?.label || prevPin?.folder || "Previous Section";
  const nextLabel = nextPin?.label || nextPin?.folder || "Next Section";

  // Force hide carousel immediately when entering zoom mode
  useEffect(() => {
    if (isZoomed) hide();
  }, [isZoomed, hide]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      const isFullscreen = !!document.fullscreenElement;
      // Navigation
      if (e.key === "ArrowLeft" && !isZoomed && !isFullscreen) {
        e.preventDefault();
        e.shiftKey && prevPin ? setActiveIndex(prevPin.pinIndex) : navigate(-1);
      }
      if (e.key === "ArrowRight" && !isZoomed && !isFullscreen) {
        e.preventDefault();
        e.shiftKey && nextPin ? setActiveIndex(nextPin.pinIndex) : navigate(1);
      }

      // Carousel Visibility
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !isZoomed) {
        e.preventDefault();
        revealed ? hide() : reveal();
      }

      // Zoom Toggle
      if ((e.altKey && e.key === "Enter") || e.key === "f" || e.key === "F") {
        if (activeItem?.type === "image") {
          e.preventDefault();
          setIsZoomed((prev) => !prev);
        } else if (activeItem?.type === "video" && videoRef.current) {
          e.preventDefault();
          const v = videoRef.current;
          if (!document.fullscreenElement) {
            if (v.requestFullscreen) v.requestFullscreen();
            else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
          } else {
            if (document.exitFullscreen) document.exitFullscreen();
          }
        }
      }

      // Help Toggle
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      // Exit Modals / Zoom
      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          e.preventDefault();
          document.exitFullscreen();
        } else if (showShortcuts) {
          e.preventDefault();
          setShowShortcuts(false);
        } else if (isZoomed) {
          e.preventDefault();
          setIsZoomed(false);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    navigate,
    reveal,
    hide,
    prevPin,
    nextPin,
    setActiveIndex,
    activeItem,
    setIsZoomed,
    isZoomed,
    revealed,
    showShortcuts,
  ]);

  // ── Error / loading states ─────────────────────────────────────────────────
  if (error) {
    return (
      <div className="presentation" style={{ flexDirection: "column", gap: 16 }}>
        <p
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "1.4rem",
            fontStyle: "italic",
            color: "var(--color-text)",
          }}
        >
          Could not load gallery
        </p>
        <p
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.7rem",
            color: "var(--color-muted)",
          }}
        >
          {error}
        </p>
        <p
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.65rem",
            color: "rgba(139,139,158,0.5)",
            maxWidth: 420,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Run <code style={{ color: "var(--color-gold)" }}>npm run thumbnails</code> first, then{" "}
          <code style={{ color: "var(--color-gold)" }}>npm run dev</code>. Make sure your media
          folders are inside <code style={{ color: "var(--color-gold)" }}>/media</code>.
        </p>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="presentation">
        <div className="animate-loader-fade">
          <svg
            className="h-5 w-5 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <path
              className="opacity-100"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Full-screen media display */}
      <PresentationView
        item={activeItem}
        videoRef={videoRef}
        onNext={() => navigate(1)}
        onPrev={() => navigate(-1)}
        isZoomed={isZoomed}
        setIsZoomed={setIsZoomed}
        revealed={revealed}
        onMediaClick={() => scheduleHide(600)}
        swipeRef={swipeRef}
        direction={direction}
        dragOffset={dragOffset}
        swipePower={swipePower}
        isDragging={isDragging}
        onToggleShortcuts={() => setShowShortcuts((prev) => !prev)}
      />

      {/* Top-left metadata */}
      <MediaInfo item={activeItem} total={flatItems.length} activeIndex={activeIndex} />

      {/* Pinned landmark navigation - kept mounted to preserve scroll state */}
      {pins.length > 0 && (
        <>
          <button
            className={clsx("pin-nav-btn prev", { revealed, "is-zoomed": isZoomed })}
            onClick={() => setActiveIndex(prevPin.pinIndex)}
            onMouseEnter={reveal}
            onMouseLeave={() => scheduleHide(600)}
            title={`Jump to ${prevLabel}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="11 17 6 12 11 7" />
              <polyline points="17 17 12 12 17 7" />
            </svg>
            <span className="pin-nav-label">{prevLabel}</span>
          </button>

          <button
            className={clsx("pin-nav-btn next", { revealed, "is-zoomed": isZoomed })}
            onClick={() => setActiveIndex(nextPin.pinIndex)}
            onMouseEnter={reveal}
            onMouseLeave={() => scheduleHide(600)}
            title={`Jump to ${nextLabel}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="13 17 18 12 13 7" />
              <polyline points="7 17 12 12 7 7" />
            </svg>
            <span className="pin-nav-label">{nextLabel}</span>
          </button>
        </>
      )}

      {/* Auto-hiding carousel strip - kept mounted to preserve scroll position */}
      <CarouselStrip
        manifest={manifest}
        flatItems={flatItems}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        revealed={revealed}
        isZoomed={isZoomed}
        dragOffset={dragOffset}
        isDragging={isDragging}
        swipePower={swipePower}
        direction={direction}
        onMouseEnter={reveal}
        onMouseLeave={() => scheduleHide(600)}
        onHide={hide}
        onNext={() => navigate(1)}
        onPrev={() => navigate(-1)}
      />

      {!isZoomed && (
        <>
          {/* Left / right arrows */}
          <NavArrows
            onPrev={() => navigate(-1)}
            onNext={() => navigate(1)}
            dragOffset={direction === "horizontal" ? dragOffset : 0}
            swipePower={direction === "horizontal" ? swipePower : 0}
          />
        </>
      )}

      {/* Shortcut Legend Modal */}
      {showShortcuts && (
        <div className="shortcut-modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="shortcut-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-6 border-b border-white/10 pb-2 text-center font-serif text-3xl italic">
              Shortcuts
            </h2>
            <div className="shortcut-grid">
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">←</span> <span className="kbd">→</span>
                </div>
                <div className="shortcut-desc">Navigate slides</div>
              </div>
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">{isMac ? "⇧" : "Shift"}</span> +{" "}
                  <span className="kbd">←</span> <span className="kbd">→</span>
                </div>
                <div className="shortcut-desc">Jump sections</div>
              </div>
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">↑</span> or <span className="kbd">↓</span>
                </div>
                <div className="shortcut-desc">Toggle Carousel</div>
              </div>
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">{isMac ? "⌥" : "Alt"}</span> +{" "}
                  <span className="kbd">↵</span>
                  or
                  <span className="kbd">F</span>
                </div>
                <div className="shortcut-desc">Toggle Zoom</div>
              </div>
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="5" y="2" width="14" height="20" rx="7" />
                      <path d="M12 6v4" />
                    </svg>
                  </span>
                </div>
                <div className="shortcut-desc">Zoom In/Out</div>
              </div>
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">H</span>
                </div>
                <div className="shortcut-desc">Keyboard Help</div>
              </div>
              <div className="shortcut-row">
                <div className="shortcut-key-wrapper">
                  <span className="kbd">Esc</span>
                </div>
                <div className="shortcut-desc">Exit Modal/Zoom</div>
              </div>
            </div>
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-8 w-full border border-white/10 py-3 font-mono text-[10px] uppercase tracking-widest opacity-60 transition-colors hover:border-white/100 hover:bg-white/5 hover:text-white hover:opacity-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
