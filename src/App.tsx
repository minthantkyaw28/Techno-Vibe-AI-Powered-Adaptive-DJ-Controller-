/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, Activity, Music, Settings, User, Brain, Zap, Users, Move } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ObjectDetector, FilesetResolver, Detection } from '@mediapipe/tasks-vision';
import { analyzeVibeWithGemini, GeminiVibeAnalysis } from './services/geminiService';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const requestRef = useRef<number | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [peopleCount, setPeopleCount] = useState(0);
  const [motionIntensity, setMotionIntensity] = useState(0);
  const [activityScore, setActivityScore] = useState(0);
  const [energyLevel, setEnergyLevel] = useState<number>(1);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);
  const [isAutoDjEnabled, setIsAutoDjEnabled] = useState(false);
  const [geminiAnalysis, setGeminiAnalysis] = useState<GeminiVibeAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tracking state
  const prevDetectionsRef = useRef<Detection[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());

  // Capture frame for Gemini analysis
  const captureFrame = (): string | null => {
    if (!videoRef.current || videoRef.current.readyState < 2) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(videoRef.current, 0, 0);
    // Convert to JPEG base64 (without prefix)
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  };

  // Periodic Gemini Analysis (Deep Vibe Check)
  useEffect(() => {
    if (!isCameraActive) return;

    const runAnalysis = async () => {
      if (isAnalyzing) return;
      
      const frame = captureFrame();
      if (!frame) return;

      setIsAnalyzing(true);
      const analysis = await analyzeVibeWithGemini(frame);
      if (analysis) {
        setGeminiAnalysis(analysis);
        
        // Calibrate the heuristic activity score with Gemini's insight
        setActivityScore(prev => (prev * 0.7) + (analysis.activity_score * 0.3));

        // Auto-switch track if enabled
        if (isAutoDjEnabled && analysis.recommended_track !== currentTrack) {
          playTrack(analysis.recommended_track);
        }
      }
      setIsAnalyzing(false);
    };

    const interval = setInterval(runAnalysis, 10000); // Every 10 seconds
    runAnalysis(); // Initial run

    return () => clearInterval(interval);
  }, [isCameraActive, isAnalyzing]);

  // Initialize MediaPipe Object Detector
  useEffect(() => {
    const initDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`,
            delegate: "GPU"
          },
          scoreThreshold: 0.5,
          runningMode: "VIDEO"
        });
        detectorRef.current = detector;
        setIsModelLoading(false);
      } catch (err) {
        console.error("Failed to initialize detector:", err);
        setError("Failed to load AI models. Please check your connection.");
        setIsModelLoading(false);
      }
    };
    initDetector();
  }, []);

  const detectFrame = useCallback(() => {
    if (
      videoRef.current && 
      detectorRef.current && 
      videoRef.current.readyState >= 2
    ) {
      const now = performance.now();
      const deltaTime = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      const results = detectorRef.current.detectForVideo(videoRef.current, now);
      
      // Filter for people only
      const currentPeople = results.detections.filter(d => 
        d.categories[0].categoryName === 'person'
      );
      
      // Calculate movement velocity
      calculateMovement(currentPeople, deltaTime);

      setDetections(currentPeople);
      setPeopleCount(currentPeople.length);
      drawDetections(currentPeople);
      
      // Update Activity Score and Vibe
      updateActivityAndVibe(currentPeople.length, motionIntensity);

      prevDetectionsRef.current = currentPeople;
    }
    requestRef.current = requestAnimationFrame(detectFrame);
  }, [motionIntensity]);

  const updateActivityAndVibe = (count: number, intensity: number) => {
    // Activity Score Formula:
    // Base score from people count (0.2 per person, max 0.6)
    // Plus motion intensity (scaled to 0.4 max)
    const baseScore = Math.min(0.6, count * 0.2);
    const motionScore = (intensity / 100) * 0.4;
    const rawScore = baseScore + motionScore;

    // Smooth activity score with EMA
    setActivityScore(prev => (prev * 0.9) + (rawScore * 0.1));

    // Energy Level Mapping
    // 0.0 – 0.2 → Level 1
    // 0.2 – 0.4 → Level 2
    // 0.4 – 0.6 → Level 3
    // 0.6 – 0.8 → Level 4
    // 0.8 – 1.0 → Level 5
    if (activityScore < 0.2) {
      setEnergyLevel(1);
    } else if (activityScore < 0.4) {
      setEnergyLevel(2);
    } else if (activityScore < 0.6) {
      setEnergyLevel(3);
    } else if (activityScore < 0.8) {
      setEnergyLevel(4);
    } else {
      setEnergyLevel(5);
    }
  };

  const playTrack = (trackName: string) => {
    if (currentTrack === trackName) return;
    
    const trackPath = `/music/${trackName}`;
    setCurrentTrack(trackName);
    
    if (audioRef.current) {
      audioRef.current.src = trackPath;
      audioRef.current.play().catch(err => {
        console.error("Audio playback error:", err);
        setError(`Failed to play track: ${trackName}. Ensure file exists in /music/`);
      });
    }
  };

  // Auto-DJ and Track Switching
  useEffect(() => {
    if (!isCameraActive) return;

    // Auto-DJ: Trigger new track if energy level changes significantly
    if (isAutoDjEnabled && !isAnalyzing) {
      const trackMap: Record<number, string> = {
        1: "Industrial_Hypnosis_2026-04-07T194538.wav",
        2: "Groove_In_Motion_2026-04-07T195527.mp3",
        3: "Groove_In_Motion_2026-04-07T195430.mp3",
        4: "Groove_In_Motion_2026-04-07T195350.mp3",
        5: "Groove_In_Motion_2026-04-07T195228.mp3"
      };

      const targetTrack = trackMap[energyLevel];
      if (targetTrack && targetTrack !== currentTrack) {
        playTrack(targetTrack);
      }
    }
  }, [energyLevel, peopleCount, motionIntensity, isAutoDjEnabled, isCameraActive, currentTrack]);

  const calculateMovement = (current: Detection[], deltaTime: number) => {
    if (prevDetectionsRef.current.length === 0 || current.length === 0) {
      setMotionIntensity(prev => Math.max(0, prev * 0.95)); // Decay if no one
      return;
    }

    let totalDisplacement = 0;
    let matches = 0;

    current.forEach(curr => {
      const currBox = curr.boundingBox!;
      const currCenter = {
        x: currBox.originX + currBox.width / 2,
        y: currBox.originY + currBox.height / 2
      };

      // Find closest person in previous frame (simple centroid tracking)
      let minDistance = Infinity;
      prevDetectionsRef.current.forEach(prev => {
        const prevBox = prev.boundingBox!;
        const prevCenter = {
          x: prevBox.originX + prevBox.width / 2,
          y: prevBox.originY + prevBox.height / 2
        };

        const dist = Math.sqrt(
          Math.pow(currCenter.x - prevCenter.x, 2) + 
          Math.pow(currCenter.y - prevCenter.y, 2)
        );

        if (dist < minDistance) minDistance = dist;
      });

      // If distance is reasonable (not a teleport), count it as movement
      // Threshold is roughly 20% of video width
      if (minDistance < 200) {
        totalDisplacement += minDistance;
        matches++;
      }
    });

    if (matches > 0) {
      // Normalize displacement by time and people count
      // This gives us a "speed" value
      const averageSpeed = (totalDisplacement / matches) / deltaTime;
      
      // Map speed to 0-100 range (empirical scaling)
      const intensity = Math.min(100, averageSpeed * 500);
      
      // Smooth the intensity with EMA
      setMotionIntensity(prev => (prev * 0.8) + (intensity * 0.2));
    } else {
      setMotionIntensity(prev => prev * 0.9);
    }
  };

  const drawDetections = (detections: Detection[]) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas size to match video display size
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight;

    detections.forEach(detection => {
      const { originX, originY, width, height } = detection.boundingBox!;
      
      // Scale coordinates from video resolution to canvas display size
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;

      const x = originX * scaleX;
      const y = originY * scaleY;
      const w = width * scaleX;
      const h = height * scaleY;

      // Draw bounding box
      ctx.strokeStyle = '#6366f1'; // Indigo-500
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Draw label background
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(x, y - 20, 60, 20);

      // Draw label text
      ctx.fillStyle = 'white';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('PERSON', x + 5, y - 7);
    });
  };

  useEffect(() => {
    if (isCameraActive) {
      requestRef.current = requestAnimationFrame(detectFrame);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isCameraActive, detectFrame]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setIsCameraActive(true);
      setError(null);
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError('Could not access webcam. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight uppercase italic">Techno Vibe</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-xs font-mono text-zinc-400">
              <div className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
              {isCameraActive ? 'LIVE' : 'STANDBY'}
            </div>
            <button className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main Feed */}
          <div className="lg:col-span-8 space-y-6">
            <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl group">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-700 ${isCameraActive ? 'opacity-100' : 'opacity-0'}`}
              />
              
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />
              
              <AnimatePresence>
                {(!isCameraActive || isModelLoading) && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm z-20"
                  >
                    {isModelLoading ? (
                      <>
                        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                        <p className="text-zinc-400 font-mono text-sm">LOADING_AI_MODELS...</p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-700">
                          <Camera className="w-8 h-8 text-zinc-500" />
                        </div>
                        <p className="text-zinc-400 mb-6">Camera feed is currently inactive</p>
                        <button
                          onClick={startCamera}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all active:scale-95 shadow-lg shadow-indigo-600/20"
                        >
                          Initialize System
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Overlay UI */}
              {isCameraActive && !isModelLoading && (
                <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between z-30">
                  <div className="flex justify-between items-start">
                    <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-xl">
                      <p className="text-[10px] font-mono text-zinc-400 uppercase mb-1">System Status</p>
                      <p className="text-sm font-mono text-green-400">ACTIVE_DETECTION</p>
                    </div>
                    <button 
                      onClick={stopCamera}
                      className="pointer-events-auto p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-500 transition-colors"
                    >
                      <span className="text-xs font-bold px-2">STOP</span>
                    </button>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <motion.div
                            key={i}
                            animate={{ height: detections.length > 0 ? [4, 16, 4] : [4, 8, 4] }}
                            transition={{ duration: detections.length > 0 ? 0.5 : 1, repeat: Infinity, delay: i * 0.1 }}
                            className={`w-1 rounded-full ${detections.length > 0 ? 'bg-indigo-400' : 'bg-zinc-600'}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs font-mono text-zinc-300">
                        {detections.length > 0 ? `DETECTED: ${detections.length} ${detections.length === 1 ? 'PERSON' : 'PEOPLE'}` : 'SCANNING_ENVIRONMENT...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Sidebar / Controls */}
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Deep Vibe Analysis
              </h2>
              
              {geminiAnalysis ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-mono">ENERGY_LEVEL</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div 
                          key={i} 
                          className={`w-4 h-1.5 rounded-full ${i <= geminiAnalysis.energy_level ? 'bg-indigo-500' : 'bg-zinc-800'}`} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-800/30 p-2 rounded-lg border border-zinc-800 flex flex-col items-center">
                      <Move className="w-3 h-3 text-zinc-500 mb-1" />
                      <span className="text-[8px] text-zinc-500 uppercase">Motion</span>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">{geminiAnalysis.signals.movement}</span>
                    </div>
                    <div className="bg-zinc-800/30 p-2 rounded-lg border border-zinc-800 flex flex-col items-center">
                      <Users className="w-3 h-3 text-zinc-500 mb-1" />
                      <span className="text-[8px] text-zinc-500 uppercase">People</span>
                      <span className="text-[10px] font-bold text-indigo-400">{geminiAnalysis.signals.people_count}</span>
                    </div>
                    <div className="bg-zinc-800/30 p-2 rounded-lg border border-zinc-800 flex flex-col items-center">
                      <Zap className="w-3 h-3 text-zinc-500 mb-1" />
                      <span className="text-[8px] text-zinc-500 uppercase">Density</span>
                      <span className="text-[10px] font-bold text-indigo-400 uppercase">{geminiAnalysis.signals.interaction}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isAnalyzing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-[10px] font-mono text-zinc-500">
                      {isAnalyzing ? 'RE-CALIBRATING...' : `AI_CONFIDENCE: ${(geminiAnalysis.confidence * 100).toFixed(0)}%`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center">
                  <Brain className="w-8 h-8 text-zinc-800 mb-2 animate-pulse" />
                  <p className="text-xs text-zinc-600">Waiting for AI calibration...</p>
                </div>
              )}
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Vibe Analysis
              </h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-mono mb-2">
                    <span className="text-zinc-500">Activity Score</span>
                    <span className="text-indigo-400">{(activityScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div 
                      animate={{ width: `${activityScore * 100}%` }}
                      className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.5)]" 
                    />
                  </div>
                </div>

                <div className="bg-zinc-800/30 border border-zinc-800 p-4 rounded-xl text-center">
                  <p className="text-[10px] text-zinc-500 uppercase mb-1 font-mono tracking-widest">Energy Level</p>
                  <motion.p 
                    key={energyLevel}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`text-xl font-bold tracking-tighter italic ${
                      energyLevel === 1 ? 'text-zinc-400' :
                      energyLevel === 2 ? 'text-cyan-400' :
                      energyLevel === 3 ? 'text-emerald-400' :
                      energyLevel === 4 ? 'text-orange-400' :
                      'text-red-500 animate-pulse'
                    }`}
                  >
                    LEVEL {energyLevel}
                  </motion.p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">People</p>
                    <p className="text-xl font-mono">{peopleCount}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <p className="text-[10px] text-zinc-500 uppercase mb-1">Motion</p>
                    <p className="text-xl font-mono">{Math.round(motionIntensity)}%</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Music className="w-4 h-4" />
                Adaptive Controller
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isAutoDjEnabled ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-600'}`} />
                    <span className="text-xs font-mono text-zinc-400">ADAPTIVE MODE</span>
                  </div>
                  <button 
                    onClick={() => setIsAutoDjEnabled(!isAutoDjEnabled)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                      isAutoDjEnabled ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isAutoDjEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className={`p-4 rounded-xl border border-dashed transition-colors ${
                  isAnalyzing ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-zinc-800/30 border-zinc-700'
                }`}>
                  {currentTrack ? (
                    <div className="flex flex-col items-center py-2">
                      <div className="w-10 h-10 bg-indigo-600/20 rounded-full flex items-center justify-center mb-2">
                        <Music className="w-5 h-5 text-indigo-400" />
                      </div>
                      <p className="text-xs text-zinc-400 mb-1">Active Track: {currentTrack}</p>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Sync Active</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-4 text-center">
                      <Music className="w-8 h-8 text-zinc-600 mb-2" />
                      <p className="text-xs text-zinc-500">Waiting for energy signal...</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map(level => (
                    <button
                      key={level}
                      onClick={() => {
                        const trackMap: Record<number, string> = {
                          1: "Industrial_Hypnosis_2026-04-07T194538.wav",
                          2: "Groove_In_Motion_2026-04-07T195527.mp3",
                          3: "Groove_In_Motion_2026-04-07T195430.mp3",
                          4: "Groove_In_Motion_2026-04-07T195350.mp3",
                          5: "Groove_In_Motion_2026-04-07T195228.mp3"
                        };
                        playTrack(trackMap[level]);
                      }}
                      className={`py-2 rounded-lg text-[10px] font-bold transition-all ${
                        energyLevel === level ? 'bg-zinc-100 text-black' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                      }`}
                    >
                      L{level}
                    </button>
                  ))}
                </div>

                <audio 
                  ref={audioRef} 
                  loop 
                  className="hidden" 
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
// chore: note 2026-06-29T16:43:31
