import React, { useEffect, useState, useRef, useCallback } from "react";
import clsx from "clsx";
import { assetUrl } from "../utils/assetUrl.js";

import { createPlayer, videoFeatures } from "@videojs/react";
import { MinimalVideoSkin, Video } from "@videojs/react/video";

/**
 * PresentationView
 *
 * Full-screen presentation area that lazy-loads the active media item.
 * Supports mouse and touch swipe gestures to navigate prev/next.
 * Images fade in once loaded; videos autoplay muted.
 */
export function PresentationView({
  item,
  onNext,
  onPrev,
  isZoomed,
  setIsZoomed,
  revealed,
  onMediaClick,
  swipeRef,
  direction,
  videoRef,
  dragOffset,
  swipePower,
  isDragging,
  onToggleShortcuts,
}) {
  const Player = React.useMemo(() => createPlayer({ features: videoFeatures }), []);

  const [displayedItem, setDisplayedItem] = useState(item);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(true);
  const [naturalSize, setNaturalSize] = useState(null);

  // Zoom and Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDraggingZoom, setIsDraggingZoom] = useState(false);
  const zoomImgRef = useRef(null);

  // Pinch-to-zoom tracking
  const activePointers = useRef(new Map());
  const initialPinchDistance = useRef(0);
  const initialPinchScale = useRef(1);
  const lastPinchMidpoint = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef({ time: -1000, x: 0, y: 0 });
  const lastTapTimerRef = useRef(null);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const lastInteractionTime = useRef(0);

  // Persist user volume preference across items and sessions
  const persistedVolume = useRef(parseFloat(localStorage.getItem("gallery-volume") ?? "0.1"));

  // Viewport tracking for reactive layout calculations
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calculate the scale required to fit the image to the viewport (contain)
  const fitScale = React.useMemo(() => {
    if (!naturalSize) return 1;
    return Math.min(windowSize.width / naturalSize.w, windowSize.height / naturalSize.h);
  }, [naturalSize, windowSize]);

  // Calculate integer dimensions for the "contain" fit
  const pixelSize = React.useMemo(() => {
    if (!naturalSize) return null;
    const ratio = Math.min(windowSize.width / naturalSize.w, windowSize.height / naturalSize.h);

    // Round up to nearest pixel to avoid subpixel rendering
    return {
      width: Math.ceil(naturalSize.w * ratio),
      height: Math.ceil(naturalSize.h * ratio),
    };
  }, [naturalSize, windowSize]);

  // Dynamic margin for video controls to avoid carousel overlap.
  // Controls sit at the bottom of the video content (not the viewport).
  // We calculate the gap between viewport bottom and video bottom.
  const videoControlsMargin = React.useMemo(() => {
    if (displayedItem?.type !== "video" || !pixelSize) return "0px";

    // Calculate the height of the revealed carousel (120px inner + peek)
    // We use a small buffer to match the CSS media query accurately
    const isMobile = window.innerWidth <= 640;
    const carouselHeight = 120 + (isMobile ? 48 : 66);
    const uiGapY = isMobile ? 12 : 24;

    const vH = window.innerHeight;
    const bottomGap = Math.max(0, (vH - pixelSize.height) / 2);

    // Threshold: we only need a margin if the bottomGap is smaller than the carousel
    const threshold = carouselHeight + uiGapY;
    return bottomGap >= threshold ? "0px" : `${threshold - Math.round(bottomGap)}px`;
  }, [displayedItem, pixelSize, windowSize]);

  // Calculate the maximum allowed translation based on current scale and viewport
  const getMaxOffset = (s) => {
    const img = zoomImgRef.current;
    if (!img || !naturalSize) return { x: 0, y: 0 };

    const vW = window.innerWidth;
    const vH = window.innerHeight;
    // Calculate boundaries based on the "snapped" visual size
    const snappedS = Math.ceil(naturalSize.w * s) / naturalSize.w;

    return {
      x: Math.round(Math.max(0, (naturalSize.w * snappedS - vW) / 2)),
      y: Math.round(Math.max(0, (naturalSize.h * snappedS - vH) / 2)),
    };
  };

  const handleLoad = useCallback((e) => {
    const target = e.target;
    // Set initial volume for videos
    if (target.tagName === "VIDEO") {
      target.volume = persistedVolume.current;
    }
    setNaturalSize({
      w: target.naturalWidth || target.videoWidth,
      h: target.naturalHeight || target.videoHeight,
    });
    setLoading(false);
    setVisible(true);
  }, []);

  // Reset interaction state whenever the mode toggles or item changes to prevent stuck cursors
  useEffect(() => {
    activePointers.current.clear();
    setIsDraggingZoom(false);
  }, [isZoomed, displayedItem]);

  // Cross-fade on item change
  useEffect(() => {
    if (!item) return;
    if (item.src === displayedItem?.src) return;

    setVisible(false);
    setLoading(true);

    // Auto-exit zoom only if the incoming item is not a zoomable image
    if (item.type !== "image") setIsZoomed(false);

    setScale(1);
    setPosition({ x: 0, y: 0 });
    setNaturalSize(null);

    const timer = setTimeout(() => {
      setDisplayedItem(item);
    }, 250);

    return () => clearTimeout(timer);
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset dimensions and check cache when the displayed item changes
  useEffect(() => {
    if (!displayedItem) return;

    // If zooming and image is already in cache, capture size immediately
    if (isZoomed && displayedItem.type === "image" && zoomImgRef.current) {
      const img = zoomImgRef.current;
      if (img.complete && img.naturalWidth) {
        setNaturalSize({
          w: img.naturalWidth,
          h: img.naturalHeight,
        });
      }
    }
  }, [displayedItem, isZoomed]);

  // Transition scale when entering/exiting zoom mode
  useEffect(() => {
    if (!naturalSize) return;

    // Do not run the cinematic zoom transition if the user is already pinching or panning
    if (activePointers.current.size > 0) return;

    if (isZoomed) {
      // Start from the "fit" size to create a seamless transition from the standard view
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });

      // Trigger the transition to scale 1 in the next frame
      const raf = requestAnimationFrame(() => {
        setScale(1);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Zoom back out to fit scale when exiting
      setScale(fitScale);
      setPosition({ x: 0, y: 0 });
    }
  }, [isZoomed, naturalSize, fitScale]);

  // Handle mouse wheel for step-based zooming
  const handleWheel = (e) => {
    if (!isZoomed || !naturalSize) return;

    // Calculate step: zoom in on scroll up, out on scroll down
    const zoomStep = 0.25;
    const factor = e.deltaY < 0 ? 1 + zoomStep : 1 - zoomStep;

    // Limit zooming out to 50% of the fit size for a "bounce" effect
    const minLimit = Math.min(1, fitScale) * 0.5;

    const nextScale = Math.min(Math.max(minLimit, scale * factor), 8);
    const bounds = getMaxOffset(nextScale);

    setScale(nextScale);

    setPosition((p) => ({
      x: Math.min(Math.max(p.x, -bounds.x), bounds.x),
      y: Math.min(Math.max(p.y, -bounds.y), bounds.y),
    }));
  };

  // Shared logic for double-click (desktop) and double-tap (mobile)
  const handleDoubleInteraction = useCallback(
    (e) => {
      const now = performance.now();
      if (now - lastInteractionTime.current < 500) return;

      if (displayedItem?.type === "video" && videoRef.current) {
        // Video: Toggle Native Fullscreen (Unified for Mobile/Desktop)
        const v = videoRef.current;
        if (!document.fullscreenElement) {
          if (v.requestFullscreen) v.requestFullscreen();
          else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
        } else {
          if (document.exitFullscreen) document.exitFullscreen();
        }
        lastInteractionTime.current = now;
      } else if (displayedItem?.type === "image") {
        // Image: Toggle Zoom Mode (Cinematic view)
        setIsZoomed((prev) => !prev);
        lastInteractionTime.current = now;
      }
    },
    [displayedItem, setIsZoomed, videoRef],
  );

  const swipeStartPos = useRef({ x: 0, y: 0, time: 0 });

  // Panning logic
  const handlePointerDown = (e) => {
    if (e.target.closest(".vjs-control-bar, .vjs-big-play-button, .media-controls")) return;

    // ── Double-tap detection (only when NOT zoomed) ──────────────────────────
    if (!isZoomed) {
      // Ignore non-primary touch here only — a second finger has no role in double-tap
      if (e.pointerType === "touch" && !e.isPrimary) return;

      const now = performance.now();
      const dt = now - lastTapRef.current.time;
      const dx = Math.abs(e.clientX - lastTapRef.current.x);
      const dy = Math.abs(e.clientY - lastTapRef.current.y);

      if (dt > 40 && dt < 300 && dx < 30 && dy < 30) {
        clearTimeout(lastTapTimerRef.current);
        handleDoubleInteraction(e);
        lastTapRef.current = { time: -1000, x: 0, y: 0 };
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        return;
      } else {
        clearTimeout(lastTapTimerRef.current);
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        lastTapTimerRef.current = setTimeout(() => {
          lastTapRef.current = { time: -1000, x: 0, y: 0 };
        }, 300);
      }
      return;
    }

    // ── Panning / pinch-to-zoom (only when zoomed) ───────────────────────────
    // All pointers (primary and non-primary) must be tracked here for pinch to work
    const now = performance.now();
    const dt = now - lastTapRef.current.time;
    const dx = Math.abs(e.clientX - lastTapRef.current.x);
    const dy = Math.abs(e.clientY - lastTapRef.current.y);

    if (dt > 40 && dt < 300 && dx < 30 && dy < 30) {
      clearTimeout(lastTapTimerRef.current);
      handleDoubleInteraction(e);
      lastTapRef.current = { time: -1000, x: 0, y: 0 };
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      return;
    } else {
      clearTimeout(lastTapTimerRef.current);
      lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      lastTapTimerRef.current = setTimeout(() => {
        lastTapRef.current = { time: -1000, x: 0, y: 0 };
      }, 300);
    }

    activePointers.current.set(e.pointerId, e);
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    dragStartPos.current = { x: e.clientX, y: e.clientY };

    if (activePointers.current.size === 2) {
      setIsDraggingZoom(false);
      const pts = Array.from(activePointers.current.values());
      const pdx = pts[0].clientX - pts[1].clientX;
      const pdy = pts[0].clientY - pts[1].clientY;
      initialPinchDistance.current = Math.sqrt(pdx * pdx + pdy * pdy);
      initialPinchScale.current = scale;

      // ← record where the midpoint starts
      lastPinchMidpoint.current = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2,
      };
    }
  };

  const handlePointerMove = (e) => {
    activePointers.current.set(e.pointerId, e);

    // Fail-safe: If no buttons are pressed, we should not be in a dragging state.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      handlePointerUp(e);
      return;
    }

    const dx = e.clientX - lastPointerPos.current.x;
    const dy = e.clientY - lastPointerPos.current.y;
    lastPointerPos.current = { x: e.clientX, y: e.clientY };

    if (activePointers.current.size === 2 && initialPinchDistance.current > 0) {
      const pts = Array.from(activePointers.current.values());

      // Scale from distance ratio
      const pdx = pts[0].clientX - pts[1].clientX;
      const pdy = pts[0].clientY - pts[1].clientY;
      const currentDist = Math.sqrt(pdx * pdx + pdy * pdy);
      const factor = currentDist / initialPinchDistance.current;

      const minLimit = Math.min(1, fitScale) * 0.5;
      const nextScale = Math.min(Math.max(minLimit, initialPinchScale.current * factor), 8);
      const bounds = getMaxOffset(nextScale);

      // Pan from midpoint delta (touch-only: pointerType guard keeps this off mouse)
      const currentMid = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2,
      };
      const midDx = pts[0].pointerType === "touch" ? currentMid.x - lastPinchMidpoint.current.x : 0;
      const midDy = pts[0].pointerType === "touch" ? currentMid.y - lastPinchMidpoint.current.y : 0;
      lastPinchMidpoint.current = currentMid;

      setScale(nextScale);
      setPosition((p) => ({
        x: Math.min(Math.max(p.x + midDx, -bounds.x), bounds.x),
        y: Math.min(Math.max(p.y + midDy, -bounds.y), bounds.y),
      }));
    } else if (isZoomed && activePointers.current.size === 1) {
      // Threshold based on cumulative distance from start, not per-frame delta
      const totalDx = e.clientX - dragStartPos.current.x;
      const totalDy = e.clientY - dragStartPos.current.y;
      const totalDist = Math.sqrt(Math.pow(totalDx, 2) + Math.pow(totalDy, 2));

      if (!isDraggingZoom && totalDist < 10) return;
      if (!isDraggingZoom) setIsDraggingZoom(true);

      // Handle Pan
      const bounds = getMaxOffset(scale);
      setPosition((prev) => ({
        x: Math.min(Math.max(prev.x + dx, -bounds.x), bounds.x),
        y: Math.min(Math.max(prev.y + dy, -bounds.y), bounds.y),
      }));
    }
  };

  const handlePointerUp = (e) => {
    // Exit zoom mode if pinched out significantly below fitScale
    if (isZoomed && scale < fitScale * 0.95) {
      setIsZoomed(false);
    }

    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) initialPinchDistance.current = 0;
    if (activePointers.current.size === 0) setIsDraggingZoom(false);
  };

  if (!displayedItem) {
    return (
      <div className="presentation">
        <p className="font-mono text-sm" style={{ color: "var(--color-muted)" }}>
          Loading gallery…
        </p>
      </div>
    );
  }

  // Swipe hint arrow that fades in during drag
  const showHint = isDragging && direction === "horizontal" && swipePower > 0.1;
  const hintDir = dragOffset < 0 ? "next" : "prev";

  // Calculate a scale factor that ensures the visual width is always a flat integer
  const snappedScale =
    isZoomed && naturalSize
      ? Math.ceil(naturalSize.w * scale) / naturalSize.w
      : pixelSize
        ? Math.ceil(pixelSize.width * scale) / pixelSize.width
        : scale;

  return (
    <div
      className="presentation"
      onPointerDown={(e) => {
        if (!e.target.closest(".vjs-control-bar, .vjs-big-play-button, .media-controls"))
          onMediaClick();
      }}
    >
      {/* Shimmer while the full-res asset loads */}
      {loading && (
        <div className="shimmer absolute inset-0" style={{ pointerEvents: "none", zIndex: 1 }} />
      )}

      {/* Directional hint that follows drag intensity */}
      {showHint && (
        <div
          aria-hidden="true"
          className="swipe-hint"
          style={{
            position: "absolute",
            top: "50%",
            [hintDir === "next" ? "right" : "left"]: "var(--ui-gap-x)",
            transform: `translate3d(${
              (hintDir === "next" ? 1 : -1) * (1 - swipePower) * 20
            }px, -50%, 0)`,
            opacity: Math.min(swipePower, 1),
            color: "#FFF",
            fontSize: "4rem",
            fontFamily: "sans-serif",
            pointerEvents: "none",
            textShadow: "0 0px 8px #000",
            zIndex: 10,
          }}
        >
          {hintDir === "next" ? "›" : "‹"}
        </div>
      )}

      {/* Swipe zone - specifically for navigation, separated from UI buttons */}
      <div
        ref={swipeRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: isDragging ? "grabbing" : "grab",
          touchAction: "none",
          zIndex: 0,
        }}
        onPointerDown={handlePointerDown}
      >
        {displayedItem.type === "image" ? (
          <img
            key={displayedItem.src}
            src={displayedItem.src ? assetUrl(displayedItem.src) : ""}
            alt={`${displayedItem.folder} — ${displayedItem.date ?? ""}`}
            decoding="async"
            onLoad={handleLoad}
            draggable={false}
            style={{
              width: pixelSize ? `${pixelSize.width}px` : "auto",
              height: pixelSize ? `${pixelSize.height}px` : "auto",
              maxWidth: pixelSize ? "none" : "100%",
              maxHeight: pixelSize ? "none" : "100%",
              objectFit: "contain",
              opacity: visible ? 1 : 0,
              transform: "none",
              transition: isDragging
                ? "opacity 0.35s ease"
                : "opacity 0.35s ease, transform 0.35s cubic-bezier(0.19, 1, 0.22, 1)",
              userSelect: "none",
              WebkitUserDrag: "none",
              pointerEvents: "none",
              imageRendering: "smooth",
            }}
          />
        ) : (
          <div
            key={displayedItem.src}
            style={{
              width: pixelSize ? `${pixelSize.width}px` : "100%",
              height: pixelSize ? `${pixelSize.height}px` : "100%",
              opacity: visible ? 1 : 0,
              transition: "opacity 0.35s ease",
              "--video-controls-margin": videoControlsMargin,
            }}
          >
            <Player.Provider>
              <MinimalVideoSkin>
                <Video
                  ref={videoRef}
                  src={displayedItem.src ? assetUrl(displayedItem.src) : ""}
                  playsInline
                  onClick={(e) => {
                    // In native fullscreen, the parent div's swipe/tap listeners are unreachable.
                    // We handle the play/pause toggle directly on the fullscreened video element.
                    if (document.fullscreenElement || document.webkitFullscreenElement) {
                      if (
                        e.target.closest(".vjs-control-bar, .vjs-big-play-button, .media-controls")
                      )
                        return;
                      const v = e.currentTarget;
                      if (v.paused) v.play().catch(() => {});
                      else v.pause();
                    }
                  }}
                  loop
                  autoPlay
                  onLoadedData={handleLoad}
                  onVolumeChange={(e) => {
                    persistedVolume.current = e.target.volume;
                    localStorage.setItem("gallery-volume", e.target.volume.toString());
                  }}
                />
              </MinimalVideoSkin>
            </Player.Provider>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help Trigger */}
      {!isZoomed && (
        <button
          className={clsx("zoom-action-btn help-trigger", {
            "shift-up": displayedItem.type !== "image",
          })}
          onClick={onToggleShortcuts}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Show shortcuts"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
      )}

      {/* Zoom control trigger */}
      {displayedItem.type === "image" && !isZoomed && (
        <button
          className={clsx("zoom-action-btn zoom-trigger", { revealed })}
          onClick={() => {
            setIsZoomed(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Zoom image"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </button>
      )}

      {/* Full-screen Zoom Overlay */}
      <div
        className={clsx("zoom-overlay", { active: isZoomed && displayedItem?.type === "image" })}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }} // Prevent browser gestures while zooming
      >
        <button
          className={clsx("zoom-action-btn zoom-exit", { revealed })}
          onClick={() => setIsZoomed(false)}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Exit zoom"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <img
          ref={zoomImgRef}
          key={displayedItem.src}
          src={displayedItem.src ? assetUrl(displayedItem.src) : ""}
          alt="Zoomed media"
          draggable={false}
          onLoad={handleLoad}
          style={{
            width: naturalSize ? `${naturalSize.w}px` : "auto",
            height: naturalSize ? `${naturalSize.h}px` : "auto",
            maxWidth: "none",
            maxHeight: "none",
            transform: `translate3d(${Math.round(position.x)}px, ${Math.round(
              position.y,
            )}px, 0) scale(${snappedScale})`,
            transition: isDraggingZoom ? "none" : "transform 0.4s cubic-bezier(0.19, 1, 0.22, 1)",
            cursor: isDraggingZoom ? "grabbing" : "grab",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        />
      </div>
    </div>
  );
}
