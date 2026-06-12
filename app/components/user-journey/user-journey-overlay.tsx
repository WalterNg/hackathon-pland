"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useUserJourney } from "./user-journey-context";
import { MaterialIcon } from "../dashboard/material-icon";

type Rect = { top: number; left: number; width: number; height: number };

const PADDING = 12;
const TOOLTIP_W = 480;
const CENTERED_W = 560;
const TOOLTIP_H_ESTIMATE = 320;

function getTargetRect(target: string | null, padding: number): Rect | null {
  if (!target) return null;
  // Support comma-separated selectors — computes union bounding box
  const selectors = target.split("||").map((s) => s.trim());
  const rects = selectors
    .map((s) => document.querySelector<HTMLElement>(s)?.getBoundingClientRect())
    .filter((r): r is DOMRect => !!r);
  if (rects.length === 0) return null;
  const minTop = Math.min(...rects.map((r) => r.top));
  const minLeft = Math.min(...rects.map((r) => r.left));
  const maxBottom = Math.max(...rects.map((r) => r.bottom));
  const maxRight = Math.max(...rects.map((r) => r.right));
  return {
    top: minTop - padding,
    left: minLeft - padding,
    width: maxRight - minLeft + padding * 2,
    height: maxBottom - minTop + padding * 2,
  };
}

function computeTooltipPosition(
  rect: Rect | null,
  placement: string | undefined,
  vpW: number,
  vpH: number
): { top: number; left: number; transformOrigin: string } {
  if (!rect || placement === "center" || !placement) {
    return {
      top: vpH / 2 - TOOLTIP_H_ESTIMATE / 2,
      left: vpW / 2 - CENTERED_W / 2,
      transformOrigin: "center",
    };
  }

  const GAP = 14;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "bottom":
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case "top":
      top = rect.top - TOOLTIP_H_ESTIMATE - GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - TOOLTIP_H_ESTIMATE / 2;
      left = rect.left - TOOLTIP_W - GAP;
      break;
    case "right":
      top = rect.top + rect.height / 2 - TOOLTIP_H_ESTIMATE / 2;
      left = rect.left + rect.width + GAP;
      break;
    default:
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  }

  left = Math.max(16, Math.min(left, vpW - TOOLTIP_W - 16));
  top = Math.max(16, Math.min(top, vpH - TOOLTIP_H_ESTIMATE - 16));

  return { top, left, transformOrigin: "top center" };
}

