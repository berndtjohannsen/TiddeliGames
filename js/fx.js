'use strict';

/**
 * Shared motion / celebration helpers for games (optional include in index.html).
 * CSS classes live in css/animations.css (tiddeli-fx-*).
 */
(function () {
    const DEFAULT_CONFETTI_COLORS = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb7185'];

    /**
     * @param {HTMLElement|null} el
     * @param {string} className
     * @param {number} durationMs
     */
    function pulseClass(el, className, durationMs) {
        if (!el) return;
        el.classList.remove(className);
        // Force reflow so repeated triggers restart animation
        void el.offsetWidth;
        el.classList.add(className);
        window.setTimeout(() => el.classList.remove(className), durationMs);
    }

    function wiggleElement(el, durationMs) {
        pulseClass(el, 'tiddeli-fx-wiggle', durationMs || 500);
    }

    function bounceElement(el, durationMs) {
        pulseClass(el, 'tiddeli-fx-bounce', durationMs || 600);
    }

    function shakeElement(el, durationMs) {
        pulseClass(el, 'tiddeli-fx-shake', durationMs || 450);
    }

    /**
     * Lightweight confetti burst on a 2D canvas (game provides canvas + coords).
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} x
     * @param {number} y
     * @param {{ count?: number, colors?: string[], spread?: number, durationMs?: number }} [opts]
     * @returns {{ pieces: object[], expiresAt: number }}
     */
    function createConfettiBurst(ctx, x, y, opts) {
        const options = opts || {};
        const count = options.count != null ? options.count : 48;
        const colors = options.colors || DEFAULT_CONFETTI_COLORS;
        const spread = options.spread != null ? options.spread : 140;
        const durationMs = options.durationMs != null ? options.durationMs : 2200;
        const pieces = [];
        for (let i = 0; i < count; i++) {
            const angle = (Math.random() - 0.5) * spread * (Math.PI / 180);
            const speed = 2.5 + Math.random() * 5;
            pieces.push({
                x,
                y,
                vx: Math.sin(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
                vy: -3 - Math.random() * 4,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.2,
                w: 4 + Math.random() * 6,
                h: 6 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1
            });
        }
        return { pieces, expiresAt: performance.now() + durationMs, ctx };
    }

    /**
     * Advance and draw one confetti state (call from requestAnimationFrame).
     * @param {{ pieces: object[], expiresAt: number, ctx: CanvasRenderingContext2D }} state
     * @returns {boolean} false when done
     */
    function tickConfetti(state) {
        if (!state || !state.ctx || !state.pieces.length) return false;
        const ctx = state.ctx;
        if (performance.now() > state.expiresAt) return false;
        state.pieces.forEach((p) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18;
            p.rot += p.vr;
            p.life -= 0.012;
            if (p.life <= 0) return;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });
        state.pieces = state.pieces.filter((p) => p.life > 0);
        return state.pieces.length > 0;
    }

    window.TiddeliFx = Object.freeze({
        wiggleElement,
        bounceElement,
        shakeElement,
        createConfettiBurst,
        tickConfetti
    });
})();
