import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Shuffle, Check, X } from "lucide-react";

interface PuzzlePiece {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  correctX: number;
  correctY: number;
  path: string;
  color: string;
  isPlaced: boolean;
}

interface PuzzleGameProps {
  onBack: () => void;
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#10AC84', '#EE5A24', '#0984E3', '#6C5CE7', '#A29BFE'
];

const LANDSCAPE_SCENES = [
  {
    name: "Forest Walk",
    description: "Relaxing walk in the nature",
    generateScene: (width: number, height: number) => {
      const elements = [];
      // Sky
      elements.push({ type: 'rect', props: { x: 0, y: 0, width, height: height * 0.4, fill: '#87CEEB' } });
      // Hills
      elements.push({ type: 'path', props: { d: `M 0 ${height * 0.35} Q ${width * 0.3} ${height * 0.25} ${width * 0.6} ${height * 0.35} Q ${width * 0.8} ${height * 0.4} ${width} ${height * 0.3} L ${width} ${height * 0.4} L 0 ${height * 0.4} Z`, fill: '#90EE90' } });
      // Ground
      elements.push({ type: 'rect', props: { x: 0, y: height * 0.4, width, height: height * 0.6, fill: '#228B22' } });
      // Sun
      elements.push({ type: 'circle', props: { cx: width * 0.85, cy: height * 0.15, r: 25, fill: '#FFD700', opacity: 0.8 } });

      // Trees
      [0.1, 0.25, 0.4, 0.6, 0.75, 0.9].forEach((xPos, i) => {
        const scale = 0.8 + Math.random() * 0.4;
        const treeY = height * 0.4 + (height * 0.2);
        elements.push({ type: 'rect', props: { x: width * xPos - 4 * scale, y: treeY, width: 8 * scale, height: 30 * scale, fill: '#8B4513' } });
        elements.push({ type: 'circle', props: { cx: width * xPos, cy: treeY - 15 * scale, r: 20 * scale, fill: i % 2 === 0 ? '#006400' : '#008000' } });
      });
      // Path
      elements.push({ type: 'ellipse', props: { cx: width * 0.5, cy: height * 0.8, rx: width * 0.3, ry: 20, fill: '#DEB887' } });
      return elements;
    }
  },
  {
    name: "Sunset City",
    description: "City skyline at sunset",
    generateScene: (width: number, height: number) => {
      const elements = [];
      // Sky Gradient (Simulated with rects)
      elements.push({ type: 'rect', props: { x: 0, y: 0, width, height: height, fill: '#2C3E50' } });
      elements.push({ type: 'rect', props: { x: 0, y: 0, width, height: height * 0.6, fill: '#E74C3C' } });
      elements.push({ type: 'rect', props: { x: 0, y: 0, width, height: height * 0.3, fill: '#3498DB' } });

      // Sun
      elements.push({ type: 'circle', props: { cx: width * 0.5, cy: height * 0.6, r: 40, fill: '#F1C40F', opacity: 0.9 } });

      // Buildings
      const buildingCount = 12;
      const bWidth = width / buildingCount;
      for (let i = 0; i < buildingCount; i++) {
        const h = 40 + Math.random() * 100;
        elements.push({ type: 'rect', props: { x: i * bWidth, y: height - h, width: bWidth + 2, height: h, fill: '#2C3E50' } });
        // Windows
        for (let j = 0; j < h / 15; j++) {
          if (Math.random() > 0.3) {
            elements.push({ type: 'rect', props: { x: i * bWidth + 5, y: height - h + (j * 12) + 5, width: bWidth - 10, height: 8, fill: '#F1C40F', opacity: 0.5 } });
          }
        }
      }
      return elements;
    }
  },
  {
    name: "Space Mission",
    description: "Rocket flying in deep space",
    generateScene: (width: number, height: number) => {
      const elements = [];
      // Background
      elements.push({ type: 'rect', props: { x: 0, y: 0, width, height, fill: '#0B0B2A' } });

      // Stars
      for (let i = 0; i < 50; i++) {
        elements.push({
          type: 'circle',
          props: { cx: Math.random() * width, cy: Math.random() * height, r: Math.random() * 2, fill: 'white', opacity: Math.random() }
        });
      }

      // Planet
      elements.push({ type: 'circle', props: { cx: width * 0.8, cy: height * 0.2, r: 40, fill: '#E67E22' } });
      elements.push({ type: 'ellipse', props: { cx: width * 0.8, cy: height * 0.2, rx: 60, ry: 10, fill: 'none', stroke: '#BDC3C7', strokeWidth: 2, transform: `rotate(-20 ${width * 0.8} ${height * 0.2})` } });

      // Rocket
      const rx = width * 0.3, ry = height * 0.6;
      elements.push({ type: 'path', props: { d: `M ${rx} ${ry} L ${rx + 20} ${ry} L ${rx + 10} ${ry - 40} Z`, fill: '#ECF0F1' } }); // Body
      elements.push({ type: 'path', props: { d: `M ${rx} ${ry} L ${rx - 5} ${ry + 10} L ${rx + 10} ${ry} Z`, fill: '#E74C3C' } }); // Fin L
      elements.push({ type: 'path', props: { d: `M ${rx + 20} ${ry} L ${rx + 25} ${ry + 10} L ${rx + 10} ${ry} Z`, fill: '#E74C3C' } }); // Fin R
      elements.push({ type: 'circle', props: { cx: rx + 10, cy: ry - 20, r: 5, fill: '#3498DB' } }); // Window

      // Flame
      elements.push({ type: 'path', props: { d: `M ${rx + 5} ${ry} L ${rx + 15} ${ry} L ${rx + 10} ${ry + 20} Z`, fill: '#F39C12' } });

      return elements;
    }
  },
  {
    name: "Underwater World",
    description: "Fish swimming in the ocean",
    generateScene: (width: number, height: number) => {
      const elements = [];
      // Water
      elements.push({ type: 'rect', props: { x: 0, y: 0, width, height, fill: '#1ABC9C' } });

      // Bubbles
      for (let i = 0; i < 20; i++) {
        elements.push({ type: 'circle', props: { cx: Math.random() * width, cy: Math.random() * height, r: 2 + Math.random() * 5, fill: 'white', opacity: 0.3 } });
      }

      // Sand
      elements.push({ type: 'rect', props: { x: 0, y: height * 0.8, width, height: height * 0.2, fill: '#F39C12' } });

      // Seaweed
      for (let i = 0; i < 10; i++) {
        const x = i * (width / 10) + Math.random() * 20;
        elements.push({ type: 'path', props: { d: `M ${x} ${height} Q ${x - 10} ${height * 0.9} ${x} ${height * 0.8} Q ${x + 10} ${height * 0.7} ${x} ${height * 0.6}`, fill: 'none', stroke: '#27AE60', strokeWidth: 5 } });
      }

      // Fish
      const fishColors = ['#E74C3C', '#F1C40F', '#9B59B6'];
      fishColors.forEach((color, i) => {
        const x = width * 0.2 + (i * 80);
        const y = height * 0.3 + (i * 40);
        // Body
        elements.push({ type: 'ellipse', props: { cx: x, cy: y, rx: 20, ry: 12, fill: color } });
        // Tail
        elements.push({ type: 'path', props: { d: `M ${x - 15} ${y} L ${x - 30} ${y - 10} L ${x - 30} ${y + 10} Z`, fill: color } });
        // Eye
        elements.push({ type: 'circle', props: { cx: x + 10, cy: y - 4, r: 2, fill: 'white' } });
      });

      return elements;
    }
  }
];

