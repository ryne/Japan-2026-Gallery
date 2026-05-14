import React, { useEffect, useRef, useState, useMemo } from "react";
import clsx from "clsx";
import { ThumbCard } from "./ThumbCard.jsx";
import { useSwipe } from "../hooks/useSwipe.js";

import { Swiper, SwiperSlide } from "swiper/react";
import { FreeMode, Mousewheel } from "swiper/modules";
import "swiper/css";
import "swiper/css/free-mode";

/**
 * CarouselStrip
 *
 * The auto-hiding bottom filmstrip.
 * - Mouse: click-and-drag with momentum; clicks suppressed if drag occurred
 * - Touch: native momentum scroll
 * - Thumbnails disable pointer-events while dragging so they can't intercept
 */

export function CarouselStrip({
  manifest,
  flatItems,
  activeIndex,
  onSelect,
  revealed,
  isZoomed,
  dragOffset: globalDragOffset,
  isDragging: isGlobalDragging,
  swipePower: globalSwipePower,
  direction: globalDirection,
  onMouseEnter,
  onMouseLeave,
  onHide,
}) {
  // Add at the top of the component, alongside the existing refs
  const [swiper, setSwiper] = useState(null);
  const [isSwiperDragging, setIsSwiperDragging] = useState(false);
  const lastActiveIndexRef = useRef(null);

  const {
    ref: peekRef,
    dragOffset: localDragOffset,
    isDragging: isPeekDragging,
    swipePower: localSwipePower,
    direction: localDirection,
  } = useSwipe({
    onUp: onMouseEnter, // mapped to reveal
    onDown: onHide,
    onTap: onMouseEnter,
    threshold: 40,
  });

  // Use local dragging state (on peek bar) if active, otherwise fallback to global (on screen)
  const activeDragging = isPeekDragging || isGlobalDragging;
  const activeOffset = isPeekDragging ? localDragOffset : globalDragOffset;
  const activePower = isPeekDragging ? localSwipePower : globalSwipePower;
  const activeDir = isPeekDragging ? localDirection : globalDirection;

  // Dynamic handle styles based on gesture weight
  let handleScale = revealed ? 1.25 : 1;
  let handleOpacity = 0.7;

  if (activeDragging && activeDir === "vertical") {
    if (activeOffset < 0) {
      // Swiping Up: opacity targets 1.0 regardless of current state
      handleOpacity = Math.round((0.7 + 0.3 * activePower) * 10) / 10;
      if (!revealed) {
        handleScale = 1 + 0.25 * activePower;
      }
    } else if (revealed && activeOffset > 0) {
      // Swiping Down: 1.25x -> 1x, 0.7 -> 0.4 opacity
      handleScale = 1.25 - 0.25 * activePower;
      handleOpacity = Math.round((0.7 - 0.3 * activePower) * 10) / 10;
    }
  }

  // Destructure the new manifest shape — guard with fallback for safety
  const folders = manifest?.folders ?? [];

  // Prepare a flat list of slides (Interleaved Dividers and Items)
  const slides = useMemo(() => {
    const list = [];
    let globalIdx = 0;
    folders.forEach((folder, fi) => {
      list.push({ type: "divider", folder, key: `div-${fi}` });
      folder.items.forEach((item) => {
        list.push({
          type: "card",
          item,
          index: globalIdx++,
          key: `${folder.folder}-${item.filename}`,
        });
      });
    });
    return list;
  }, [folders]);

  // Sync Swiper position when activeIndex changes from external sources (arrows, keyboard)
  useEffect(() => {
    if (!swiper || activeIndex === undefined || isSwiperDragging || slides.length === 0) return;

    // Only trigger a slideTo if the activeIndex prop itself has changed.
    // This prevents "snapback" when the user is just scrolling around.
    const hasIndexChanged = activeIndex !== lastActiveIndexRef.current;

    const isInitialSync = lastActiveIndexRef.current === null;

    if (hasIndexChanged || isInitialSync) {
      // Force sync if it's the very first time
      const targetSlideIndex = slides.findIndex(
        (s) => s.type === "card" && s.index === activeIndex,
      );

      if (targetSlideIndex !== -1) {
        lastActiveIndexRef.current = activeIndex;

        if (isInitialSync) {
          // Initialization sync: Swiper Loop mode needs the DOM to be fully settled
          // to calculate centering correctly. We use requestAnimationFrame inside
          // a 150ms timeout to ensure the browser has painted and measured slides
          // before we perform the first snap.
          setTimeout(() => {
            requestAnimationFrame(() => {
              if (swiper && !swiper.destroyed) {
                swiper.update(); // Recalculate dimensions for centeredSlides logic
                swiper.slideToLoop(targetSlideIndex, 0);
              }
            });
          }, 150);
        } else {
          swiper.slideToLoop(targetSlideIndex, 600);
        }
      }
    }
  }, [swiper, activeIndex, slides, isSwiperDragging]);

  // Pre-render the slides to keep the Swiper render loop as lean as possible
  // CRITICAL: SwiperSlide must be a direct child of Swiper.
  // We map them here directly to ensure Swiper detects them for loop/drag.
  const renderedSlides = useMemo(() => {
    return slides.map((slide) => {
      if (slide.type === "divider") {
        return (
          <SwiperSlide key={slide.key} className="w-auto">
            <div className="section-divider" aria-hidden="true">
              <div className="section-divider-line" />
              <span className="section-divider-label">{slide.folder.label}</span>
              <div className="section-divider-line" />
            </div>
          </SwiperSlide>
        );
      }

      const isActive = slide.index === activeIndex;
      return (
        <SwiperSlide key={slide.key} className={clsx("w-auto", { "is-selected": isActive })}>
          <div role="option" aria-selected={isActive}>
            <ThumbCard
              item={slide.item}
              isActive={isActive}
              onClick={() => onSelect(slide.index)}
            />
          </div>
        </SwiperSlide>
      );
    });
  }, [slides, activeIndex, onSelect]);

  return (
    <div
      className={clsx("carousel-strip", { revealed, "is-zoomed": isZoomed })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Peek bar */}
      <div ref={peekRef} className="carousel-peek-bar" aria-label="Show gallery">
        <div
          className={clsx("carousel-peek-handle", { "is-dragging": activeDragging })}
          style={{
            transform: `scale(${handleScale})`,
            opacity: handleOpacity,
          }}
        />
      </div>

      {/* Swiper Filmstrip */}
      <Swiper
        onSwiper={setSwiper}
        modules={[FreeMode, Mousewheel]}
        freeMode={{
          enabled: true,
          momentumRatio: 0.5,
          momentumVelocityRatio: 0.5,
        }}
        mousewheel={{ forceToAxis: true }}
        roundLengths={true} // Prevents blurry text/images and sub-pixel jitter
        slidesPerView="auto"
        spaceBetween={0}
        centeredSlides={true}
        loop={true}
        nested={true} // Better isolation for event bubbling
        touchReleaseOnEdges={true}
        resistanceRatio={0} // Makes the edges feel cleaner during flicks
        // Use discrete events to avoid constant re-renders during drag
        onDragStart={() => setIsSwiperDragging(true)}
        onDragEnd={() => setIsSwiperDragging(false)}
        onTouchStart={() => {
          /* Swiper handles internally */
        }}
        onTransitionEnd={() => setIsSwiperDragging(false)}
        // Performance optimizations
        watchSlidesProgress={true}
        touchStartPreventDefault={false}
        className={clsx("carousel-inner", { dragging: isSwiperDragging })}
        // Stop all pointer events from bubbling to the main swipe listener
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Media gallery"
      >
        {renderedSlides}
      </Swiper>
    </div>
  );
}
