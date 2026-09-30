import { useEffect, useRef } from "react";

const revealTargets = [
  ".section-heading",
  ".about > .container > .eyebrow",
  ".about-layout > *",
  ".alliance-strip > *",
  ".stats-strip .container > *",
  ".domain-card",
  ".challenge-toolbar",
  ".challenge-card",
  ".timeline-intro",
  ".timeline-item",
  ".prize-card",
  ".faq-layout > div:first-child",
  ".faq-list > details",
  ".register-intro",
  ".registration-panel",
  ".footer-top > *",
].join(",");
export default function useScrollMotion() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || !("IntersectionObserver" in window)) return;

    function start() {
      // Content is visible by default; only enhance when motion is supported.
      if (preference.matches) return () => {};

      const elements = new Set();
      const progress = root.querySelector(".scroll-progress");
      const hero = root.querySelector(".hero");
      const visual = root.querySelector(".hero-visual");
      const timeline = root.querySelector(".timeline-list");
      const wordmark = root.querySelector(".footer-wordmark");
      let frame = 0;
      root.dataset.scrollMotion = "active";

      function reveal(element) {
        element.dataset.reveal = "visible";
        observer.unobserve(element);
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) reveal(entry.target);
          }
        },
        { threshold: 0.08, rootMargin: "0px 0px -28px 0px" },
      );

      function discover() {
        root.querySelectorAll(revealTargets).forEach((element) => {
          if (elements.has(element)) return;
          elements.add(element);
          const siblings = [...element.parentElement.children].filter((child) =>
            child.matches(revealTargets),
          );
          const index = siblings.indexOf(element);
          // Bound stagger delays so larger lists remain responsive to scrolling.
          element.style.setProperty("--reveal-delay", `${(index % 4) * 80}ms`);
          element.dataset.reveal = "pending";
          observer.observe(element);
          if (element.contains(document.activeElement)) reveal(element);
        });
        schedule();
      }

      function update() {
        frame = 0;
        const viewport = window.innerHeight;
        const maxScroll = document.documentElement.scrollHeight - viewport;
        progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0})`;

        const heroRect = hero.getBoundingClientRect();
        if (heroRect.bottom > 0) {
          const distance = Math.min(85, Math.max(0, -heroRect.top) * 0.16);
          visual.style.setProperty("--hero-drift", `${distance}px`);
        }

        const timelineRect = timeline.getBoundingClientRect();
        const timelineProgress = Math.min(
          1,
          Math.max(
            0,
            (viewport * 0.65 - timelineRect.top) / timelineRect.height,
          ),
        );
        timeline.style.setProperty("--timeline-progress", timelineProgress);
        timeline.querySelectorAll(".timeline-item").forEach((item) => {
          item.classList.toggle(
            "checkpoint-reached",
            item.getBoundingClientRect().top < viewport * 0.65,
          );
        });

        const footerTop = wordmark.getBoundingClientRect().top;
        if (footerTop < viewport) {
          wordmark.style.setProperty(
            "--wordmark-drift",
            `${Math.min(22, Math.max(0, viewport - footerTop) * 0.05)}px`,
          );
        }
      }

      function schedule() {
        if (!frame) frame = requestAnimationFrame(update);
      }

      // Reveals also apply to cards inserted by filters or “Explore all”.
      const mutations = new MutationObserver((records) => {
        if (
          records.some((record) =>
            [...record.addedNodes].some((node) => node.nodeType === 1),
          )
        )
          discover();
      });
      mutations.observe(root, { childList: true, subtree: true });
      const resize = new ResizeObserver(schedule);
      resize.observe(root);

      function onFocus(event) {
        const element = event.target.closest('[data-reveal="pending"]');
        if (element) reveal(element);
      }

      discover();
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", schedule);
      root.addEventListener("focusin", onFocus);
      return () => {
        observer.disconnect();
        mutations.disconnect();
        resize.disconnect();
        cancelAnimationFrame(frame);
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", schedule);
        root.removeEventListener("focusin", onFocus);
        delete root.dataset.scrollMotion;
        elements.forEach((element) => {
          delete element.dataset.reveal;
          element.style.removeProperty("--reveal-delay");
        });
        visual.style.removeProperty("--hero-drift");
        wordmark.style.removeProperty("--wordmark-drift");
        timeline.style.removeProperty("--timeline-progress");
        timeline
          .querySelectorAll(".checkpoint-reached")
          .forEach((item) => item.classList.remove("checkpoint-reached"));
      };
    }

    let stop = start();
    const onPreferenceChange = () => {
      stop();
      stop = start();
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      stop();
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return rootRef;
}
