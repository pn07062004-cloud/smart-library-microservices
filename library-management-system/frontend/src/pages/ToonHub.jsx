import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import './ToonHub.css';

const IMAGES = [
    {
        name: 'Milo',
        title: 'Bubble Rogue',
        tag: 'Series 01',
        url: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1100&auto=format&fit=crop',
        bg: '#f3a53f',
        accent: '#ffe7b8'
    },
    {
        name: 'Kiki',
        title: 'Candy Pilot',
        tag: 'Limited Drop',
        url: 'https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=1100&auto=format&fit=crop',
        bg: '#ef6f9f',
        accent: '#ffd7e6'
    },
    {
        name: 'Nox',
        title: 'Moon Runner',
        tag: 'Vinyl Hero',
        url: 'https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1100&auto=format&fit=crop',
        bg: '#6a74e8',
        accent: '#dfe2ff'
    },
    {
        name: 'Zuzu',
        title: 'Mint Keeper',
        tag: 'Fresh Batch',
        url: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1100&auto=format&fit=crop',
        bg: '#24b99a',
        accent: '#d5fff4'
    }
];

const ANIMATION_MS = 650;

export default function ToonHub() {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
    const [isPaused, setIsPaused] = useState(false);
    const touchStartX = useRef(null);
    const lockTimer = useRef(null);
    const autoplayTimer = useRef(null);

    useEffect(() => {
        IMAGES.forEach(item => {
            const image = new Image();
            image.src = item.url;
        });
    }, []);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        return () => window.clearTimeout(lockTimer.current);
    }, []);

    const activeItem = IMAGES[activeIndex];

    function goTo(nextIndex) {
        if (isAnimating || nextIndex === activeIndex) return;
        setIsAnimating(true);
        setActiveIndex((nextIndex + IMAGES.length) % IMAGES.length);
        window.clearTimeout(lockTimer.current);
        lockTimer.current = window.setTimeout(() => setIsAnimating(false), ANIMATION_MS);
    }

    function next() {
        goTo(activeIndex + 1);
    }

    function previous() {
        goTo(activeIndex - 1);
    }

    useEffect(() => {
        window.clearTimeout(autoplayTimer.current);

        if (isPaused || isAnimating) return undefined;

        autoplayTimer.current = window.setTimeout(() => {
            goTo(activeIndex + 1);
        }, 3200);

        return () => window.clearTimeout(autoplayTimer.current);
    }, [activeIndex, isAnimating, isPaused]);

    function getPlacement(index) {
        const total = IMAGES.length;
        const diff = (index - activeIndex + total) % total;
        if (diff === 0) return { x: 0, scale: 1, opacity: 1, z: 4, rotate: 0 };
        if (diff === 1) return { x: isMobile ? 74 : 42, scale: isMobile ? 0.64 : 0.72, opacity: 0.58, z: 3, rotate: 8 };
        if (diff === total - 1) return { x: isMobile ? -74 : -42, scale: isMobile ? 0.64 : 0.72, opacity: 0.58, z: 3, rotate: -8 };
        return { x: 0, scale: 0.5, opacity: 0, z: 1, rotate: 0 };
    }

    const grain = useMemo(() => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23n)" opacity="0.08"/></svg>`;
        return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }, []);

    return (
        <main
            className={`toonhub${isAnimating ? ' is-animating' : ''}`}
            style={{ backgroundColor: activeItem.bg, fontFamily: "'Inter', sans-serif" }}
        >
            <div className="toonhub-stage">
                <div
                    className="toonhub-grain"
                    style={{ backgroundImage: grain }}
                    aria-hidden="true"
                />

                <div className="toonhub-ghost" aria-hidden="true">3D SHAPE</div>

                <div className="toonhub-orb orb-a" style={{ '--orb': activeItem.accent }} aria-hidden="true" />
                <div className="toonhub-orb orb-b" style={{ '--orb': activeItem.accent }} aria-hidden="true" />

                <a className="toonhub-brand" href="/" aria-label="TOONHUB home">TOONHUB</a>

                <div
                    className="toonhub-carousel"
                    aria-live="polite"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    {IMAGES.map((item, index) => {
                        const placement = getPlacement(index);
                        return (
                            <button
                                className={`toonhub-card ${index === activeIndex ? 'active' : ''}`}
                                type="button"
                                key={item.name}
                                onClick={() => goTo(index)}
                                onTouchStart={event => {
                                    touchStartX.current = event.touches[0].clientX;
                                }}
                                onTouchEnd={event => {
                                    if (touchStartX.current == null) return;
                                    const delta = event.changedTouches[0].clientX - touchStartX.current;
                                    touchStartX.current = null;
                                    if (Math.abs(delta) < 45) return;
                                    delta < 0 ? next() : previous();
                                }}
                                aria-label={`View ${item.title}`}
                                style={{
                                    '--x': `${placement.x}vw`,
                                    '--scale': placement.scale,
                                    '--opacity': placement.opacity,
                                    '--z': placement.z,
                                    '--rotate': `${placement.rotate}deg`,
                                    '--accent': item.accent
                                }}
                            >
                                <span>{item.tag}</span>
                                <img src={item.url} alt={`${item.title} character figurine`} />
                            </button>
                        );
                    })}
                </div>

                <section className="toonhub-copy" key={activeItem.name}>
                    <span><Sparkles /> Vinyl desk legends</span>
                    <h1>{activeItem.title}</h1>
                    <p>{activeItem.name} is ready for the spotlight. Swipe through the TOONHUB figurine drop and pick the shape that owns your shelf.</p>
                </section>

                <div
                    className="toonhub-controls"
                    aria-label="Carousel controls"
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                >
                    <button type="button" onClick={previous} disabled={isAnimating} aria-label="Previous figurine">
                        <ChevronLeft />
                    </button>
                    <div>
                        {IMAGES.map((item, index) => (
                            <button
                                type="button"
                                key={item.name}
                                className={index === activeIndex ? 'active' : ''}
                                onClick={() => goTo(index)}
                                aria-label={`Go to ${item.title}`}
                            />
                        ))}
                    </div>
                    <button type="button" onClick={next} disabled={isAnimating} aria-label="Next figurine">
                        <ChevronRight />
                    </button>
                </div>

                <a className="toonhub-link" href="#collect">
                    COLLECT NOW <ArrowUpRight />
                </a>
            </div>
        </main>
    );
}
