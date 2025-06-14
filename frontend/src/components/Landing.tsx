import { useEffect, useRef, useState } from "react"
import { Room } from "./Room";
import "./Landing.css";

export const Landing = () => {
    const [name, setName] = useState("");
    const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
    const [localVideoTrack, setlocalVideoTrack] = useState<MediaStreamTrack | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [joined, setJoined] = useState(false);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isMicEnabled, setIsMicEnabled] = useState(true);

    const checkBrowserCompatibility = () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Your browser doesn't support video chat. Please use a modern browser like Chrome, Firefox, or Edge.");
        }
    };

    const getCam = async () => {
        try {
            console.log("Starting camera setup...");
            setIsLoading(true);
            setError(null);
            
            // Check browser compatibility
            checkBrowserCompatibility();
            console.log("Browser compatibility checked");

            console.log("Requesting media access...");
            const stream = await window.navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            console.log("Media access granted", stream);

            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];
            console.log("Audio track:", audioTrack?.enabled, "Video track:", videoTrack?.enabled);

            if (!audioTrack || !videoTrack) {
                throw new Error("Could not get audio or video tracks");
            }

            setLocalAudioTrack(audioTrack);
            setlocalVideoTrack(videoTrack);
            console.log("Tracks set in state");

            // Create a new MediaStream with both tracks
            const mediaStream = new MediaStream([videoTrack, audioTrack]);
            
            // Set the stream to video element if it exists
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
                videoRef.current.muted = true;
                try {
                    await videoRef.current.play();
                    console.log("Video playback started successfully");
                } catch (playError) {
                    console.error("Play error:", playError);
                    throw new Error("Failed to play video stream");
                }
            }

        } catch (err: any) {
            console.error("Error in getCam:", err);
            let errorMessage = "An unexpected error occurred";
            
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                errorMessage = "Camera/Microphone access denied. Please allow access to use this app.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                errorMessage = "No camera/microphone found. Please connect a device and try again.";
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                errorMessage = "Your camera or microphone is already in use by another application.";
            } else if (err.message) {
                errorMessage = err.message;
            }

            setError(errorMessage);
            setLocalAudioTrack(null);
            setlocalVideoTrack(null);
            console.error("Media Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        console.log("Landing component mounted");
        getCam();
    }, []); // Remove videoRef dependency

    const handleJoin = () => {
        if (!name.trim()) {
            setError("Please enter your name");
            return;
        }
        if (!localAudioTrack || !localVideoTrack) {
            setError("Please allow camera and microphone access to join");
            return;
        }
        setJoined(true);
    };

    const toggleCamera = () => {
        if (localVideoTrack) {
            localVideoTrack.enabled = !isCameraEnabled;
            setIsCameraEnabled(!isCameraEnabled);
        }
    };

    const toggleMic = () => {
        if (localAudioTrack) {
            localAudioTrack.enabled = !isMicEnabled;
            setIsMicEnabled(!isMicEnabled);
        }
    };

    if (!joined) {
        return (
            <div className="landing-container">
                {isLoading && (
                    <div className="loading-message">
                        Setting up your camera and microphone...
                    </div>
                )}

                {error && (
                    <div className="error-message">
                        <p>{error}</p>
                        <button onClick={getCam}>Try Again</button>
                    </div>
                )}

                {!error && !isLoading && (
                    <>
                        <video 
                            autoPlay 
                            playsInline 
                            ref={videoRef} 
                            className="preview-video" 
                            muted // Important for local preview
                        />
                        <div className="media-controls">
                            <button 
                                className={`control-button ${!isCameraEnabled ? 'off' : ''}`}
                                onClick={toggleCamera}
                                title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
                            >
                                <span className="icon">
                                    {isCameraEnabled ? "🎥" : "🚫"}
                                </span>
                            </button>
                            <button 
                                className={`control-button ${!isMicEnabled ? 'off' : ''}`}
                                onClick={toggleMic}
                                title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
                            >
                                <span className="icon">
                                    {isMicEnabled ? "🎤" : "🚫"}
                                </span>
                            </button>
                        </div>
                        <div className="join-controls">
                            <input
                                type="text"
                                placeholder="Enter your name"
                                onChange={(e) => setName(e.target.value)}
                                value={name}
                            />
                            <button 
                                onClick={handleJoin}
                                disabled={!name.trim() || !localVideoTrack || !localAudioTrack}
                            >
                                Join
                            </button>
                        </div>
                    </>
                )}
            </div>
        );
    }

    return <Room
        name={name}
        localAudioTrack={localAudioTrack}
        localVideoTrack={localVideoTrack}
        isCameraOn={isCameraEnabled}
        isMicOn={isMicEnabled}
    />;
}