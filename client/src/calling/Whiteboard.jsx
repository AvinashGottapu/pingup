import React, { useRef, useState, useEffect } from "react";
import { X, Trash2, Edit2 } from "lucide-react";

const Whiteboard = ({ socket, roomId, onClose, historyRef }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ffffff"); // Default to white since background is dark
  const [lineWidth, setLineWidth] = useState(5);
  const lastPos = useRef({ x: 0, y: 0 });

  // Available drawing colors matching PingUp's dark/glowing theme
  const colors = [
    { name: "White", value: "#ffffff" },
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#10b981" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Yellow", value: "#f59e0b" },
    { name: "Purple", value: "#a855f7" }
  ];

  // Available brush sizes
  const brushSizes = [
    { label: "Thin", value: 2 },
    { label: "Medium", value: 4 },
    { label: "Thick", value: 8 }
  ];

  // Helper to get coordinates relative to the canvas DOM element
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Resolve client coordinate for mouse vs touch event
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX; // On the phone.. There is no mouse.
      clientY = e.touches[0].clientY;
      // 0 means which means The first finger touching the screen..
    } else {
      clientX = e.clientX; // On a computer, drawing happens with a mouse.
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Main drawing drawer
  const drawLine = (x0, y0, x1, y1, strokeColor, width) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  // Mouse / Touch Start Handlers
  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    if (!coords) return;
    setIsDrawing(true);
    lastPos.current = coords;
  };

  // Mouse / Touch Move Handlers
  const draw = (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const x0 = lastPos.current.x;
    const y0 = lastPos.current.y;
    const x1 = coords.x;
    const y1 = coords.y;

    // Draw locally using internal canvas coordinates (matches DOM pixels 1:1)
    drawLine(x0, y0, x1, y1, color, lineWidth);

    // Save segment in normalized coordinates to shared history ref
    const segment = {
      x0: x0 / canvas.width,
      y0: y0 / canvas.height,
      x1: x1 / canvas.width,
      y1: y1 / canvas.height,
      color,
      lineWidth
    };

    if (historyRef) {
      historyRef.current.push(segment);
    }

    // Emit normalized drawing action to Socket room
    if (socket && roomId) {
      socket.emit("whiteboard:draw", {
        roomId,
        drawData: segment
      });
    }

    lastPos.current = coords;
  };

  // Mouse / Touch End Handlers
  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Clear Board Handler
  const clearBoard = (emit = true) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (historyRef) {
      historyRef.current = [];
    }

    if (emit && socket && roomId) {
      socket.emit("whiteboard:clear", { roomId });
    }
  };

  // Socket Listener Effect
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDraw = ({ drawData }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Draw locally, scaled by current canvas resolution
      drawLine(
        drawData.x0 * canvas.width,
        drawData.y0 * canvas.height,
        drawData.x1 * canvas.width,
        drawData.y1 * canvas.height,
        drawData.color,
        drawData.lineWidth
      );
    };

    const handleRemoteClear = () => {
      clearBoard(false);
    };

    socket.on("whiteboard:draw", handleRemoteDraw);
    socket.on("whiteboard:clear", handleRemoteClear);

    return () => {
      socket.off("whiteboard:draw", handleRemoteDraw);
      socket.off("whiteboard:clear", handleRemoteClear);
    };
  }, [socket, roomId]);

  // Handle canvas sizing and redraw drawing history on element size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      // Actual size of the canvas on the screen
      const rect = canvas.getBoundingClientRect();
      // Only resize buffer if dimensions changed (prevents drawing lags/resets)
      if (canvas.width === rect.width && canvas.height === rect.height) return;

      canvas.width = rect.width;
      canvas.height = rect.height;
      
      const ctx = canvas.getContext("2d");
      if (ctx && historyRef && historyRef.current) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // smooths the joints between the micro-lines so it looks like a perfect curve!
        
        // Redraw all drawing history segments scaled to new canvas width/height
        historyRef.current.forEach((segment) => {
          ctx.beginPath();
          ctx.moveTo(segment.x0 * canvas.width, segment.y0 * canvas.height);
          ctx.lineTo(segment.x1 * canvas.width, segment.y1 * canvas.height);
          ctx.strokeStyle = segment.color;
          ctx.lineWidth = segment.lineWidth;
          ctx.stroke();
        });
      }
    };

    // Use ResizeObserver for accurate container dimensions (resolves animations/mobile layout paint latency)
    const observer = new ResizeObserver(() => {
      resizeCanvas();
      // ResizeObserver is a browser API that watches an HTML element.
      // "If this element's size changes, call my function."
    });
    observer.observe(canvas);
    // This tells the observer: "Start watching this canvas."
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between p-6 select-none animate-in fade-in duration-300">
      
      {/* Header with name and Cross back-to-call button */}
      <div className="w-full max-w-5xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
            <Edit2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Collaborative Whiteboard</h2>
            <p className="text-xs text-slate-400">Draw together in real-time</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 hover:border-slate-700 transition-all cursor-pointer shadow-lg active:scale-95 flex items-center justify-center"
          title="Back to Call"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas Element Container */}
      <div className="w-full max-w-5xl flex-1 relative bg-slate-900 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full cursor-crosshair bg-slate-900"
        />
      </div>

      {/* Footer controls for color, brush size and clearing */}
      <div className="w-full max-w-4xl mt-6 bg-slate-900/80 backdrop-blur-xl border border-slate-850 px-6 py-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
        
        {/* Colors Row */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 mr-1">Colors</span>
          <div className="flex items-center gap-2">
            {colors.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={`w-7 h-7 rounded-full transition-all cursor-pointer border ${
                  color === c.value
                    ? "border-white scale-110 shadow-lg shadow-white/10"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Brush Sizes Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400 mr-1">Size</span>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-850">
            {brushSizes.map((size) => (
              <button
                key={size.value}
                onClick={() => setLineWidth(size.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  lineWidth === size.value
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trash Command */}
        <button
          onClick={() => clearBoard(true)}
          className="px-4 py-2 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/25 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all cursor-pointer active:scale-95"
          title="Clear Entire Canvas"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear Board</span>
        </button>
      </div>

    </div>
  );
};

export default Whiteboard;