export function UserJourneyOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    endJourney,
  } = useUserJourney();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const rafRef = useRef<number | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updateRect = useCallback(() => {
    if (!isActive || !currentStep) return;
    const padding = currentStep.padding ?? PADDING;
    let rect = getTargetRect(currentStep.target, padding);
    if (rect && currentStep.rectAdjust) {
      const a = currentStep.rectAdjust;
      const topAdj  = a.top    ?? 0;
      const leftAdj = a.left   ?? 0;
      const rightAdj  = a.right  ?? 0;
      const bottomAdj = a.bottom ?? 0;
      rect = {
        top:    rect.top    - topAdj,
        left:   rect.left   - leftAdj,
        width:  rect.width  + leftAdj + rightAdj,
        height: rect.height + topAdj  + bottomAdj,
      };
    }
    setTargetRect(rect);
    setVpSize({ w: window.innerWidth, h: window.innerHeight });

    if (rect && currentStep.target) {
      // Use first selector only (target may be "sel1 || sel2" for union rects)
      const firstSelector = currentStep.target.split("||")[0].trim();
      const el = document.querySelector<HTMLElement>(firstSelector);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) {
      setTargetRect(null);
      return;
    }
    const actions = currentStep?.enterActions ?? [];
    if (actions.length > 0) {
      let totalDelay = 0;
      actions.forEach(({ selector, delay: d = 0 }) => {
        totalDelay += d;
        setTimeout(() => {
          (document.querySelector<HTMLElement>(selector))?.click();
        }, totalDelay);
      });
      const rectDelay = totalDelay + (currentStep?.delay ?? 300);
      const id = setTimeout(() => updateRect(), rectDelay);
      return () => clearTimeout(id);
    }
    const delay = currentStep?.delay ?? 120;
    const id = setTimeout(() => updateRect(), delay);
    return () => clearTimeout(id);
  }, [isActive, currentStep, updateRect]);

  useEffect(() => {
    if (!isActive) return;
    const onScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateRect);
    };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [isActive, updateRect]);

  // Direct click listener for advanceOnSpotlightClick / advanceOnClickSelector steps
  useEffect(() => {
    const rawSelector = currentStep?.advanceOnClickSelector
      ?? (currentStep?.advanceOnSpotlightClick ? currentStep.target : null);
    // Use first selector only for event binding
    const selector = rawSelector ? rawSelector.split("||")[0].trim() : null;
    if (!isActive || !selector) return;
    let el: HTMLElement | null = null;
    const handler = () => setTimeout(() => nextStep(), 400);
    const attach = () => {
      el = document.querySelector<HTMLElement>(selector);
      if (!el) return false;
      el.addEventListener("click", handler, { once: true });
      return true;
    };
    if (!attach()) {
      const interval = setInterval(() => { if (attach()) clearInterval(interval); }, 100);
      return () => clearInterval(interval);
    }
    return () => el?.removeEventListener("click", handler);
  }, [isActive, currentStep, nextStep]);

  const handleNext = useCallback(() => {
    if (currentStep?.autoClickTargetOnNext && currentStep.target) {
      const firstSelector = currentStep.target.split("||")[0].trim();
      const el = document.querySelector<HTMLElement>(firstSelector);
      if (el) {
        el.click();
        setTimeout(() => nextStep(), 80);
        return;
      }
    }
    nextStep();
  }, [currentStep, nextStep]);

  if (!isActive || !currentStep) return null;

  const { w: vpW, h: vpH } = vpSize;
  const tooltipPos = computeTooltipPosition(
    targetRect,
    currentStep.placement,
    vpW || window.innerWidth,
    vpH || window.innerHeight
  );

  const r = targetRect;
  const borderRadius = 12;
  const isCentered = !targetRect || currentStep?.placement === "center";

  return (
    <>
      {/* Dark backdrop with spotlight cut-out (z-9998, behind modals) */}
      <div className="fixed inset-0 z-[9998] pointer-events-none" aria-hidden="true">
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
          <defs>
            <mask id="journey-spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {r && (
                <rect
                  x={r.left} y={r.top}
                  width={r.width} height={r.height}
                  rx={borderRadius} ry={borderRadius}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%" height="100%"
            fill="rgba(0,0,0,0.72)"
            mask="url(#journey-spotlight-mask)"
          />
        </svg>
      </div>

      {/* Spotlight ring — rendered ABOVE modals (z-10002) so it's always visible */}
      {r && (
        <svg
          className="fixed inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10004 }}
          aria-hidden="true"
        >
          <rect
            x={r.left} y={r.top}
            width={r.width} height={r.height}
            rx={borderRadius} ry={borderRadius}
            fill="none"
            stroke="rgba(74, 222, 128, 0.7)"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
      )}

      {/* Click-blocker — passes clicks inside spotlight to the real element */}
      <div
        className="fixed inset-0 z-[9999]"
        style={{ pointerEvents: "auto" }}
        onClick={(e) => {
          if (targetRect) {
            const { clientX, clientY } = e;
            const inSpotlight =
              clientX >= targetRect.left &&
              clientX <= targetRect.left + targetRect.width &&
              clientY >= targetRect.top &&
              clientY <= targetRect.top + targetRect.height;
            if (inSpotlight) {
              // Find the actual element under the cursor by briefly disabling this blocker
              const blocker = e.currentTarget as HTMLElement;
              blocker.style.pointerEvents = "none";
              const realEl = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
              blocker.style.pointerEvents = "auto";
              realEl?.click();
              // Auto-advance if this step requests it
              if (currentStep?.advanceOnSpotlightClick) {
                setTimeout(() => nextStep(), 400);
              }
              return;
            }
          }
          e.stopPropagation();
        }}
      />

      {/* Tooltip card (z-10003, above modals and ring) */}
      <div
        ref={tooltipRef}
        className={`fixed z-[10005] ${isCentered ? "w-[560px]" : "w-[480px]"} rounded-2xl border border-white/10 bg-[#12151f] shadow-[0_24px_64px_rgba(0,0,0,0.7)] backdrop-blur-md`}
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          transformOrigin: tooltipPos.transformOrigin,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="h-1 w-full rounded-t-2xl overflow-hidden bg-white/5">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Header */}
          <div className="mb-5 flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold text-strong leading-snug">
              {currentStep.title}
            </h3>
            <button
              type="button"
              onClick={endJourney}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10 text-muted hover:text-strong transition-colors"
              aria-label="Close tour"
            >
              <MaterialIcon name="close" outlined={false} className="text-base" />
            </button>
          </div>

          {/* Description */}
          <p className="text-[0.95rem] leading-[1.75] text-muted">
            {currentStep.description}
          </p>

          {/* Footer */}
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <span
                  key={i}
                  className={`block rounded-full transition-all duration-200 ${
                    i === currentStepIndex
                      ? "w-4 h-1.5 bg-primary"
                      : "w-1.5 h-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted/60 tabular-nums">
                {currentStepIndex + 1} / {totalSteps}
              </span>
              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-semibold text-muted hover:bg-white/8 hover:text-strong transition-colors"
                  >
                    <MaterialIcon name="arrow_back" outlined={false} className="text-sm" />
                    Back
                  </button>
                )}
                {!currentStep?.hideNext && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-semibold text-[var(--text-on-primary)] hover:brightness-110 transition-all shadow-[0_2px_10px_-3px_rgba(74,222,128,0.5)]"
                  >
                    {currentStepIndex === totalSteps - 1 ? "Done 🎉" : "Next"}
                    {currentStepIndex < totalSteps - 1 && (
                      <MaterialIcon name="arrow_forward" outlined={false} className="text-sm" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
