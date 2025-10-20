"use client";

import React, { useRef, useEffect, useCallback } from 'react';
import { useDivideIoProgress } from '@/hooks/useDivideIoProgress';
import VirtualJoystick from './VirtualJoystick';
import SplitButton from './SplitButton';
import Minimap from './Minimap';
import { BOT_NAMES } from './BotNames';
import { useGameAudio } from '@/hooks/useGameAudio';
import heroBgImage from '@/assets/hero-bg.jpg';
import { useIsMobile } from '@/hooks/use-mobile';
import PauseMenu from './PauseMenu';
import { Button } from '@/components/ui/button';
import { Pause } from 'lucide-react';
import { saveGameState, loadGameState, clearGameState } from '@/utils/divide-io-storage'; // Importando utilitários
import CongratsModal from './CongratsModal'; // fixed import (no extension)

type Difficulty = 'very-easy' | 'easy' | 'medium' | 'hard';

const difficultySettings = {
  'very-easy': { botCount: 18, botAggression: 0.1, botSplitChance: 0.0005 },
  easy: { botCount: 18, botAggression: 0.2, botSplitChance: 0.001 },
  medium: { botCount: 18, botAggression: 0.5, botSplitChance: 0.002 },
  hard: { botCount: 18, botAggression: 0.8, botSplitChance: 0.005 },
};

const WORLD_SIZE = 3000;
const WORLD_CENTER_X = WORLD_SIZE / 2;
const WORLD_CENTER_Y = WORLD_SIZE / 2;
const WORLD_RADIUS = WORLD_SIZE / 2;
const PELLET_COUNT = 800;
const MIN_CELL_RADIUS = 10;
const MIN_CELL_MASS = MIN_CELL_RADIUS * MIN_CELL_RADIUS;
const MIN_SPLIT_MASS = MIN_CELL_MASS * 2;
const MERGE_COOLDOWN_FRAMES = 60 * 5;
const MASS_TO_RADIUS_RATIO = 4;

const EJECTION_IMPULSE = 250;
const EJECTION_OFFSET = 30;

const MAX_TOTAL_BOT_CELLS = 100;

const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Exportando classes para uso no utilitário de storage
export class Vector {
  constructor(public x: number, public y: number) {}

  add(v: Vector) {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  subtract(v: Vector) {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  multiply(scalar: number) {
    return new Vector(this.x * scalar, this.y * scalar);
  }

  magnitude() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const mag = this.magnitude();
    return mag > 0 ? new Vector(this.x / mag, this.y / mag) : new Vector(0, 0);
  }
}

// Ref para a direção de movimento (usada por Joystick, Mouse ou Teclado)
const movementDirectionRef: { current: { x: number; y: number } } = { current: { x: 0, y: 0 } };

export class Cell {
  public position: Vector;
  public mass: number;
  public radius: number;
  public velocity: Vector;
  public mergeCooldown = 0;
  public name: string;
  public id: number; 
  public isBot: boolean;

  constructor(x: number, y: number, public color: string, initialMass: number, name: string = 'Cell', id: number, isBot: boolean = false) {
    this.position = new Vector(x, y);
    this.mass = initialMass;
    this.radius = this.calculateRadius();
    this.velocity = new Vector(0, 0);
    this.name = name;
    this.id = id;
    this.isBot = isBot;
  }

  calculateRadius() {
    return Math.sqrt(this.mass / Math.PI) * MASS_TO_RADIUS_RATIO;
  }

  update() {
    if (this.mergeCooldown > 0) {
      this.mergeCooldown--;
    }
    this.velocity = this.velocity.multiply(0.92);
    this.position = this.position.add(this.velocity);
    
    const center = new Vector(WORLD_CENTER_X, WORLD_CENTER_Y);
    const distanceFromCenter = this.position.subtract(center).magnitude();
    if (distanceFromCenter + this.radius > WORLD_RADIUS) {
      const direction = this.position.subtract(center).normalize();
      this.position = center.add(direction.multiply(WORLD_RADIUS - this.radius));
    }
  }

  draw(ctx: CanvasRenderingContext2D, isPlayer: boolean = false) {
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, this.radius * 0.04);
    ctx.stroke();
    ctx.closePath();
    
