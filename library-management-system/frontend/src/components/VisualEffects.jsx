import { useEffect } from 'react';

const REVEAL_SELECTOR = [
    '.hero-copy > *',
    '.section-head',
    '.section-center',
    '.book-card',
    '.feature-grid > div',
    '.stats-grid > div',
    '.catalog-toolbar',
    '.filters',
    '.detail-cover',
    '.detail-content > *',
    '.about-story > *',
    '.values > div',
    '.member-stats > div',
    '.admin-title > *',
    '.admin-stats > div',
    '.admin-grid > *',
    '.settings-card',
    '.loan-cards article',
    '.auth-form > *'
].join(',');

const SPOTLIGHT_SELECTOR = [
    '.book-card',
    '.feature-grid > div',
    '.admin-stats > div',
    '.member-stats > div',
    '.panel',
    '.settings-card',
    '.values > div'
].join(',');

export default function VisualEffects({ routeKey }) {
    useEffect(() => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const aura = document.querySelector('.cursor-aura');
        let auraFrame = 0;
        let spotlightFrame = 0;
        let activeSpotlight = null;
        let revealSequence = 0;

        function moveAura(event) {
            if (!aura || reducedMotion || !canHover) return;
            window.cancelAnimationFrame(auraFrame);
            auraFrame = window.requestAnimationFrame(() => {
                aura.style.transform = `translate3d(${event.clientX - 170}px, ${event.clientY - 170}px, 0)`;
                aura.classList.add('visible');
            });
        }

        function hideAura() {
            aura?.classList.remove('visible');
        }

        let observer;

        if (!reducedMotion && 'IntersectionObserver' in window) {
            observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('is-revealed');
                            observer.unobserve(entry.target);
                        }
                    });
                },
                { rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
            );
        }

        function registerRevealItems(root = document) {
            const candidates = [];

            if (root.nodeType === Node.ELEMENT_NODE && root.matches?.(REVEAL_SELECTOR)) {
                candidates.push(root);
            }

            root.querySelectorAll?.(REVEAL_SELECTOR).forEach(item => candidates.push(item));

            candidates.forEach(item => {
                if (item.dataset.revealReady === 'true') return;
                item.dataset.revealReady = 'true';
                item.classList.add('reveal-item');
                item.style.setProperty('--reveal-delay', `${(revealSequence % 5) * 55}ms`);
                revealSequence += 1;

                if (reducedMotion || !observer) {
                    item.classList.add('is-revealed');
                } else {
                    observer.observe(item);
                }
            });
        }

        registerRevealItems(document);

        const mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) registerRevealItems(node);
                });
            });
        });

        const stage = document.querySelector('.route-stage');
        if (stage) mutationObserver.observe(stage, { childList: true, subtree: true });

        function updateSpotlight(event) {
            if (!canHover || reducedMotion) return;
            const target = event.target.closest?.(SPOTLIGHT_SELECTOR);

            if (activeSpotlight && activeSpotlight !== target) {
                activeSpotlight.classList.remove('spotlight-active');
            }

            activeSpotlight = target || null;
            if (!activeSpotlight) return;

            window.cancelAnimationFrame(spotlightFrame);
            spotlightFrame = window.requestAnimationFrame(() => {
                if (!activeSpotlight) return;
                const rect = activeSpotlight.getBoundingClientRect();
                activeSpotlight.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
                activeSpotlight.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
                activeSpotlight.classList.add('spotlight-active');
            });
        }

        function clearSpotlight(event) {
            if (!activeSpotlight) return;
            const nextTarget = event.relatedTarget;
            if (!nextTarget || !activeSpotlight.contains(nextTarget)) {
                activeSpotlight.classList.remove('spotlight-active');
                activeSpotlight = null;
            }
        }

        if (canHover && !reducedMotion) {
            window.addEventListener('pointermove', moveAura, { passive: true });
            document.addEventListener('pointermove', updateSpotlight, { passive: true });
            document.addEventListener('pointerout', clearSpotlight, { passive: true });
            document.documentElement.addEventListener('mouseleave', hideAura);
        }

        return () => {
            observer?.disconnect();
            mutationObserver.disconnect();
            window.cancelAnimationFrame(auraFrame);
            window.cancelAnimationFrame(spotlightFrame);
            activeSpotlight?.classList.remove('spotlight-active');
            window.removeEventListener('pointermove', moveAura);
            document.removeEventListener('pointermove', updateSpotlight);
            document.removeEventListener('pointerout', clearSpotlight);
            document.documentElement.removeEventListener('mouseleave', hideAura);
        };
    }, [routeKey]);

    return <span className="cursor-aura" aria-hidden="true" />;
}