export default function PuzzleGame({ onBack }: PuzzleGameProps) {
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  // Use 'hand' to store IDs of pieces currently available to select
  const [hand, setHand] = useState<number[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<number | null>(null);
  const [score, setScore] = useState<number>(0);
  const [placedCount, setPlacedCount] = useState<number>(0);
  const [totalPieces, setTotalPieces] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [currentPattern, setCurrentPattern] = useState<string>("");
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(5);
  const [errorCell, setErrorCell] = useState<number | null>(null);

  const [puzzleSize, setPuzzleSize] = useState({ width: 300, height: 300 });

  // Generate random puzzle
  const generatePuzzle = useCallback(() => {
    // Randomize scene selection!
    const randomSceneIndex = Math.floor(Math.random() * LANDSCAPE_SCENES.length);
    const scene = LANDSCAPE_SCENES[randomSceneIndex];

    const pieceSize = 60;
    const rows = 5;
    const cols = 4;
    const totalPcs = rows * cols;

    setCurrentPattern(scene.name);
    setTotalPieces(totalPcs);
    setPlacedCount(0);
    setScore(0);
    setIsCompleted(false);
    setShowPreview(true);
    setCountdown(5);
    setHand([]);
    setSelectedPieceId(null);
    setErrorCell(null);

    const newPieces: PuzzlePiece[] = [];

    // Generate the landscape scene
    const sceneWidth = cols * pieceSize;
    const sceneHeight = rows * pieceSize;
    const sceneElements = scene.generateScene(sceneWidth, sceneHeight);

    // Initial pieces creation (all unplaced)
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const id = row * cols + col;
        const correctX = col * pieceSize;
        const correctY = row * pieceSize;
        const path = `M 2 2 L ${pieceSize - 2} 2 L ${pieceSize - 2} ${pieceSize - 2} L 2 ${pieceSize - 2} Z`;
        const color = COLORS[id % COLORS.length];

        newPieces.push({
          id,
          x: 0, // Not used in this mode
          y: 0, // Not used in this mode
          width: pieceSize,
          height: pieceSize,
          correctX,
          correctY,
          path,
          color,
          isPlaced: false,
        });
      }
    }

    setPieces(newPieces);
    setPuzzleSize({ width: cols * pieceSize, height: rows * pieceSize });

    // Store scene elements for rendering
    (window as any).currentSceneElements = sceneElements;

    // Start countdown
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setShowPreview(false);
          // Initialize hand with 4 random pieces
          const allIds = newPieces.map(p => p.id);
          const shuffled = [...allIds].sort(() => 0.5 - Math.random());
          setHand(shuffled.slice(0, 4));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handlePieceSelect = (id: number) => {
    setSelectedPieceId(id);
    setErrorCell(null);
  };

  const handleGridClick = (index: number) => {
    setErrorCell(null);

    // If spot is already taken, ignore
    if (pieces[index].isPlaced) return;

    // If no piece selected, maybe prompt or ignore
    if (selectedPieceId === null) return;

    // Check match
    if (selectedPieceId === index) {
      // Correct!
      setPieces(prev => prev.map(p =>
        p.id === index ? { ...p, isPlaced: true } : p
      ));

      setScore(prev => prev + 10);
      setPlacedCount(prev => {
        const newCount = prev + 1;
        if (newCount === totalPieces) setIsCompleted(true);
        return newCount;
      });

      // Update Hand
      // Remove placed piece from hand
      setHand(prevHand => {
        const newHand = prevHand.filter(id => id !== selectedPieceId);

        // Find pool of available unplaced pieces NOT in hand
        const currentPlacedIds = pieces.filter(p => p.isPlaced).map(p => p.id);
        // Add the one we just placed to "placed" list logically for this calc (though state update is async)
        const allPlaced = [...currentPlacedIds, index];

        const availablePool = pieces
          .filter(p => !allPlaced.includes(p.id) && !newHand.includes(p.id) && p.id !== selectedPieceId)
          .map(p => p.id);

        if (availablePool.length > 0 && newHand.length < 4) {
          const randomNext = availablePool[Math.floor(Math.random() * availablePool.length)];
          return [...newHand, randomNext];
        }
        return newHand;
      });

      setSelectedPieceId(null);
    } else {
      // Incorrect!
      setErrorCell(index);
      // Optional: deduct score?
      setScore(prev => Math.max(0, prev - 5));
      setTimeout(() => setErrorCell(null), 1000);
    }
  };

  // Initialize with first puzzle
  useEffect(() => {
    generatePuzzle();
  }, [generatePuzzle]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/20 border-b shrink-0">
        <Button variant="outline" size="sm" onClick={onBack}>
          ← Geri
        </Button>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <span className="font-bold">{score}</span>
            <span className="text-muted-foreground">score</span>
          </div>
          <div className="w-px h-3 bg-muted"></div>
          <div className="flex items-center gap-1">
            <span className="font-bold">{placedCount}</span>
            <span className="text-muted-foreground">/ {totalPieces}</span>
          </div>
        </div>
        <Button onClick={generatePuzzle} size="sm" variant="outline">
          <Shuffle className="h-3 w-3" />
        </Button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="border-blue-500 max-w-md w-full">
            <CardContent className="p-6 text-center">
              <h2 className="text-xl font-bold mb-4">Preview - {currentPattern}</h2>
              {/* Simple preview visualization */}
              <div className="mb-4 flex justify-center">
                <div className="w-48 h-60 bg-white rounded border-2 border-blue-500 overflow-hidden relative">
                  <svg width="100%" height="100%" viewBox="0 0 240 300">
                    {(window as any).currentSceneElements && (window as any).currentSceneElements.map((el: any, i: number) => {
                      const Component = el.type as any;
                      return <Component key={i} {...el.props} />;
                    })}
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-500 mb-2">{countdown}</div>
              <p className="text-sm text-muted-foreground">seconds remaining</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Completion Modal */}
      {isCompleted && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="border-green-500 max-w-sm w-full">
            <CardContent className="p-4 text-center">
              <Trophy className="h-8 w-8 mx-auto mb-3 text-green-500" />
              <h2 className="text-lg font-bold mb-2">Təbriklər!</h2>
              <div className="text-sm mb-4 space-y-1">
                <p>Puzzle tamamlandı!</p>
                <p>Final Xal: {score}</p>
              </div>
              <Button onClick={generatePuzzle} size="sm" className="w-full">
                Yeni Oyun
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Game Area */}
      <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">

        {/* GRID BOARD (Top) */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div
            className="grid grid-cols-4 gap-1 p-1 bg-muted/10 rounded-lg border-2 border-dashed border-muted-foreground/20 relative"
            style={{ width: 'fit-content' }}
          >
            {/* Show "Not Suitable" overlay if error */}
            {errorCell !== null && (
              <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-red-500 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-bounce">
                  UYĞUN DEYİL ❌
                </div>
              </div>
            )}

            {pieces.map((piece, index) => {
              const row = Math.floor(piece.id / 4);
              const col = piece.id % 4;
              const viewBoxX = col * 60;
              const viewBoxY = row * 60;
              const isError = errorCell === index;

              return (
                <div
                  key={`grid-${index}`}
                  onClick={() => handleGridClick(index)}
                  className={`
                    relative w-[60px] h-[60px] rounded border 
                    ${piece.isPlaced ? 'border-transparent' : 'border-dashed border-muted-foreground/30 hover:bg-muted/30 cursor-pointer'}
                    ${isError ? 'border-red-500 bg-red-500/20 animate-pulse ring-2 ring-red-500' : ''}
                    transition-all duration-200
                  `}
                >
                  {piece.isPlaced && (
                    <div className="w-full h-full overflow-hidden rounded">
                      <svg width="60" height="60" viewBox={`${viewBoxX} ${viewBoxY} 60 60`}>
                        {/* Render full scene inside viewbox */}
                        {(window as any).currentSceneElements && (window as any).currentSceneElements.map((el: any, i: number) => {
                          const Component = el.type as any;
                          return <Component key={i} {...el.props} />;
                        })}
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SELECTION HAND (Bottom) */}
        <div className="h-[120px] shrink-0 bg-muted/10 border-t flex flex-col items-center justify-center p-2">
          <p className="text-xs text-muted-foreground mb-2 font-medium">
            Aşağıdan bir parça seçin və yuxarıda uyğun yerə qoyun:
          </p>
          <div className="flex gap-4">
            {hand.map(id => {
              const piece = pieces.find(p => p.id === id);
              if (!piece) return null;

              const row = Math.floor(piece.id / 4);
              const col = piece.id % 4;
              const viewBoxX = col * 60;
              const viewBoxY = row * 60;
              const isSelected = selectedPieceId === id;

              return (
                <div
                  key={`hand-${id}`}
                  onClick={() => handlePieceSelect(id)}
                  className={`
                        w-[60px] h-[60px] rounded overflow-hidden cursor-pointer
                        border-2 transition-all duration-200 hover:scale-105 shadow-sm
                        ${isSelected ? 'border-blue-500 ring-2 ring-blue-500 scale-110 shadow-lg z-10' : 'border-white'}
                      `}
                >
                  <svg width="60" height="60" viewBox={`${viewBoxX} ${viewBoxY} 60 60`}>
                    {(window as any).currentSceneElements && (window as any).currentSceneElements.map((el: any, i: number) => {
                      const Component = el.type as any;
                      return <Component key={i} {...el.props} />;
                    })}
                  </svg>
                </div>
              );
            })}
            {hand.length === 0 && !isCompleted && totalPieces > 0 && (
              <div className="text-sm text-muted-foreground italic flex items-center">
                Daha parça yoxdur...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}