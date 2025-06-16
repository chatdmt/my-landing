"use client";
import React, { useEffect, useRef, useCallback } from 'react';

const DEFAULT_TEXT = "21ST.DEV";
const DEFAULT_FONT_FAMILY = "'Inter', sans-serif";

// --- Static Configuration ---
const POINT_SAMPLING_DENSITY = 4;
const TARGET_HORIZONTAL_FILL_PERCENTAGE = 0.95;
const TARGET_VERTICAL_FILL_PERCENTAGE = 0.80;
const MAX_INITIAL_FONT_SIZE = 350;
const MIN_FONT_SIZE = 10;
const FIT_CHECK_PADDING = 25;
const SETTLE_ATTRACTION_MULTIPLIER = 0.15;
const SETTLE_NOISE_MULTIPLIER = 0.7;

// --- Physics Parameters Object (defaults) ---
interface PhysicsParams {
    PARTICLE_COUNT_TARGET: number;
    PARTICLE_BASE_SIZE: number;
    ATTRACTION_FORCE_BASE: number;
    NOISE_STRENGTH_BASE: number;
    FRICTION: number;
    MOUSE_INTERACTION_RADIUS: number;
    MOUSE_DISPERSE_STRENGTH: number;
    TRAIL_ALPHA: number;
    ATTRACTION_DISTANCE_CLAMP: number;
    SETTLE_DISTANCE_THRESHOLD: number;
}

const initialPhysicsParams: PhysicsParams = {
    PARTICLE_COUNT_TARGET: 1000,
    PARTICLE_BASE_SIZE: 1.2,
    ATTRACTION_FORCE_BASE: 0.10,
    NOISE_STRENGTH_BASE: 0.1,
    FRICTION: 0.94,
    MOUSE_INTERACTION_RADIUS: 90,
    MOUSE_DISPERSE_STRENGTH: 1.2,
    TRAIL_ALPHA: 0.2,
    ATTRACTION_DISTANCE_CLAMP: 100,
    SETTLE_DISTANCE_THRESHOLD: 4,
};

// Pewter / silvery palette (subtle metallic greys)
const pewterPalette = [
  '#f5f5f5', // very light silver
  '#e0e0e0',
  '#cccccc',
  '#b8b8b8',
  '#a3a3a3',
  '#8f8f8f',
  '#7b7b7b',
  '#676767'
];
const PARTICLE_COLORS = [...pewterPalette];

class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    targetX: number;
    targetY: number;
    physicsParams: PhysicsParams;
    baseSize: number;
    size: number;
    color: string;
    attractionOffset: number;
    noiseOffset: number;
    constructor(targetX: number, targetY: number, canvasWidth: number, canvasHeight: number, physicsParams: PhysicsParams) {
        this.x = -targetX + .2 * (Math.random() - 0.5) * canvasWidth;
        this.y = (Math.random() ) * canvasHeight ;
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = (Math.random() - 0.5) * 6;
        this.targetX = targetX;
        this.targetY = targetY;
        this.physicsParams = physicsParams; // Store reference
        this.baseSize = this.physicsParams.PARTICLE_BASE_SIZE;
        this.size = this.baseSize + Math.random() * (this.baseSize * 0.5);
        this.color = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        this.attractionOffset = (Math.random() - 0.5) * 0.04;
        this.noiseOffset = (Math.random() - 0.5) * 0.2;
    }

    update() {
        if (this.baseSize !== this.physicsParams.PARTICLE_BASE_SIZE) {
            this.baseSize = this.physicsParams.PARTICLE_BASE_SIZE;
        }
        this.size = this.baseSize + Math.random() * (this.baseSize * 0.5);

        const dxTarget = this.targetX - this.x;
        const dyTarget = this.targetY - this.y;
        const distTarget = Math.sqrt(dxTarget * dxTarget + dyTarget * dyTarget);

        let currentAttraction = Math.max(0.001, this.physicsParams.ATTRACTION_FORCE_BASE + this.attractionOffset);
        let currentNoise = Math.max(0, this.physicsParams.NOISE_STRENGTH_BASE + this.noiseOffset);
        
        const settleDist = this.physicsParams.SETTLE_DISTANCE_THRESHOLD ?? 4;

        if (distTarget < settleDist) {
            currentAttraction *= SETTLE_ATTRACTION_MULTIPLIER;
            currentNoise *= SETTLE_NOISE_MULTIPLIER;
        } else if (distTarget < settleDist * 4) {
            const factor = Math.max(0, (distTarget - settleDist) / (settleDist * 3));
            currentAttraction = currentAttraction * (SETTLE_ATTRACTION_MULTIPLIER + (1 - SETTLE_ATTRACTION_MULTIPLIER) * factor);
            currentNoise = currentNoise * (SETTLE_NOISE_MULTIPLIER + (1 - SETTLE_NOISE_MULTIPLIER) * factor);
        }

        let forceX = 0;
        let forceY = 0;

        const clampDist = this.physicsParams.ATTRACTION_DISTANCE_CLAMP ?? 100;
        if (distTarget > 0.01) {
            const effectiveDist = Math.min(distTarget, clampDist);
            forceX += (dxTarget / distTarget) * currentAttraction * effectiveDist * 0.1;
            forceY += (dyTarget / distTarget) * currentAttraction * effectiveDist * 0.1;
        }

        forceX += (Math.random() - 0.5) * currentNoise;
        forceY += (Math.random() - 0.5) * currentNoise;

        this.vx += forceX;
        this.vy += forceY;
        this.vx *= this.physicsParams.FRICTION;
        this.vy *= this.physicsParams.FRICTION;
        this.x += this.vx;
        this.y += this.vy;
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.2, this.size), 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = Math.min(5, this.size * 0.5);
        ctx.fill();
    }
}

