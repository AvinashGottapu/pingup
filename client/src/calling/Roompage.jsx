
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { useAuth } from "@clerk/clerk-react";
import { PhoneOff, Mic, MicOff, Volume2, VolumeX, Loader2, Minus, Monitor, MonitorOff, Palette } from "lucide-react";
import { createSocket } from "../api/socket";
import { toast } from "react-hot-toast";
import { setIsMinimized } from "../features/user/userSlice";
import Whiteboard from "./Whiteboard";

const Roompage = ({ roomId: propRoomId, onClose }) => {
  const { roomId: urlRoomId } = useParams();
  const roomId = propRoomId || urlRoomId;
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.user.value);
  const isMinimized = useSelector((state) => state.user.isMinimized);

  // UI States
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callStatus, setCallStatus] = useState("connecting"); // connecting, active, ended
  const [callDuration, setCallDuration] = useState(0);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isRemoteVideoActive, setIsRemoteVideoActive] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);

  // WebRTC & Socket Refs
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const videoSenderRef = useRef(null);
  const isNegotiatingRef = useRef(false);
  const isLocalTrackChangeRef = useRef(false);
  const whiteboardHistoryRef = useRef([]);

  // Format call duration to MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Call duration timer - only ticks when call is active
  useEffect(() => {
    let timer;
    if (callStatus === "active") {
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  // Ref to track callStatus without stale closures inside useEffect
  const callStatusRef = useRef(callStatus);
  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  // Teardown function to clean up WebRTC connections, media tracks, and socket events
  const teardownCall = () => {
    // Reset whiteboard history
    whiteboardHistoryRef.current = [];

    // Stop all tracks of the local screen sharing stream if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    // 1. Stop all tracks of the local microphone stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // 2. Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // 3. Remove socket signaling listeners
    if (socketRef.current) {
      socketRef.current.off("call:user-joined");
      socketRef.current.off("call:signal");
      socketRef.current.off("call:ended");
      socketRef.current.off("whiteboard:toggle");
      socketRef.current.off("whiteboard:draw");
      socketRef.current.off("whiteboard:clear");
    }
  };

  // Main WebRTC Voice Call Setup Effect
  useEffect(() => {
    let socket;

    const initCall = async () => {
      try {
        // Step 1: Initialize signaling Socket using current Clerk Auth Token
        const token = await getToken();
        socket = createSocket(token);
        socketRef.current = socket;

        // Step 2: Request local microphone permissions (Audio-only call)
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        localStreamRef.current = stream;

        // Step 3: Initialize RTCPeerConnection with Google public STUN servers for NAT Traversal
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
          ],
        });
        peerConnectionRef.current = pc;

        // Step 4: Attach local microphone audio tracks to the peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle WebRTC renegotiation when screen share video tracks are dynamically added/removed
        pc.onnegotiationneeded = async () => {
          if (!isLocalTrackChangeRef.current) {
            console.log("[WebRTC] Skipping negotiation because there was no local track change initiated by us.");
            return;
          }
          if (isNegotiatingRef.current) {
            console.log("[WebRTC] Negotiation already in progress, skipping.");
            return;
          }
          try {
            isNegotiatingRef.current = true;
            console.log("[WebRTC] Creating renegotiation offer...");
            const offer = await pc.createOffer();
            console.log("[WebRTC] Setting local description (offer)...");
            await pc.setLocalDescription(offer);
            console.log("[WebRTC] Emitting renegotiation offer signal...");
            socket.emit("call:signal", {
              roomId,
              signal: { type: "offer", sdp: offer },
            });
          } catch (err) {
            console.error("[WebRTC] Negotiation offer error:", err);
            isNegotiatingRef.current = false;
          } finally {
            console.log("[WebRTC] Resetting isLocalTrackChangeRef to false.");
            isLocalTrackChangeRef.current = false;
          }
        };

        // Step 5: Gather ICE Candidates and send them to the peer via signaling server
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("call:signal", {
              roomId,
              signal: { type: "candidate", candidate: event.candidate },
            });
          }
        };

        // Step 6: Capture incoming remote audio and video tracks
        pc.ontrack = (event) => {
          const remoteStream = event.streams[0];
          if (event.track.kind === "audio") {
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
            }
          } else if (event.track.kind === "video") {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            setIsRemoteVideoActive(true);
          }
          setCallStatus("active");
        };

        pc.onremovetrack = () => {
          setIsRemoteVideoActive(false);
        };

        // Step 7: Handle changes in connection state (e.g. peer leaves unexpectedly)
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setCallStatus("active");
          } else if (pc.connectionState === "failed") {
            setCallStatus("ended");
            teardownCall();
            setTimeout(() => onClose?.(), 1500);
          }
        };

        // Step 8: Setup Signaling Socket Listeners
        
        // A. Listener for when a remote user joins the room (Active offerer)
        socket.on("call:user-joined", async () => {
          try {
            isNegotiatingRef.current = true;
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socket.emit("call:signal", {
              roomId,
              signal: { type: "offer", sdp: offer },
            });
          } catch (err) {
            console.error("[WebRTC] Error creating initial offer:", err);
            isNegotiatingRef.current = false;
          }
        });

        // ICE Candidate Queue to prevent race conditions where candidates arrive before remoteDescription is set
        const iceQueue = [];

        // B. Listener to receive signaling payloads (SDP Offers/Answers & ICE candidates)
        socket.on("call:signal", async ({ signal }) => {
          console.log("[WebRTC] Received call:signal event. Type:", signal.type);
          
          if (signal.type === "offer") {
            // Received SDP Offer: Set remote desc and reply with SDP Answer
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            socket.emit("call:signal", {
              roomId,
              signal: { type: "answer", sdp: answer },
            });

            // Process any ICE candidates that were queued while setting remote description
            while (iceQueue.length > 0) {  
              const candidate = iceQueue.shift();  // shift() removes the first element from the queue.
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => 
                console.error("[WebRTC] Error adding queued candidate:", err)
              );
            }
          } else if (signal.type === "answer") {
            // Received SDP Answer: Set remote desc to establish connection
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            isNegotiatingRef.current = false;
 
            // Process any ICE candidates that were queued while setting remote description
            while (iceQueue.length > 0) {
              const candidate = iceQueue.shift();
              await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(err => 
                console.error("[WebRTC] Error adding queued candidate:", err)
              );
            }
          } else if (signal.type === "candidate") {
            // Received ICE Candidate: If remote description is set and has this media line, add it; otherwise, queue it.
            if (signal.candidate) {
              const candidateObj = new RTCIceCandidate(signal.candidate);
              const mLineIndex = candidateObj.sdpMLineIndex;
              const hasRemoteMLine = pc.remoteDescription &&
                                     pc.remoteDescription.sdp.split("m=").length - 1 > mLineIndex;
 
              if (pc.remoteDescription && hasRemoteMLine) {
                await pc.addIceCandidate(candidateObj).catch(err => 
                  console.error("[WebRTC] Error adding candidate directly:", err)
                );
              } else {
                console.log("[WebRTC] Remote description not ready for candidate. Queuing.");
                iceQueue.push(signal.candidate);
              }
            }
          }
        });

        // C. Listener to hang up call when notified by remote peer
        socket.on("call:ended", () => {
          setCallStatus("ended");
          teardownCall();
          setTimeout(() => onClose?.(), 1000);
        });

        // D. Listeners to accumulate whiteboard drawing segments in background
        socket.on("whiteboard:draw", ({ drawData }) => {
          whiteboardHistoryRef.current.push(drawData);
        });

        socket.on("whiteboard:clear", () => {
          whiteboardHistoryRef.current = [];
        });

        // E. Listener for whiteboard visibility toggle
        socket.on("whiteboard:toggle", ({ isOpen }) => {
          setIsWhiteboardOpen(isOpen);
        });

        // Step 9: Join call room to alert any peer who is already inside
        socket.emit("call:join-room", { roomId });

      } catch (err) {
        console.error("[WebRTC] Critical error during call initialization:", err);
        setCallStatus("ended");
        toast.error("Microphone permission denied or initialization failed");
        setTimeout(() => onClose?.(), 2000);
      }
    };

    initCall();

    // Cleanup: Run teardown on component unmount
    return () => {
      teardownCall();
    };
  }, [roomId]);

  // Handler to manually hang up call
  const handleHangUp = () => {
    console.log("[WebRTC] Initiating call hang up");
    if (socketRef.current && roomId) {
      socketRef.current.emit("call:end", { roomId });
    }
    setCallStatus("ended");
    teardownCall();
    setTimeout(() => {
      onClose?.();
    }, 1000);
  };

  // Screen Sharing functions
  const startScreenShare = async () => {
    console.log("[WebRTC] startScreenShare called. Call status:", callStatus);
    if (callStatus !== "active") {
      toast.error("Wait for the call to connect before sharing screen");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false, // We keep the voice audio separate
      });

      screenStreamRef.current = stream;
      const videoTrack = stream.getVideoTracks()[0];

      if (peerConnectionRef.current) {
        // Store the sender ref so we can remove it when stopped
        isLocalTrackChangeRef.current = true;
        videoSenderRef.current = peerConnectionRef.current.addTrack(videoTrack, stream);
      } else {
        console.warn("[WebRTC] peerConnectionRef.current is null!");
      }

      setIsSharingScreen(true);

      // Handle user stopping stream via browser native UI bar
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      toast.error("Screen sharing cancelled or failed");
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }

    if (peerConnectionRef.current && videoSenderRef.current) {
      try {
        isLocalTrackChangeRef.current = true;
        peerConnectionRef.current.removeTrack(videoSenderRef.current);
      } catch (err) {
        console.warn("[WebRTC] Error removing screen track:", err);
      }
      videoSenderRef.current = null;
    }

    setIsSharingScreen(false);
  };

  const toggleScreenShare = () => {
    if (isSharingScreen) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // Whiteboard functions
  const toggleWhiteboard = (openState) => {
    setIsWhiteboardOpen(openState);
    if (socketRef.current && roomId) {
      socketRef.current.emit("whiteboard:toggle", { roomId, isOpen: openState });
    }
  };

  // Handler to toggle local microphone track state (mute/unmute)
  const toggleMute = () => {
    const nextMuteState = !isMuted;
    setIsMuted(nextMuteState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuteState;
      });
    }
  };

  // Handler to toggle speaker output state (by muting remote audio player)
  const toggleSpeaker = () => {
    const nextSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(nextSpeakerState);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !nextSpeakerState;
    }
  };

  const handleMinimize = () => {
    dispatch(setIsMinimized(true));
    navigate("/");
  };

  const handleMaximize = () => {
    dispatch(setIsMinimized(false));
    navigate(`/room/${roomId}`);
  };

  return (
    <>
      {/* Hidden audio element to stream and play remote peer voice */}
      <audio ref={remoteAudioRef} autoPlay />

      {isMinimized ? (
        <div 
          onClick={handleMaximize}
          className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 z-50 flex flex-col items-center cursor-pointer group"
        >
          <div className="relative w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 animate-pulse">
            <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-950">
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
                {currentUser?.full_name ? currentUser.full_name.slice(0, 2).toUpperCase() : "VC"}
              </span>
            </div>
            {/* Status Dot */}
            <span className="absolute bottom-0 right-0 flex h-4.5 w-4.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4.5 w-4.5 bg-emerald-500 border-2 border-slate-950 items-center justify-center">
                {isMuted ? (
                  <MicOff className="w-2 h-2 text-white" />
                ) : (
                  <Mic className="w-2 h-2 text-white" />
                )}
              </span>
            </span>
          </div>
          {/* Hover label */}
          <div className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 shadow-xl whitespace-nowrap z-50">
            {callStatus === "active" ? `Active Call (${formatTime(callDuration)})` : "Connecting..."}
          </div>
        </div>
      ) : (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-between py-12 px-6 text-white overflow-hidden select-none z-50">
          
          {/* Collaborative Canvas Whiteboard */}
          {isWhiteboardOpen && (
            <Whiteboard 
              socket={socketRef.current} 
              roomId={roomId} 
              onClose={() => toggleWhiteboard(false)} 
              historyRef={whiteboardHistoryRef}
            />
          )}

          {/* Remote Video Player for Screen Sharing */}
          <div className={`absolute inset-0 w-full h-full z-0 flex items-center justify-center bg-black transition-opacity duration-300 ${isRemoteVideoActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          {/* Minimize Button */}
          {!isRemoteVideoActive && !isSharingScreen && (
            <button 
              onClick={handleMinimize} 
              className="absolute top-6 right-6 p-2.5 rounded-full bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-850 z-20 hover:scale-105 active:scale-95"
              title="Minimize Call"
            >
              <Minus className="w-5 h-5" />
            </button>
          )}

          {/* Top Floating Name/Time Card Overlay during screen share */}
          {(isRemoteVideoActive || isSharingScreen) && (
            <div className="z-10 bg-slate-900/80 backdrop-blur-md border border-slate-850 px-6 py-2.5 rounded-2xl shadow-2xl flex items-center gap-4">
              <span className="text-sm font-semibold text-slate-300">
                {currentUser?.full_name || "Voice Call"} {isSharingScreen && <span className="text-xs text-slate-500 font-normal ml-1">(Screen Sharing)</span>}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
              <span className="text-sm text-emerald-400 font-bold font-mono tracking-wider animate-pulse">
                {formatTime(callDuration)}
              </span>
            </div>
          )}

          {/* Decorative Blur Backdrops */}
          {!isRemoteVideoActive && !isSharingScreen && (
            <>
              <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-600/20 rounded-full blur-3xl animate-pulse pointer-events-none"></div>
              <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-pink-600/20 rounded-full blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: "2s" }}></div>
            </>
          )}

          {/* Profile & Pulse Animation */}
          {!isRemoteVideoActive && !isSharingScreen && (
            <div className="z-10 flex flex-col items-center justify-center my-auto relative w-full">
              <div className="relative flex items-center justify-center">
                {/* Pulsing rings */}
                {callStatus === "connecting" && (
                  <>
                    <div className="absolute w-44 h-44 rounded-full border border-indigo-500/30 animate-ping duration-1000"></div>
                    <div className="absolute w-56 h-56 rounded-full border border-purple-500/20 animate-ping duration-1500" style={{ animationDelay: "0.5s" }}></div>
                  </>
                )}
                {callStatus === "active" && (
                  <>
                    <div className="absolute w-40 h-40 rounded-full bg-indigo-500/10 animate-pulse duration-1000"></div>
                    <div className="absolute w-48 h-48 rounded-full border border-indigo-500/20 animate-pulse duration-2000"></div>
                  </>
                )}

                {/* Avatar frame */}
                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl relative z-10">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border border-slate-950">
                    <span className="text-4xl font-extrabold bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
                      {currentUser?.full_name ? currentUser.full_name.slice(0, 2).toUpperCase() : "VC"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status texts */}
              <div className="mt-8 text-center min-h-[5rem]">
                <h2 className="text-2xl font-black tracking-tight text-white">
                  {currentUser?.full_name || "Voice Call"}
                </h2>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-400 font-medium">
                  {callStatus === "connecting" && (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>Connecting peer lines...</span>
                    </>
                  )}
                  {callStatus === "active" && (
                    <span className="text-emerald-400 font-bold font-mono tracking-wider animate-pulse">
                      {formatTime(callDuration)}
                    </span>
                  )}
                  {callStatus === "ended" && (
                    <span className="text-rose-500 font-bold">Call Ended</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Control Actions Bar */}
          <div className="z-10 w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-850 px-6 py-4 rounded-3xl flex justify-around items-center shadow-2xl">
            {/* Mute button */}
            <button
              onClick={toggleMute}
              className={`p-4 rounded-2xl transition-all cursor-pointer ${
                isMuted
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20 animate-pulse"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* Decline/End Call button */}
            <button
              onClick={handleHangUp}
              className="p-5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-full transition-all cursor-pointer shadow-lg shadow-rose-600/30"
              title="Hang Up"
            >
              <PhoneOff className="w-7 h-7" />
            </button>

            {/* Screen Share button */}
            {!isWhiteboardOpen && (
              <button
                onClick={toggleScreenShare}
                disabled={callStatus !== "active"}
                className={`p-4 rounded-2xl transition-all ${
                  callStatus !== "active"
                    ? "opacity-30 cursor-not-allowed bg-slate-800 text-slate-600"
                    : isSharingScreen
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 cursor-pointer animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                }`}
                title={
                  callStatus !== "active"
                    ? "Connect call to share screen"
                    : isSharingScreen
                    ? "Stop Screen Share"
                    : "Share Screen"
                }
              >
                {isSharingScreen ? <MonitorOff className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
              </button>
            )}

            {/* Whiteboard button */}
            {!isSharingScreen && !isRemoteVideoActive && (
              <button
                onClick={() => toggleWhiteboard(!isWhiteboardOpen)}
                disabled={callStatus !== "active"}
                className={`p-4 rounded-2xl transition-all ${
                  callStatus !== "active"
                    ? "opacity-30 cursor-not-allowed bg-slate-800 text-slate-600"
                    : isWhiteboardOpen
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 cursor-pointer animate-pulse"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                }`}
                title={
                  callStatus !== "active"
                    ? "Connect call to open whiteboard"
                    : isWhiteboardOpen
                    ? "Close Whiteboard"
                    : "Open Whiteboard"
                }
              >
                <Palette className="w-6 h-6" />
              </button>
            )}

            {/* Speaker button */}
            <button
              onClick={toggleSpeaker}
              className={`p-4 rounded-2xl transition-all cursor-pointer ${
                !isSpeakerOn
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/20"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
              title={isSpeakerOn ? "Speaker Off" : "Speaker On"}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Roompage;
