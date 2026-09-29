import React, { useCallback, useEffect, useRef, useState } from "react";

// Drop partner logo files into src/assets/partners/ — they are picked up automatically.
// The file name becomes the alt text (see NAMES below for overrides); prefix with numbers
// to control order (e.g. "01-ibm.png"). The section hides itself while the folder is empty.
const files = import.meta.glob('../assets/partners/*.{png,jpg,jpeg,webp,svg}', { eager: true, import: 'default' })

// Proper names for known logos; any other file falls back to a title-cased file name.
const NAMES = {
  aws: 'Amazon Web Services',
  coedf: 'Valiant Vooro Center of Excellence in Digital Forensics',
  csi: 'Computer Society of India',
  ibm: 'IBM',
  iei: 'The Institution of Engineers (India)',
  microsoft: 'Microsoft',
  'oracle-academy': 'Oracle Academy',
  'red-hat': 'Red Hat',
  cisco: 'Cisco',
  acm: 'ACM (Association for Computing Machinery)',
  'advantage-pro': 'Advantage Pro by Vectra Technosoft',
  'smb-hosting': 'SMB Hosting Solutions',
}

const PARTNERS = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, src]) => {
    const base = path.split('/').pop().replace(/\.[^.]+$/, '').replace(/^\d+[-_ ]*/, '')
    const name = NAMES[base.toLowerCase()] || base.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    return { src, name }
  })

const AUTOPLAY_MS = 2800

export default function Partners() {
  const trackRef = useRef(null)
  const drag = useRef(null)
  const resumeTimer = useRef(null)
  const [paused, setPaused] = useState(false)
  const [edges, setEdges] = useState({ start: true, end: false })
  const [page, setPage] = useState({ index: 0, count: 1 })

  const step = () => {
    const el = trackRef.current
    const tile = el?.querySelector('.partners__tile')
    return tile ? tile.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0) : 240
  }

  const updateEdges = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const perView = Math.max(1, Math.round(el.clientWidth / step()))
    const atEnd = el.scrollLeft >= max - 2
    const count = Math.max(1, PARTNERS.length - perView + 1)
    setEdges({ start: el.scrollLeft <= 2, end: atEnd })
    setPage({ index: atEnd ? count - 1 : Math.min(count - 1, Math.round(el.scrollLeft / step())), count })
  }, [])

  // Move by one tile; wraps around at either end so the carousel loops.
  const go = useCallback(dir => {
    const el = trackRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    if (dir > 0 && el.scrollLeft >= max - 2) el.scrollTo({ left: 0, behavior: 'smooth' })
    else if (dir < 0 && el.scrollLeft <= 2) el.scrollTo({ left: max, behavior: 'smooth' })
    else el.scrollBy({ left: dir * step(), behavior: 'smooth' })
  }, [])

  const goTo = i => trackRef.current?.scrollTo({ left: i * step(), behavior: 'smooth' })

  useEffect(() => {
    updateEdges()
    window.addEventListener('resize', updateEdges)
    return () => {
      window.removeEventListener('resize', updateEdges)
      clearTimeout(resumeTimer.current)
    }
  }, [updateEdges])

  // Autoplay, paused while hovered/focused/dragged, when the tab is hidden, or for reduced motion.
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => { if (!document.hidden) go(1) }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [paused, go])

  // Mouse drag-to-scroll (touch devices already swipe natively).
  const onPointerDown = e => {
    if (e.pointerType !== 'mouse') return
    drag.current = { x: e.clientX, left: trackRef.current.scrollLeft }
    trackRef.current.classList.add('is-dragging')
  }
  const onPointerMove = e => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    trackRef.current.scrollLeft = drag.current.left - dx
  }
  const endDrag = () => {
    if (!drag.current) return
    drag.current = null
    trackRef.current.classList.remove('is-dragging')
  }

  const onKeyDown = e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  }

  if (!PARTNERS.length) return null

  return (
    <section id="partners" className="section partners" aria-roledescription="carousel" aria-label="Technical Partners">
      <div className="wrap partners__head">
        <div>
          <div className="kicker">Supported by</div>
          <h2 className="h2">Technical Partners</h2>
        </div>
        <div className="partners__arrows">
          <button className="partners__arrow" onClick={() => go(-1)} aria-label="Previous partner">←</button>
          <button className="partners__arrow" onClick={() => go(1)} aria-label="Next partner">→</button>
        </div>
      </div>

      <div
        className={'partners__viewport' + (edges.start ? ' at-start' : '') + (edges.end ? ' at-end' : '')}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); endDrag() }}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={() => { clearTimeout(resumeTimer.current); setPaused(true) }}
        onTouchEnd={() => { resumeTimer.current = setTimeout(() => setPaused(false), 4000) }}
      >
        <ul
          ref={trackRef}
          className="partners__track"
          tabIndex={0}
          aria-label="Partner logos — use arrow keys or swipe to scroll"
          onScroll={updateEdges}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onDragStart={e => e.preventDefault()}
        >
          {PARTNERS.map((p, i) => (
            <li key={p.name} className="partners__tile" aria-roledescription="slide" aria-label={`${i + 1} of ${PARTNERS.length}: ${p.name}`}>
              <img src={p.src} alt={p.name} title={p.name} draggable="false" />
            </li>
          ))}
        </ul>
      </div>

      {page.count > 1 && (
        <div className="partners__dots" role="tablist" aria-label="Choose position">
          {Array.from({ length: page.count }, (_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={page.index === i}
              aria-label={`Go to position ${i + 1}`}
              className={'partners__dot' + (page.index === i ? ' is-active' : '')}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