interface WordPoint {
    x: number;
    y: number;
    sourceCanvasWidth: number;
    sourceCanvasHeight: number;
}
interface WordPointPlaceholder {
    sourceCanvasWidth: number;
    sourceCanvasHeight: number;
    isEmptyPlaceholder: true;
}
type WordPointResult = WordPoint | WordPointPlaceholder;


interface ParticleTypographyProps {
  text?: string;
  onReady?: () => void; // callback when animation loop first becomes active
}

const ParticleTypography: React.FC<ParticleTypographyProps> = ({ text, onReady }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesArrayRef = useRef<Particle[]>([]);
    const wordTargetPointsRef = useRef<WordPointResult[]>([]);
    const animationFrameIdRef = useRef<number | null>(null);
    const physicsParamsRef = useRef({...initialPhysicsParams});
    const readyRef = useRef(false);

    const getWordPoints = useCallback((word: string, mainCanvasWidth: number, mainCanvasHeight: number): WordPointResult[] => {
        const points: WordPoint[] = [];
        if (!word || word.trim() === "" || mainCanvasWidth <= 0 || mainCanvasHeight <= 0) {
            console.warn("getWordPoints: Invalid word or canvas dimensions.");
            return [{ sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight, isEmptyPlaceholder: true }];
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mainCanvasWidth;
        tempCanvas.height = mainCanvasHeight;
        const tempCtx = tempCanvas.getContext('2d')!;
        const normalizedWord = word.toUpperCase();
        const fontToUse = DEFAULT_FONT_FAMILY;
        let optimalFontSize = MIN_FONT_SIZE;

        for (let fs = MAX_INITIAL_FONT_SIZE; fs >= MIN_FONT_SIZE; fs -= 2) {
            tempCtx.font = `bold ${fs}px ${fontToUse}`;
            const textMetrics = tempCtx.measureText(normalizedWord);
            const textWidthWithPadding = textMetrics.width + FIT_CHECK_PADDING;
            const textHeightWithPadding = (textMetrics.actualBoundingBoxAscent || fs * 0.75) +
                                          (textMetrics.actualBoundingBoxDescent || fs * 0.25) +
                                          FIT_CHECK_PADDING;
            if (textWidthWithPadding < mainCanvasWidth * TARGET_HORIZONTAL_FILL_PERCENTAGE &&
                textHeightWithPadding < mainCanvasHeight * TARGET_VERTICAL_FILL_PERCENTAGE) {
                optimalFontSize = fs;
                break;
            }
        }

        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.font = `bold ${optimalFontSize}px ${fontToUse}`;
        tempCtx.fillStyle = 'white';
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.fillText(normalizedWord, tempCanvas.width / 2, tempCanvas.height / 6);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        for (let y = 0; y < tempCanvas.height; y += POINT_SAMPLING_DENSITY) {
            for (let x = 0; x < tempCanvas.width; x += POINT_SAMPLING_DENSITY) {
                const alphaIndex = (y * tempCanvas.width + x) * 4 + 3;
                if (data[alphaIndex] > 128) {
                    points.push({ x: x, y: y, sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight });
                }
            }
        }
        if (points.length === 0) {
            console.warn("getWordPoints: No points found. Returning placeholder.");
            return [{ sourceCanvasWidth: mainCanvasWidth, sourceCanvasHeight: mainCanvasHeight, isEmptyPlaceholder: true }];
        }
        console.warn("getWordPoints: points found", points.length);
        return points;
    }, []);

    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        if (!readyRef.current) {
          readyRef.current = true;
          onReady?.();
        }

        ctx.fillStyle = `rgba(0, 0, 0, ${physicsParamsRef.current.TRAIL_ALPHA})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        particlesArrayRef.current.forEach(particle => {
            particle.update();
            particle.draw(ctx);
        });
        
        ctx.shadowBlur = 0; 
        ctx.shadowColor = 'transparent';
        animationFrameIdRef.current = requestAnimationFrame(animate);
    }, [onReady]);

    const updateParticlesForText = useCallback((newText: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const newWord = (newText ?? DEFAULT_TEXT).toUpperCase();
      const newPoints = getWordPoints(newWord, canvas.width, canvas.height);
      if (!newPoints || newPoints.length === 0) {
        console.warn('ParticleTypography: getWordPoints returned no points for text:', newWord);
        return;
      }
      wordTargetPointsRef.current = newPoints;
      
      physicsParamsRef.current = {...initialPhysicsParams};

      const particleCountTarget = initialPhysicsParams.PARTICLE_COUNT_TARGET;

      const usablePoints = newPoints.filter((pt): pt is WordPoint => 'x' in pt);
      
      const sampledPoints: WordPoint[] = [];
      if (usablePoints.length > 0) {
        if (usablePoints.length <= particleCountTarget) {
            sampledPoints.push(...usablePoints);
            while (sampledPoints.length < particleCountTarget) {
            sampledPoints.push(...usablePoints);
            }
            sampledPoints.length = particleCountTarget;
        } else {
            const stride = usablePoints.length / particleCountTarget;
            for (let i = 0; i < particleCountTarget; i++) {
            sampledPoints.push(usablePoints[Math.floor(i * stride)]);
            }
        }
      }

      const prevParticles = particlesArrayRef.current;

      // For a smooth transition, we map old particles to new target points
      // by sorting both spatially and mapping them 1-to-1.
      const canvasWidth = canvas.width;
      const sortKey = (p: { x: number; y: number }) => p.y * canvasWidth + p.x;

      const sortedPrevParticles = [...prevParticles].sort((a, b) => sortKey(a) - sortKey(b));
      const sortedSampledPoints = [...sampledPoints].sort((a, b) => sortKey(a) - sortKey(b));
      
      const newParticles: Particle[] = [];
      const availablePrevParticles = new Array(sortedPrevParticles.length).fill(true);

      for (let i = 0; i < sortedSampledPoints.length; i++) {
        const pt = sortedSampledPoints[i];
        let bestMatchIndex = -1;
        let minDistanceSq = Infinity;
        
        const searchRadius = 40;
        const start = Math.max(0, i - searchRadius);
        const end = Math.min(sortedPrevParticles.length, i + searchRadius);

        for (let j = start; j < end; j++) {
            if (availablePrevParticles[j]) {
                const prevP = sortedPrevParticles[j];
                const distSq = (pt.x - prevP.x)**2 + (pt.y - prevP.y)**2;
                if (distSq < minDistanceSq) {
                    minDistanceSq = distSq;
                    bestMatchIndex = j;
                }
            }
        }
        
        if (bestMatchIndex === -1) {
            let fallbackIndex = -1;
            for(let k=0; k < availablePrevParticles.length; k++){
                if(availablePrevParticles[k]){
                    fallbackIndex = k;
                    break;
                }
            }
            bestMatchIndex = fallbackIndex;
        }
        
        availablePrevParticles[bestMatchIndex] = false;
        const prevP = sortedPrevParticles[bestMatchIndex];

        let p;
        if (
          prevP &&
          typeof pt === 'object' &&
          'x' in pt &&
          'y' in pt
        ) {
          // Create a new particle with the new target
          p = new Particle(pt.x, pt.y, canvas.width, canvas.height, physicsParamsRef.current);
          // but give it the position and velocity of the nearest old particle
          p.x = prevP.x;
          p.y = prevP.y;
          p.vx = prevP.vx;
          p.vy = prevP.vy;
        } else if (typeof pt === 'object' && 'x' in pt && 'y' in pt) {
          p = new Particle(pt.x, pt.y, canvas.width, canvas.height, physicsParamsRef.current);
        } else {
          p = new Particle(Math.random() * canvas.width, Math.random() * canvas.height, canvas.width, canvas.height, physicsParamsRef.current);
        }
        
        if (typeof pt === 'object' && 'x' in pt && 'y' in pt) {
          p.targetX = pt.x;
          p.targetY = pt.y;
        } else {
          p.targetX = Math.random() * canvas.width;
          p.targetY = Math.random() * canvas.height;
        }
        newParticles.push(p);
      }
      
      const finalParticles = newParticles.sort((a,b) => sortKey({x: a.targetX, y: a.targetY}) - sortKey({x: b.targetX, y: b.targetY}));
      particlesArrayRef.current = finalParticles;

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      animate();
    }, [getWordPoints, animate, onReady]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // --- Set canvas size once on mount ---
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';

        document.body.style.fontFamily = "'Inter', sans-serif";
        document.body.style.overscrollBehavior = 'none';
        document.body.style.overflow = 'hidden';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.classList.add('bg-black', 'text-gray-100');

        updateParticlesForText(text ?? DEFAULT_TEXT);

        return () => {
            if(animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            document.body.style.fontFamily = "";
            document.body.style.overscrollBehavior = '';
            document.body.style.overflow = '';
            document.body.style.margin = '';
            document.body.style.padding = '';
            document.body.classList.remove('bg-black', 'text-gray-100');
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only once on mount

    // This useEffect will handle text changes
    useEffect(() => {
      updateParticlesForText(text ?? DEFAULT_TEXT);
    }, [text, updateParticlesForText]);

    return (
        <canvas 
            ref={canvasRef} 
            style={{ display: 'block', backgroundColor: '#000000', borderRadius: 0 }}
            className="w-screen h-screen"
        />
    );
};

export default ParticleTypography; 