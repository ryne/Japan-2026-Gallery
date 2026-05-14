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
  onNext,
  onPrev,
}) {
  // Add at the top of the component, alongside the existing refs
  const [swiper, setSwiper] = useState(null);
  const [isSwiperDragging, setIsSwiperDragging] = useState(false);
  const lastActiveIndexRef = useRef(activeIndex);

  const {
    ref: peekRef,
    dragOffset: localDragOffset,
    isDragging: isPeekDragging,
    swipePower: localSwipePower,
    direction: localDirection,
  } = useSwipe({
    onUp: onMouseEnter, // mapped to reveal
    onDown: onHide,
    onNext: onNext,
    onPrev: onPrev,
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
    // We also check for 'swiper.animating' to ensure we don't interrupt a momentum flick
    if (!swiper || activeIndex === undefined || isSwiperDragging || swiper.animating) return;

    // Only trigger a slideTo if the activeIndex prop itself has changed.
    // This prevents "snapback" when the user is just scrolling around.
    const hasIndexChanged = activeIndex !== lastActiveIndexRef.current;

    if (hasIndexChanged) {
      lastActiveIndexRef.current = activeIndex;
      setIsSwiperDragging(false); // Reset just in case

      const targetSlideIndex = slides.findIndex(
        (s) => s.type === "card" && s.index === activeIndex,
      );
      if (targetSlideIndex !== -1) {
        // slideToLoop ensures we go to the correct real index in a looped carousel
        swiper.slideToLoop(targetSlideIndex, 600);
      }
    }
  }, [swiper, activeIndex, slides, isSwiperDragging]);

  // Pre-render the slides to keep the Swiper render loop as lean as possible
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
        <SwiperSlide key={slide.key} className="w-auto">
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
  }, [slides, activeIndex]); // Removed onSelect to prevent cache invalidation if parent re-renders

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
        spaceBetween={6}
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
        // Only stop propagation if we are touching a thumbnail to allow
        // vertical reveal gestures to bubble from the carousel area
        onPointerDown={(e) => {
          if (e.target.closest(".thumb-card")) e.stopPropagation();
        }}
        aria-label="Media gallery"
      >
        {renderedSlides}
      </Swiper>
    </div>
  );
}