    if (this.radius > 15) {
        ctx.fillStyle = isPlayer ? '#fff' : '#fff';
        ctx.font = `${Math.max(12, this.radius / 3)}px Quicksand, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, this.position.x, this.position.y);
    }
  }
  
  split(directionVector: Vector, nextCellId: number): Cell | null {
    if (this.mass >= MIN_SPLIT_MASS) {
        const splitMass = this.mass / 2;
        this.mass = splitMass;
        this.radius = this.calculateRadius();
        this.mergeCooldown = MERGE_COOLDOWN_FRAMES;
        
        const direction = directionVector.magnitude() > 0.1
            ? directionVector.normalize()
            : this.velocity.magnitude() > 0.1 
                ? this.velocity.normalize() 
                : new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();

        const offsetDistance = this.radius + EJECTION_OFFSET; 
        const offset = direction.multiply(offsetDistance);

        const newCell = new Cell(
            this.position.x + offset.x, 
            this.position.y + offset.y, 
            this.color, 
            splitMass,
            this.name,
            nextCellId,
            this.isBot
        );
        
        newCell.velocity = this.velocity.add(direction.multiply(EJECTION_IMPULSE));
        newCell.mergeCooldown = MERGE_COOLDOWN_FRAMES;
        
        this.velocity = this.velocity.add(direction.multiply(-EJECTION_IMPULSE * 0.1));

        const center = new Vector(WORLD_CENTER_X, WORLD_CENTER_Y);
        const distanceFromCenter = newCell.position.subtract(center).magnitude();
        if (distanceFromCenter + newCell.radius > WORLD_RADIUS) {
          const directionToCenter = newCell.position.subtract(center).normalize();
          newCell.position = center.add(directionToCenter.multiply(WORLD_RADIUS - newCell.radius));
        }

        return newCell;
    }
    return null;
  }
}

let nextCellId = 1;
const getNextCellId = () => nextCellId++;

export class Player extends Cell {
    constructor(x: number, y: number, color: string, initialMass: number, name: string) {
        super(x, y, color, initialMass, name, getNextCellId(), false);
    }
    
    split(): Player | null {
        if (this.mass < MIN_SPLIT_MASS) {
            return null;
        }
        
        const splitMass = this.mass / 2;
        this.mass = splitMass;
        this.radius = this.calculateRadius();
        this.mergeCooldown = MERGE_COOLDOWN_FRAMES;
        
        const directionVec = new Vector(movementDirectionRef.current.x, movementDirectionRef.current.y);
        
        const direction = directionVec.magnitude() > 0.1
            ? directionVec.normalize()
            : this.velocity.magnitude() > 0.1 
                ? this.velocity.normalize() 
                : new Vector(Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();

        const offsetDistance = this.radius + EJECTION_OFFSET; 
        const offset = direction.multiply(offsetDistance);

        const newCell = new Player(
            this.position.x + offset.x, 
            this.position.y + offset.y, 
            this.color, 
            splitMass,
            this.name
        );
        
        newCell.velocity = this.velocity.add(direction.multiply(EJECTION_IMPULSE));
        newCell.mergeCooldown = MERGE_COOLDOWN_FRAMES;
        
        this.velocity = this.velocity.add(direction.multiply(-EJECTION_IMPULSE * 0.1));

        const center = new Vector(WORLD_CENTER_X, WORLD_CENTER_Y);
        const distanceFromCenter = newCell.position.subtract(center).magnitude();
        if (distanceFromCenter + newCell.radius > WORLD_RADIUS) {
          const directionToCenter = newCell.position.subtract(center).normalize();
          newCell.position = center.add(directionToCenter.multiply(WORLD_RADIUS - newCell.radius));
        }

        return newCell;
    }
}

export class Pellet {
  public position: Vector;
  public radius = 3;
  constructor(public color: string, x?: number, y?: number) {
    if (x !== undefined && y !== undefined) {
        this.position = new Vector(x, y);
    } else {
        // Spawn within circular bounds
        let angle = Math.random() * Math.PI * 2;
        let distance = Math.random() * (WORLD_RADIUS * 0.8) + WORLD_RADIUS * 0.1;
        this.position = new Vector(
          WORLD_CENTER_X + Math.cos(angle) * distance,
          WORLD_CENTER_Y + Math.sin(angle) * distance
        );
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }
}

// Lógica de Bot (mantida)
const botLogic = {
    target: new Map<string, Vector | null>(),
    threat: new Map<string, Vector | null>(),
    explorationTarget: new Map<string, Vector | null>(),
    decisionTimer: new Map<string, number>(),
    
    findBestTarget(botCells: Cell[], pellets: Pellet[], otherCells: Cell[], aggression: number, botName: string) {
        const totalMass = botCells.reduce((sum, c) => sum + c.mass, 0);
        const avgRadius = botCells.reduce((sum, c) => sum + c.radius, 0) / botCells.length; 
        const center = botCells.reduce((sum, c) => sum.add(c.position.multiply(c.mass)), new Vector(0, 0)).multiply(1 / totalMass);

        let bestTarget: Pellet | Cell | null = null;
        let minTargetDist = Infinity;
        let closestThreat: Cell | null = null;
        let minThreatDist = Infinity;

        const perceptionRadius = avgRadius * 15; 

        for (const cell of otherCells) {
            if (cell.name === botName) continue;
            const dist = center.subtract(cell.position).magnitude();
            if (dist > perceptionRadius) continue;

            if (cell.mass > totalMass * 1.15) {
                if (dist < minThreatDist) {
                    minThreatDist = dist;
                    closestThreat = cell;
                }
            } else if (totalMass > cell.mass * 1.15) {
                if (dist < minTargetDist && Math.random() < aggression) {
                    minTargetDist = dist;
                    bestTarget = cell;
                }
            }
        }

        if (closestThreat && minThreatDist < avgRadius * 5) {
            this.threat.set(botName, closestThreat.position);
            this.target.set(botName, null);
            this.explorationTarget.set(botName, null);
            return;
        }

        if (!bestTarget) {
            for (const pellet of pellets) {
                const dist = center.subtract(pellet.position).magnitude();
                if (dist < minTargetDist) {
                    minTargetDist = dist;
                    bestTarget = pellet;
                }
            }
        }
        
        this.threat.set(botName, null);
        this.target.set(botName, bestTarget ? bestTarget.position : null);
        
        if (!bestTarget) {
            let currentExplorationTarget = this.explorationTarget.get(botName);
            
            if (!currentExplorationTarget || center.subtract(currentExplorationTarget).magnitude() < WORLD_RADIUS * 0.1) {
                let angle = Math.random() * Math.PI * 2;
                let distance = Math.random() * (WORLD_RADIUS * 0.8) + WORLD_RADIUS * 0.1;
                let newTarget = new Vector(
                    WORLD_CENTER_X + Math.cos(angle) * distance,
                    WORLD_CENTER_Y + Math.sin(angle) * distance
                );
                this.explorationTarget.set(botName, newTarget);
            }
        } else {
            this.explorationTarget.set(botName, null);
        }
    },
    
    getMovementDirection(botName: string, center: Vector): Vector {
        const threat = this.threat.get(botName);
        const target = this.target.get(botName);
        const explorationTarget = this.explorationTarget.get(botName);
        
        if (threat) {
            return center.subtract(threat).normalize();
        } else if (target) {
            return target.subtract(center).normalize();
        } else if (explorationTarget) {
            return explorationTarget.subtract(center).normalize();
        }
        
        return new Vector(0, 0);
    }
};


const PELLET_MASS_VALUE = 10;

const generatePelletsFromMass = (mass: number, position: Vector) => {
    const pellets: Pellet[] = [];
    const pelletCount = Math.floor(mass / PELLET_MASS_VALUE);
    
    for (let i = 0; i < pelletCount; i++) {
        const pellet = new Pellet(getRandomColor());
        
        const angle = Math.random() * Math.PI * 2;
        const explosionRadius = Math.sqrt(mass / Math.PI) * MASS_TO_RADIUS_RATIO;
        const distance = Math.random() * explosionRadius * 1.5; 
        
        pellet.position = position.add(new Vector(Math.cos(angle) * distance, Math.sin(angle) * distance));
        
        const center = new Vector(WORLD_CENTER_X, WORLD_CENTER_Y);
        const distanceFromCenter = pellet.position.subtract(center).magnitude();
        if (distanceFromCenter + pellet.radius > WORLD_RADIUS) {
          const direction = pellet.position.subtract(center).normalize();
          pellet.position = center.add(direction.multiply(WORLD_RADIUS - pellet.radius));
        }
        
        pellets.push(pellet);
    }
    return pellets;
};


const generateBotNames = (count: number) => {
    const baseNames = [...BOT_NAMES];
    const shuffleArray = (array: string[]) => {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    };
    shuffleArray(baseNames);

    const uniqueBotNames: string[] = [];
    
    for (let i = 0; i < count; i++) {
        const baseName = baseNames[i % baseNames.length];
        
        if (i >= baseNames.length) {
            const secondaryIndex = Math.floor(i / baseNames.length) - 1;
            const secondaryName = baseNames[secondaryIndex % baseNames.length];
            
            const combinationIndex = i % baseNames.length;
            const combinedName = `${baseNames[combinationIndex]} ${secondaryName}`;
            
            let finalName = combinedName;
            let suffix = 0;
            while (uniqueBotNames.includes(finalName)) {
                suffix++;
                finalName = `${combinedName} ${String.fromCharCode(65 + suffix)}`; 
            }
            uniqueBotNames.push(finalName);
        } else {
            uniqueBotNames.push(baseName);
        }
    }
    return uniqueBotNames.slice(0, count);
};

const DivideIoGame: React.FC<{
  difficulty: Difficulty;
  onGameOver: (score: number) => void;
  playerName: string;
}> = ({ difficulty, onGameOver, playerName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { highScore, leaderboard } = useDivideIoProgress();
  const animationFrameId = useRef<number>();
  const isMobile = useIsMobile();
  
  const [isPlaying, setIsPlaying] = React.useState(true);
  const [isPaused, setIsPaused] = React.useState(false);
  const { playCollect, playSplit } = useGameAudio(isPlaying); 
  
  const initialBotCount = difficultySettings[difficulty].botCount;
  const botNamesRef = useRef<string[]>([]);
  
  const bgImgRef = useRef<HTMLImageElement | null>(null);

  const [minimapData, setMinimapData] = React.useState({
    playerCenter: { x: WORLD_CENTER_X, y: WORLD_CENTER_Y },
    playerRadius: MIN_CELL_RADIUS, 
    visibleBots: [] as Array<{ x: number; y: number; mass: number; color: string; radius: number }>,
  });

  const gameInstance = useRef({
    playerCells: [] as Player[],
    botCells: [] as Cell[], 
    pellets: [] as Pellet[],
    viruses: [] as any[],
    camera: { x: WORLD_CENTER_X, y: WORLD_CENTER_Y, zoom: 1 }, 
    score: 0,
    maxScore: 0, 
    mousePosition: new Vector(0, 0),
  }).current;
  
  const keyboardDirectionRef = useRef({ x: 0, y: 0 });
  const isKeyboardActiveRef = useRef(false);

  // NEW: state/ref to manage congrats modal and ensure it fires once
  const [showCongrats, setShowCongrats] = React.useState(false);
  const hasWonRef = useRef(false);
  const CONGRATS_SCORE = 250000;

  // --- Handlers de Pausa/Reinício ---
  
  const handlePause = useCallback(() => {
    // Save state and pause
    saveGameState(
        gameInstance.playerCells,
        gameInstance.botCells,
        gameInstance.pellets,
        gameInstance.camera,
        gameInstance.score,
        gameInstance.maxScore
    );
    setIsPaused(true);
  }, [gameInstance]);
  
  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);
  
  const handleRestart = useCallback(() => {
    clearGameState();
    setShowCongrats(false);
    onGameOver(-1); 
  }, [onGameOver]);
  
  const handleExit = useCallback(() => {
    clearGameState();
    setShowCongrats(false);
    onGameOver(gameInstance.maxScore);
  }, [onGameOver, gameInstance.maxScore]);


  // --- Movement & split handlers ---
  
  const handleJoystickMove = useCallback((direction: { x: number; y: number }) => {
    if (isPaused) return;
    movementDirectionRef.current = direction;
    isKeyboardActiveRef.current = false;
  }, [isPaused]);
  
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (isPaused) return;
    if (!canvasRef.current || isKeyboardActiveRef.current) return; 
    
    gameInstance.mousePosition.x = event.clientX;
    gameInstance.mousePosition.y = event.clientY;
    
    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const dx = event.clientX - centerX;
    const dy = event.clientY - centerY;
    
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    
    if (magnitude > 10) {
        movementDirectionRef.current = { x: dx / magnitude, y: dy / magnitude };
    } else {
        movementDirectionRef.current = { x: 0, y: 0 };
    }
  }, [gameInstance, isPaused]);
  
  const handleSplit = useCallback(() => {
    if (isPaused) return;
    const newCells: Player[] = [];
    const cellsToSplit = [...gameInstance.playerCells]; 
    
    cellsToSplit.forEach(cell => {
      if (gameInstance.playerCells.includes(cell)) {
        const newCell = cell.split(); 
        if (newCell) {
          newCells.push(newCell);
          playSplit();
        }
      }
    });
    
    gameInstance.playerCells.push(...newCells);
  }, [gameInstance, playSplit, isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsPaused(p => {
            if (!p) {
                handlePause();
            }
            return !p;
        });
        return;
      }
      
      if (isPaused) return;

      if (isPlaying && event.code === 'Space') {
        event.preventDefault();
        handleSplit();
      }
      
      if (isMobile) return;

      let x = keyboardDirectionRef.current.x;
      let y = keyboardDirectionRef.current.y;
      let changed = false;

      switch (event.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (y !== -1) { y = -1; changed = true; }
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (y !== 1) { y = 1; changed = true; }
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (x !== -1) { x = -1; changed = true; }
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (x !== 1) { x = 1; changed = true; }
          break;
      }
      
      if (changed) {
          keyboardDirectionRef.current = { x, y };
          
          const magnitude = Math.sqrt(x * x + y * y);
          if (magnitude > 0) {
              movementDirectionRef.current = { x: x / magnitude, y: y / magnitude };
              isKeyboardActiveRef.current = true;
          } else {
              movementDirectionRef.current = { x: 0, y: 0 };
              isKeyboardActiveRef.current = false;
          }
      }
    };
    
    const handleKeyUp = (event: KeyboardEvent) => {
        if (isPaused) return;
        if (isMobile) return;

        let x = keyboardDirectionRef.current.x;
        let y = keyboardDirectionRef.current.y;
        let changed = false;

        switch (event.key) {
            case 'ArrowUp':
            case 'w':
            case 'W':
                if (y === -1) { y = 0; changed = true; }
                break;
            case 'ArrowDown':
            case 's':
            case 'S':
                if (y === 1) { y = 0; changed = true; }
                break;
            case 'ArrowLeft':
            case 'a':
            case 'A':
                if (x === -1) { x = 0; changed = true; }
                break;
            case 'ArrowRight':
            case 'd':
            case 'D':
                if (x === 1) { x = 0; changed = true; }
                break;
        }
        
        if (changed) {
            keyboardDirectionRef.current = { x, y };
            
            const magnitude = Math.sqrt(x * x + y * y);
            if (magnitude > 0) {
                movementDirectionRef.current = { x: x / magnitude, y: y / magnitude };
                isKeyboardActiveRef.current = true;
            } else {
                movementDirectionRef.current = { x: 0, y: 0 };
                isKeyboardActiveRef.current = false;
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    if (!isMobile) {
        window.addEventListener('mousemove', handleMouseMove);
    } else {
        movementDirectionRef.current = { x: 0, y: 0 };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isPlaying, handleSplit, isMobile, handleMouseMove, isPaused, handlePause]);

  // Variável para armazenar o zoom fixo calculado
  const fixedZoomRef = useRef<number>(1);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
        animationFrameId.current = requestAnimationFrame(gameLoop);
        return;
    }
    
    if (isPaused) {
        animationFrameId.current = requestAnimationFrame(gameLoop);
        return;
    }

    const { playerCells, botCells, pellets, viruses, camera } = gameInstance;
    
    if (playerCells.length === 0) {
      setIsPlaying(false);
      clearGameState(); // Limpa o estado ao morrer
      onGameOver(gameInstance.maxScore);
      animationFrameId.current = requestAnimationFrame(gameLoop);
      return;
    }

    try {
        let allCells: Cell[] = [...playerCells, ...botCells];

        const settings = difficultySettings[difficulty];

        // --- 1. Lógica do Jogador ---
        const playerDirection = new Vector(movementDirectionRef.current.x, movementDirectionRef.current.y);
        
        const totalPlayerMass = playerCells.reduce((sum, cell) => sum + cell.mass, 0);
        const playerCenterOfMass = playerCells.reduce((sum, c) => sum.add(c.position.multiply(c.mass)), new Vector(0, 0)).multiply(1 / totalPlayerMass);
        const avgPlayerRadius = playerCells.reduce((sum, cell) => sum + cell.radius, 0) / playerCells.length;

        playerCells.forEach(playerCell => {
            const acceleration = 0.3;
            const force = playerDirection.multiply(acceleration);
            playerCell.velocity = playerCell.velocity.add(force);

            const maxSpeed = 50 / (playerCell.radius * 0.1 + 10); 
            if (playerCell.velocity.magnitude() > maxSpeed) {
                playerCell.velocity = playerCell.velocity.normalize().multiply(maxSpeed);
            }
            
            if (playerCells.length > 1) {
                const attractionVector = playerCenterOfMass.subtract(playerCell.position).normalize();
                
                const mergeProgress = 1 - (playerCell.mergeCooldown / MERGE_COOLDOWN_FRAMES);
                const attractionFactor = Math.max(0, mergeProgress);
                
                const attractionForce = 0.5 * (avgPlayerRadius / playerCell.radius) * attractionFactor; 
                playerCell.velocity = playerCell.velocity.add(attractionVector.multiply(attractionForce));
            }
        });

        // --- 2. Lógica dos Bots ---
        
        const botGroups = new Map<string, Cell[]>();
        botCells.forEach(cell => {
            if (!botGroups.has(cell.name)) {
                botGroups.set(cell.name, []);
            }
            botGroups.get(cell.name)!.push(cell);
        });
        
        const newBotCells: Cell[] = [];

        botGroups.forEach((cells, botName) => {
            const totalMass = cells.reduce((sum, c) => sum + c.mass, 0);
            const avgRadius = cells.reduce((sum, c) => sum + c.radius, 0) / cells.length;
            const centerOfMass = cells.reduce((sum, c) => sum.add(c.position.multiply(c.mass)), new Vector(0, 0)).multiply(1 / totalMass);
            
            let decisionTimer = botLogic.decisionTimer.get(botName) || 0;
            if (decisionTimer <= 0) {
                const visiblePellets = pellets.filter(p => {
                    const dist = centerOfMass.subtract(p.position).magnitude();
                    return dist < avgRadius * 15;
                });
                botLogic.findBestTarget(cells, visiblePellets, allCells.filter(c => c.name !== botName), settings.botAggression, botName);
                decisionTimer = 30;
            }
            botLogic.decisionTimer.set(botName, decisionTimer - 1);

            const targetDirection = botLogic.getMovementDirection(botName, centerOfMass);
            
            cells.forEach(cell => {
                const acceleration = 0.3;
                const force = targetDirection.multiply(acceleration);
                cell.velocity = cell.velocity.add(force);
                
                const maxSpeed = 50 / (cell.radius * 0.1 + 10); 
                if (cell.velocity.magnitude() > maxSpeed) {
                    cell.velocity = cell.velocity.normalize().multiply(maxSpeed);
                }
                
                if (cells.length > 1) {
                    const attractionVector = centerOfMass.subtract(cell.position).normalize();
                    
                    const mergeProgress = 1 - (cell.mergeCooldown / MERGE_COOLDOWN_FRAMES);
                    const attractionFactor = Math.max(0, mergeProgress); 
                    
                    const attractionForce = 0.5 * (avgRadius / cell.radius) * attractionFactor; 
                    cell.velocity = cell.velocity.add(attractionForce ? attractionVector.multiply(attractionForce) : new Vector(0,0));
                }
                
                if (totalMass > MIN_SPLIT_MASS * 2 && cells.length === 1 && Math.random() < settings.botSplitChance) {
                    const newCell = cell.split(targetDirection, getNextCellId());
                    if (newCell) {
                        newBotCells.push(newCell);
                    }
                }
                
                cell.update();
            });
            
            for (let i = cells.length - 1; i >= 0; i--) {
                for (let j = i - 1; j >= 0; j--) {
                    const cellA = cells[i];
                    const cellB = cells[j];
                    
                    if (cellA.mergeCooldown <= 0 && cellB.mergeCooldown <= 0) {
                        const dist = cellA.position.subtract(cellB.position).magnitude();
                        if (dist < cellA.radius + cellB.radius) { 
                            const bigger = cellA.mass > cellB.mass ? cellA : cellB;
                            const smaller = cellA.mass > cellB.mass ? cellB : cellA;
                            
                            bigger.mass += smaller.mass;
                            bigger.radius = bigger.calculateRadius();
                            
                            const smallerIndex = botCells.indexOf(smaller);
                            if (smallerIndex > -1) {
                                botCells.splice(smallerIndex, 1);
                                cells.splice(cells.indexOf(smaller), 1);
                                if (smallerIndex <= i) i--;
                                if (smallerIndex <= j) j--;
                            }
                        }
                    }
                }
            }
        });
        
        gameInstance.botCells.push(...newBotCells);
        
        // --- 3. Atualização e Fusão do Jogador ---
        playerCells.forEach(cell => cell.update());

        for (let i = playerCells.length - 1; i >= 0; i--) {
          for (let j = i - 1; j >= 0; j--) {
            const cellA = playerCells[i];
            const cellB = playerCells[j];
            
            if (cellA.mergeCooldown <= 0 && cellB.mergeCooldown <= 0) {
              const dist = cellA.position.subtract(cellB.position).magnitude();
              if (dist < cellA.radius + cellB.radius) { 
                const bigger = cellA.mass > cellB.mass ? cellA : cellB;
                const smaller = cellA.mass > cellB.mass ? cellB : cellA;
                bigger.mass += smaller.mass;
                bigger.radius = bigger.calculateRadius();
                
                const smallerIndex = playerCells.indexOf(smaller);
                if (smallerIndex > -1) {
                    playerCells.splice(smallerIndex, 1);
                    if (smallerIndex <= i) i--;
                    if (smallerIndex <= j) j--;
                }
              }
            }
          }
        }

        allCells = [...playerCells, ...botCells];

        // --- 5. Detecção de Colisão (Comer) ---
        
        for (let i = allCells.length - 1; i >= 0; i--) {
            for (let j = i - 1; j >= 0; j--) {
                const cellA = allCells[i];
                const cellB = allCells[j];
                if (!cellA || !cellB) continue;

                const distVec = cellA.position.subtract(cellB.position);
                const distance = distVec.magnitude();

                if (distance < Math.max(cellA.radius, cellB.radius)) {
                    let predator, prey;
                    if (cellA.mass > cellB.mass * 1.15) {
                        predator = cellA;
                        prey = cellB;
                    } else if (cellB.mass > cellA.mass * 1.15) {
                        predator = cellB;
                        prey = cellA;
                    } else {
                        continue;
                    }
                    
                    if (predator.name === prey.name) continue;

                    const deathDistance = predator.radius - prey.radius * 0.3;
                    if (distance < deathDistance) {
                        predator.mass += prey.mass;
                        predator.radius = predator.calculateRadius();
                        
                        if (predator instanceof Player || !predator.isBot) {
                            playCollect();
                        }
                        
                        const preyIndexInPlayer = playerCells.indexOf(prey as Player);
                        if (preyIndexInPlayer > -1) playerCells.splice(preyIndexInPlayer, 1);

                        const preyIndexInBots = botCells.indexOf(prey);
                        if (preyIndexInBots > -1) {
                            botCells.splice(preyIndexInBots, 1);
                            if (prey.isBot) {
                                botNamesRef.current.push(prey.name);
                            }
                        }
                        
                        allCells.splice(allCells.indexOf(prey), 1);
                        if (allCells.indexOf(predator) < i) i--;
                        if (allCells.indexOf(predator) < j) j--;
                    }
                }
            }
        }
        
        // --- 6. Safety Check: Limit total bot cells to prevent performance issues ---
        const totalBotCells = botCells.length;
        if (totalBotCells > MAX_TOTAL_BOT_CELLS) {
            const sortedBotCells = [...botCells].sort((a, b) => a.mass - b.mass);
            
            const cellsToRemove = sortedBotCells.slice(0, totalBotCells - MAX_TOTAL_BOT_CELLS);
            cellsToRemove.forEach(cell => {
                const index = botCells.indexOf(cell);
                if (index > -1) {
                    botCells.splice(index, 1);
                    botNamesRef.current.push(cell.name);
                }
            });
        }
        
        // --- 7. Respawn de Bots ---
        while (botCells.length < initialBotCount) {
            const newBotName = botNamesRef.current.shift() || `Bot ${Math.random().toString(36).substring(7)}`;
            
            let angle = Math.random() * Math.PI * 2;
            let distance = Math.random() * (WORLD_RADIUS * 0.8) + WORLD_RADIUS * 0.1;
            const newPosition = new Vector(
              WORLD_CENTER_X + Math.cos(angle) * distance,
              WORLD_CENTER_Y + Math.sin(angle) * distance
            );
            
            const initialBotMass = Math.random() * 1000 + 250; 
            
            const newBot = new Cell(
                newPosition.x,
                newPosition.y,
                getRandomColor(),
                initialBotMass,
                newBotName,
                getNextCellId(),
                true
            );
            botCells.push(newBot);
        }
        
        // 9. Atualização de Câmera e Score
        const initialMassForScore = MIN_CELL_RADIUS * MIN_CELL_RADIUS / 2; 
        const currentScore = Math.floor(totalPlayerMass - initialMassForScore);
        
        gameInstance.score = currentScore;
        if (currentScore > gameInstance.maxScore) {
            gameInstance.maxScore = currentScore;
        }

        // NEW: Trigger congrats once when reaching threshold
        if (!hasWonRef.current && gameInstance.score >= CONGRATS_SCORE) {
          hasWonRef.current = true;
          setIsPaused(true); // pause the game
          setShowCongrats(true); // show modal
        }

        let centerX = WORLD_CENTER_X;
        let centerY = WORLD_CENTER_Y;
        let avgRadius = MIN_CELL_RADIUS;

        if (playerCells.length > 0) {
            centerX = playerCenterOfMass.x;
            centerY = playerCenterOfMass.y;
            avgRadius = avgPlayerRadius;
            
            camera.x += (centerX - camera.x) * 0.05;
            camera.y += (centerY - camera.y) * 0.05;
            
            camera.zoom = fixedZoomRef.current; 
        }
        
        const viewportWidth = canvas.width / camera.zoom;
        const viewportHeight = canvas.height / camera.zoom;
        const viewLeft = camera.x - viewportWidth / 2;
        const viewTop = camera.y - viewportHeight / 2;
        const viewRight = camera.x + viewportWidth / 2;
        const viewBottom = camera.y + viewportHeight / 2;

        // Colisão de Pellets (Otimizado)
        for (let i = pellets.length - 1; i >= 0; i--) {
            const pellet = pellets[i];
            
            if (pellet.position.x < viewLeft || pellet.position.x > viewRight ||
                pellet.position.y < viewTop || pellet.position.y > viewBottom) {
                continue;
            }
            
            for (const cell of allCells) {
                if (!pellet) continue;
                const dist = cell.position.subtract(pellet.position).magnitude();
                if (dist < cell.radius) {
                    cell.mass += 10;
                    cell.radius = cell.calculateRadius();
                    pellets.splice(i, 1);
                    
                    if (cell instanceof Player || !cell.isBot) {
                        playCollect();
                    }
                    break; 
                }
            }
        }
        
        // Respawn de Pellets
        if (pellets.length < PELLET_COUNT) {
          let angle = Math.random() * Math.PI * 2;
          let distance = Math.random() * (WORLD_RADIUS * 0.8) + WORLD_RADIUS * 0.1;
          const newPellet = new Pellet(getRandomColor());
          newPellet.position = new Vector(
            WORLD_CENTER_X + Math.cos(angle) * distance,
            WORLD_CENTER_Y + Math.sin(angle) * distance
          );
          pellets.push(newPellet);
        }

        // Prepare minimap data
        const visibleBots = botCells
            .map(bot => ({
                x: bot.position.x,
                y: bot.position.y,
                mass: bot.mass,
                color: bot.color,
                radius: bot.radius,
            }));

        setMinimapData({
            playerCenter: { x: centerX, y: centerY },
            playerRadius: avgRadius, 
            visibleBots: visibleBots,
        });

        // --- RENDER PASS ---
        // Clear canvas and draw world with camera transform
        try {
          // handle device pixel ratio for crisper rendering
          const dpr = Math.max(1, window.devicePixelRatio || 1);
          if (canvas.width !== Math.floor(window.innerWidth * dpr) || canvas.height !== Math.floor(window.innerHeight * dpr)) {
            canvas.width = Math.floor(window.innerWidth * dpr);
            canvas.height = Math.floor(window.innerHeight * dpr);
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
          }

          // clear entire canvas
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Set camera transform: scale = camera.zoom * devicePixelRatio adjustment
          const scale = (camera.zoom || 1) * dpr;
          const tx = canvas.width / 2 - camera.x * scale;
          const ty = canvas.height / 2 - camera.y * scale;
          ctx.setTransform(scale, 0, 0, scale, tx, ty);

          // draw background (world image) fitting the world coordinates
          if (bgImgRef.current) {
            try {
              ctx.drawImage(
                bgImgRef.current,
                WORLD_CENTER_X - WORLD_SIZE / 2,
                WORLD_CENTER_Y - WORLD_SIZE / 2,
                WORLD_SIZE,
                WORLD_SIZE
              );
            } catch (e) {
              // fallback fill if drawing image fails
              ctx.fillStyle = '#f3fff7';
              ctx.fillRect(WORLD_CENTER_X - WORLD_SIZE / 2, WORLD_CENTER_Y - WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE);
            }
          } else {
            // fallback background
            ctx.fillStyle = '#f3fff7';
            ctx.fillRect(WORLD_CENTER_X - WORLD_SIZE / 2, WORLD_CENTER_Y - WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE);
          }

          // draw pellets
          for (let i = 0; i < pellets.length; i++) {
            pellets[i].draw(ctx);
          }

          // draw bots (under player)
          for (let i = 0; i < botCells.length; i++) {
            botCells[i].draw(ctx, false);
          }

          // draw player cells on top
          for (let i = 0; i < playerCells.length; i++) {
            playerCells[i].draw(ctx, true);
          }

          // draw world border for reference (darker stroke)
          ctx.beginPath();
          ctx.arc(WORLD_CENTER_X, WORLD_CENTER_Y, WORLD_RADIUS, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'; // darker border
          ctx.lineWidth = 12;
          ctx.stroke();
          ctx.closePath();

          // restore to HUD coordinate space (reset transform)
          ctx.setTransform(1, 0, 0, 1, 0, 0);

          // --- VIGNETTE: darken outside circle area to emphasize world limits ---
          try {
            const screenScale = scale;
            const worldScreenX = canvas.width / 2; // camera centers world center to canvas center
            const worldScreenY = canvas.height / 2;
            const worldScreenR = WORLD_RADIUS * screenScale;

            // draw semi-transparent overlay covering whole canvas
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // punch a hole where the world is (destination-out)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(worldScreenX, worldScreenY, worldScreenR, 0, Math.PI * 2);
            ctx.fill();
            ctx.closePath();

            // restore to normal compositing and draw subtle inner glow (optional)
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.arc(worldScreenX, worldScreenY, worldScreenR - 6 * dpr, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(worldScreenX, worldScreenY, worldScreenR - 60 * dpr, worldScreenX, worldScreenY, worldScreenR);
            grad.addColorStop(0, 'rgba(0,0,0,0.0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.4)');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.closePath();
          } catch (vErr) {
            // swallow vignette errors
            console.error('Vignette error', vErr);
          }

          // draw HUD (score) in top-left corner (pixel-scaled)
          const dpr = Math.max(1, window.devicePixelRatio || 1);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 2;
          ctx.font = `${16 * dpr}px Quicksand, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const scoreText = `Score: ${gameInstance.score.toLocaleString()}`;
          const maxText = `Max: ${gameInstance.maxScore.toLocaleString()}`;
          // small panel background
          const padding = 8 * dpr;
          const panelW = 160 * dpr;
          const panelH = 44 * dpr;
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          roundRect(ctx, 10 * dpr, 10 * dpr, panelW, panelH, 8 * dpr, true, true);
          ctx.fillStyle = 'rgba(0,0,0,0.85)';
          ctx.fillText(scoreText, 16 * dpr, 14 * dpr);
          ctx.fillText(maxText, 16 * dpr, 14 * dpr + 18 * dpr);

          // --- TOP5 PANEL (top-right) ---
          try {
            const panelWidth = 220 * dpr;
            const panelX = canvas.width - panelWidth - 12 * dpr;
            const panelY = 12 * dpr;
            const rowH = 22 * dpr;
            const headerH = 30 * dpr;
            const rowsToShow = 5;
            // background
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            roundRect(ctx, panelX, panelY, panelWidth, headerH + rowH * rowsToShow + 12 * dpr, 10 * dpr, true, true);
            // header
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.font = `${14 * dpr}px Quicksand, sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText('Top 5', panelX + 12 * dpr, panelY + 8 * dpr);
            ctx.font = `${12 * dpr}px Quicksand, sans-serif`;
            // entries
            const topList = Array.isArray(leaderboard) ? leaderboard.slice(0, rowsToShow) : [];
            for (let i = 0; i < rowsToShow; i++) {
              const entry = topList[i];
              const y = panelY + headerH + i * rowH + 4 * dpr;
              if (entry) {
                // rank
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillText(`${i + 1}. ${entry.name}`, panelX + 12 * dpr, y);
                // score (right aligned)
                ctx.textAlign = 'right';
                ctx.fillText(`${entry.score}`, panelX + panelWidth - 12 * dpr, y);
                ctx.textAlign = 'left';
              } else {
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.fillText(`${i + 1}. ---`, panelX + 12 * dpr, y);
                ctx.textAlign = 'right';
                ctx.fillText(`0`, panelX + panelWidth - 12 * dpr, y);
                ctx.textAlign = 'left';
              }
            }
          } catch (topErr) {
            console.error('Top5 draw error', topErr);
          }

        } catch (renderErr) {
          console.error('Render error:', renderErr);
        }

    } catch (error) {
        console.error('Error in game loop:', error);
    }

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [difficulty, onGameOver, highScore, leaderboard, gameInstance, playerName, playCollect, playSplit, initialBotCount, isMobile, isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // initial canvas sizing (we handle dpr in render pass too)
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    
    const zoomX = canvas.width / WORLD_SIZE;
    const zoomY = canvas.height / WORLD_SIZE;
    
    const minZoom = Math.min(zoomX, zoomY);
    fixedZoomRef.current = minZoom * 2.25; 
    
    gameInstance.camera.zoom = fixedZoomRef.current;

    if (!bgImgRef.current) {
        const img = new Image();
        img.onload = () => {
            bgImgRef.current = img;
        };
        img.src = heroBgImage;
    }

    const settings = difficultySettings[difficulty];
    
    nextCellId = 1; 
    
    const savedState = loadGameState();

    if (savedState) {
        console.log("Loading saved game state...");
        
        gameInstance.playerCells = savedState.playerCells.map(c => {
            const player = new Player(c.x, c.y, c.color, c.mass, c.name);
            player.id = getNextCellId();
            return player;
        });
        
        gameInstance.botCells = savedState.botCells.map(c => {
            const bot = new Cell(c.x, c.y, c.color, c.mass, c.name, getNextCellId(), true);
            return bot;
        });
        
        gameInstance.pellets = savedState.pellets.map(p => new Pellet(p.color, p.x, p.y));
        
        gameInstance.camera = savedState.camera;
        gameInstance.score = savedState.score;
        gameInstance.maxScore = savedState.maxScore;
        
    } else {
        const initialPlayerMass = MIN_CELL_RADIUS * MIN_CELL_RADIUS / 2; 
        gameInstance.playerCells = [new Player(WORLD_CENTER_X, WORLD_CENTER_Y, '#2196F3', initialPlayerMass, playerName)];
        gameInstance.viruses = [];
        
        const botCount = settings.botCount;
        const finalBotNames = generateBotNames(botCount);
        botNamesRef.current = [...finalBotNames];

        gameInstance.botCells = Array.from({ length: botCount }, (_, i) => {
            const name = finalBotNames[i];
            
            let angle = Math.random() * Math.PI * 2;
            let distance = Math.random() * (WORLD_RADIUS * 0.8) + WORLD_RADIUS * 0.1;
            const spawnPosition = new Vector(
              WORLD_CENTER_X + Math.cos(angle) * distance,
              WORLD_CENTER_Y + Math.sin(angle) * distance
            );
            
            const initialBotMass = Math.random() * 1000 + 250; 
            
            return new Cell(
                spawnPosition.x,
                spawnPosition.y,
                getRandomColor(),
                initialBotMass,
                name,
                getNextCellId(),
                true
            );
        });
        
        gameInstance.pellets = Array.from({ length: PELLET_COUNT }, () => new Pellet(getRandomColor()));
        gameInstance.score = 0;
        gameInstance.maxScore = 0; 
    }
    
    setIsPlaying(true); 

    animationFrameId.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameLoop, difficulty, gameInstance, playerName, initialBotCount]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', touchAction: isMobile ? 'none' : 'auto' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      
      <Button 
        variant="secondary" 
        size="icon" 
        onClick={handlePause} 
        className="fixed bottom-4 left-4 z-[100] shadow-lg"
        disabled={!isPlaying || isPaused}
      >
        <Pause className="w-5 h-5" />
      </Button>

      {isMobile && !isPaused && (
        <div className="fixed inset-0 z-50"> 
          <VirtualJoystick onMove={handleJoystickMove} />
          <SplitButton onSplit={handleSplit} />
        </div>
      )}
      
      <Minimap {...minimapData} />
      
      {isPaused && (
        <PauseMenu 
          onResume={handleResume}
          onRestart={handleRestart}
          onExit={handleExit}
        />
      )}

      <CongratsModal
        isOpen={showCongrats}
        playerName={playerName}
        score={gameInstance.score}
        onRestart={handleRestart}
        onExit={handleExit}
        onClose={() => setShowCongrats(false)}
      />
    </div>
  );
};

export default DivideIoGame;

/**
 * helper: draw rounded rectangle
 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: boolean, stroke: boolean) {
  if (r < 0) r = 0;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}