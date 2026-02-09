import { memo, useEffect, useId, useLayoutEffect, useRef, useState, useCallback } from 'react';

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;

  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  }
  const int = parseInt(h, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Throttle RAF calls to reduce CPU usage
function throttleRAF(callback) {
  let ticking = false;
  return (...args) => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        callback(...args);
        ticking = false;
      });
      ticking = true;
    }
  };
}

const ElectricBorder = memo(({ children, color = '#5227FF', speed = 1, chaos = 1, thickness = 2, className, style }) => {
  const rawId = useId().replace(/[:]/g, '');
  const filterId = `turbulent-displace-${rawId}`;
  const svgRef = useRef(null);
  const rootRef = useRef(null);
  const strokeRef = useRef(null);
  const [isVisible, setIsVisible] = useState(true);
  const rafIdRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  const updateAnim = useCallback(() => {
    const svg = svgRef.current;
    const host = rootRef.current;
    if (!svg || !host) return;

    // Pause animations when not visible
    if (!isVisible) return;

    if (strokeRef.current) {
      strokeRef.current.style.filter = `url(#${filterId})`;
    }

    const rect = host.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || 0));
    const height = Math.max(1, Math.round(rect.height || 0));

    const dyAnims = svg.querySelectorAll('feOffset > animate[attributeName="dy"]');
    const dxAnims = svg.querySelectorAll('feOffset > animate[attributeName="dx"]');

    if (dyAnims.length >= 2) {
      dyAnims[0].setAttribute('values', `${height}; 0`);
      dyAnims[1].setAttribute('values', `0; -${height}`);
    }

    if (dxAnims.length >= 2) {
      dxAnims[0].setAttribute('values', `${width}; 0`);
      dxAnims[1].setAttribute('values', `0; -${width}`);
    }

    const baseDur = 6;
    const dur = Math.max(0.001, baseDur / (speed || 1));
    dyAnims.forEach(a => a.setAttribute('dur', `${dur}s`));
    dxAnims.forEach(a => a.setAttribute('dur', `${dur}s`));

    const disp = svg.querySelector('feDisplacementMap');
    if (disp) disp.setAttribute('scale', String(30 * (chaos || 1)));

    const filterEl = svg.querySelector(`#${CSS.escape(filterId)}`);
    if (filterEl) {
      filterEl.setAttribute('x', '-200%');
      filterEl.setAttribute('y', '-200%');
      filterEl.setAttribute('width', '500%');
      filterEl.setAttribute('height', '500%');
    }

    // Cancel previous RAF
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      [...dyAnims, ...dxAnims].forEach(a => {
        if (typeof a.beginElement === 'function') {
          try {
            a.beginElement();
          } catch {
            // Silent fail
          }
        }
      });
    });
  }, [filterId, speed, chaos, isVisible]);

  // Throttled version for resize
  const throttledUpdateAnim = useCallback(throttleRAF(updateAnim), [updateAnim]);

  useEffect(() => {
    updateAnim();
  }, [updateAnim]);

  // Intersection Observer - pause animations when not visible
  // Observer ref to persist across renders for proper cleanup
  const observerRef = useRef(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: '50px' }
    );

    observerRef.current = observer;
    observer.observe(rootRef.current);

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!rootRef.current) return;

    // Debounced ResizeObserver - wait for resize to finish
    const ro = new ResizeObserver(() => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        throttledUpdateAnim();
      }, 100);
    });

    ro.observe(rootRef.current);

    return () => {
      ro.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [throttledUpdateAnim]);

  const inheritRadius = {
    borderRadius: style?.borderRadius ?? 'inherit'
  };

  // GPU-accelerated styles with CSS containment
  const containerStyle = {
    ...style,
    contain: 'layout style paint',
    willChange: 'transform',
    transform: 'translateZ(0)',
  };

  const strokeStyle = {
    ...inheritRadius,
    borderWidth: thickness,
    borderStyle: 'solid',
    borderColor: color,
    willChange: 'filter',
    transform: 'translateZ(0)',
  };

  // Reduced blur complexity for better performance
  const glow1Style = {
    ...inheritRadius,
    borderWidth: thickness,
    borderStyle: 'solid',
    borderColor: hexToRgba(color, 0.6),
    filter: `blur(${Math.min(2, 0.5 + thickness * 0.25)}px)`,
    opacity: 0.5,
    willChange: 'opacity',
    transform: 'translateZ(0)',
  };

  const glow2Style = {
    ...inheritRadius,
    borderWidth: thickness,
    borderStyle: 'solid',
    borderColor: color,
    filter: `blur(${Math.min(4, 2 + thickness * 0.5)}px)`,
    opacity: 0.4,
    willChange: 'opacity',
    transform: 'translateZ(0)',
  };

  // Simplified background glow
  const bgGlowStyle = {
    ...inheritRadius,
    transform: 'scale(1.05) translateZ(0)',
    filter: 'blur(16px)',
    opacity: 0.25,
    zIndex: -1,
    background: `radial-gradient(circle at center, ${hexToRgba(color, 0.6)}, transparent 70%)`,
    willChange: 'opacity',
  };

  // When not visible, render simplified version without animations
  if (!isVisible) {
    return (
      <div className={'relative ' + (className ?? '')} style={containerStyle}>
        <div
          className="absolute inset-0 box-border"
          style={{
            ...inheritRadius,
            border: `${thickness}px solid ${color}`,
          }}
        />
        <div className="relative" style={inheritRadius}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={'relative isolate ' + (className ?? '')} style={containerStyle}>
      <svg
        ref={svgRef}
        className="fixed -left-[10000px] -top-[10000px] w-[10px] h-[10px] opacity-[0.001] pointer-events-none"
        aria-hidden
        focusable="false"
      >
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="1" />
            <feOffset in="noise1" dx="0" dy="0" result="offsetNoise1">
              <animate attributeName="dy" values="700; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="1" />
            <feOffset in="noise2" dx="0" dy="0" result="offsetNoise2">
              <animate attributeName="dy" values="0; -700" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise1" seed="2" />
            <feOffset in="noise1" dx="0" dy="0" result="offsetNoise3">
              <animate attributeName="dx" values="490; 0" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="10" result="noise2" seed="2" />
            <feOffset in="noise2" dx="0" dy="0" result="offsetNoise4">
              <animate attributeName="dx" values="0; -490" dur="6s" repeatCount="indefinite" calcMode="linear" />
            </feOffset>
            <feComposite in="offsetNoise1" in2="offsetNoise2" result="part1" />
            <feComposite in="offsetNoise3" in2="offsetNoise4" result="part2" />
            <feBlend in="part1" in2="part2" mode="color-dodge" result="combinedNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="combinedNoise"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="B"
            />
          </filter>
        </defs>
      </svg>
      <div className="absolute inset-0 pointer-events-none" style={inheritRadius}>
        <div ref={strokeRef} className="absolute inset-0 box-border" style={strokeStyle} />
        <div className="absolute inset-0 box-border" style={glow1Style} />
        <div className="absolute inset-0 box-border" style={glow2Style} />
        <div className="absolute inset-0" style={bgGlowStyle} />
      </div>
      <div className="relative" style={inheritRadius}>
        {children}
      </div>
    </div>
  );
});

ElectricBorder.displayName = 'ElectricBorder';

export default ElectricBorder;

