import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";
import "./Room.css";

const URL = "https://duomegle-sewp.onrender.com";

interface Message {
    text: string;
    sender: 'me' | 'stranger' | 'system';
    timestamp: number;
}

export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack,
    isCameraOn,
    isMicOn
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
    isCameraOn: boolean,
    isMicOn: boolean,
}) => {
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    const [connectionState, setConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isLocalCameraOn, setIsLocalCameraOn] = useState(isCameraOn);
    const [isLocalMicOn, setIsLocalMicOn] = useState(isMicOn);
    
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const remoteStreamRef = useRef(new MediaStream());

    // Handle local video stream
    useEffect(() => {
        if (localVideoRef.current && localVideoTrack) {
            const stream = new MediaStream([localVideoTrack]);
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(console.error);
        }
    }, [localVideoTrack]);

    // Update tracks based on camera/mic state
    useEffect(() => {
        if (localVideoTrack) {
            localVideoTrack.enabled = isCameraOn;
        }
    }, [isCameraOn, localVideoTrack]);

    useEffect(() => {
        if (localAudioTrack) {
            localAudioTrack.enabled = isMicOn;
        }
    }, [isMicOn, localAudioTrack]);

    useEffect(() => {
        const socket = io(URL, {
            transports: ['websocket'],
            upgrade: false,
            reconnection: true,
            reconnectionAttempts: 5
        });
        console.log("🔌 Connecting to socket server...");

        // Set up remote video stream
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        socket.on('send-offer', async ({roomId}) => {
            console.log("Initiating connection as sender...");
            setLobby(false);
            setConnectionState('connecting');
            
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            setSendingPc(pc);

            if (localVideoTrack) {
                console.log("Adding video track to connection");
                pc.addTrack(localVideoTrack);
            }
            if (localAudioTrack) {
                console.log("Adding audio track to connection");
                pc.addTrack(localAudioTrack);
            }

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    console.log("Sending ICE candidate");
                    socket.emit("add-ice-candidate", {
                        candidate: e.candidate,
                        type: "sender",
                        roomId
                    });
                }
            };

            pc.oniceconnectionstatechange = () => {
                console.log("ICE connection state:", pc.iceConnectionState);
                if (pc.iceConnectionState === 'connected') {
                    setConnectionState('connected');
                } else if (pc.iceConnectionState === 'disconnected') {
                    setConnectionState('disconnected');
                }
            };

            try {
                console.log("Creating offer...");
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("offer", { sdp: offer, roomId });
            } catch (error) {
                console.error("Error creating offer:", error);
                addSystemMessage("Failed to establish connection. Please try next.");
                setConnectionState('disconnected');
            }
        });

        socket.on("offer", async ({roomId, sdp: remoteSdp}) => {
            console.log("Received connection offer");
            setLobby(false);
            setConnectionState('connecting');
            
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            try {
                await pc.setRemoteDescription(remoteSdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                setReceivingPc(pc);

                pc.ontrack = (event) => {
                    console.log("Received remote track:", event.track.kind);
                    remoteStreamRef.current.addTrack(event.track);
                };

                pc.oniceconnectionstatechange = () => {
                    console.log("ICE connection state:", pc.iceConnectionState);
                    if (pc.iceConnectionState === 'connected') {
                        setConnectionState('connected');
                    } else if (pc.iceConnectionState === 'disconnected') {
                        setConnectionState('disconnected');
                    }
                };

                pc.onicecandidate = (e) => {
                    if (e.candidate) {
                        console.log("Sending ICE candidate as receiver");
                        socket.emit("add-ice-candidate", {
                            candidate: e.candidate,
                            type: "receiver",
                            roomId
                        });
                    }
                };

                socket.emit("answer", { roomId, sdp: answer });
            } catch (error) {
                console.error("Error handling offer:", error);
                addSystemMessage("Failed to connect to peer. Please try next.");
                setConnectionState('disconnected');
            }
        });

        socket.on("answer", ({ sdp: remoteSdp }) => {
            setLobby(false);
            if (sendingPc) {
                sendingPc.setRemoteDescription(remoteSdp).catch(error => {
                    console.error("Error setting remote description:", error);
                });
            }
        });

        socket.on("add-ice-candidate", ({candidate, type}) => {
            const pc = type === "sender" ? receivingPc : sendingPc;
            if (pc) {
                pc.addIceCandidate(candidate).catch(error => {
                    console.error("Error adding ICE candidate:", error);
                });
            }
        });

        socket.on("peer-disconnected", () => {
            addSystemMessage("Peer disconnected. Click 'Next' to find someone else.");
            setConnectionState('disconnected');
            handleNext();
        });

        socket.on("connect", () => {
            console.log("Connected to socket server");
            socket.emit('join', { name });
        });

        socket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
            addSystemMessage("Connection error. Please try again.");
        });

        setSocket(socket);

        return () => {
            console.log("Cleaning up connections...");
            socket.disconnect();
            if (sendingPc) sendingPc.close();
            if (receivingPc) receivingPc.close();
            remoteStreamRef.current = new MediaStream();
        };
    }, [name]);

    const addSystemMessage = (text: string) => {
        setMessages(prev => [...prev, {
            text,
            sender: 'system',
            timestamp: Date.now()
        }]);
    };

    const handleNext = () => {
        if (socket) {
            // Clean up current connection
            if (sendingPc) {
                sendingPc.close();
                setSendingPc(null);
            }
            if (receivingPc) {
                receivingPc.close();
                setReceivingPc(null);
            }
            setMessages([]);
            
            // Request new connection
            socket.emit('find-next', { name });
            setLobby(true);
        }
    };

    const sendMessage = () => {
        if (currentMessage.trim() && socket) {
            const newMessage: Message = {
                text: currentMessage.trim(),
                sender: 'me',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, newMessage]);
            socket.emit('chat-message', { message: currentMessage.trim() });
            setCurrentMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Add socket listener for chat messages
    useEffect(() => {
        if (socket) {
            socket.on('chat-message', ({ message }) => {
                const newMessage: Message = {
                    text: message,
                    sender: 'stranger',
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, newMessage]);
            });
        }
    }, [socket]);

    const toggleCamera = () => {
        if (localVideoTrack) {
            localVideoTrack.enabled = !isLocalCameraOn;
            setIsLocalCameraOn(!isLocalCameraOn);
        }
    };

    const toggleMic = () => {
        if (localAudioTrack) {
            localAudioTrack.enabled = !isLocalMicOn;
            setIsLocalMicOn(!isLocalMicOn);
        }
    };

    return (
        <div className="room-container">
            <div className="video-container">
                <div className="video-wrapper">
                    <video 
                        ref={remoteVideoRef} 
                        autoPlay 
                        playsInline 
                        className={`remote-video ${connectionState !== 'connected' ? 'not-connected' : ''}`} 
                    />
                    <video 
                        ref={localVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className={`local-video ${!isCameraOn ? 'camera-off' : ''}`} 
                    />
                    {(lobby || connectionState !== 'connected') && (
                        <div className="lobby-overlay">
                            <p>{lobby ? "Looking for someone to chat with..." : "Connecting..."}</p>
                        </div>
                    )}

                </div>
                <div className="controls">
                    <button 
                        className={`control-button ${!isLocalCameraOn ? 'off' : ''}`}
                        onClick={toggleCamera}
                        title={isLocalCameraOn ? "Turn off camera" : "Turn on camera"}
                    >
                        <span className="icon">
                            {isLocalCameraOn ? "🎥" : "🚫"}
                        </span>
                    </button>
                    <button 
                        onClick={handleNext} 
                        className="next-button"
                        disabled={connectionState === 'connecting'}
                    >
                        {lobby ? 'Finding Next...' : connectionState === 'connecting' ? 'Connecting...' : 'Next Person'}
                    </button>
                    <button 
                        className={`control-button ${!isLocalMicOn ? 'off' : ''}`}
                        onClick={toggleMic}
                        title={isLocalMicOn ? "Mute microphone" : "Unmute microphone"}
                    >
                        <span className="icon">
                            {isLocalMicOn ? "🎤" : "🚫"}
                        </span>
                    </button>
                </div>
            </div>
            
            <div className="chat-container">
                <div className="chat-messages" ref={chatContainerRef}>
                    {messages.map((msg, index) => (
                        <div key={index} className={`message ${msg.sender}`}>
                            <div className="message-content">{msg.text}</div>
                            <div className="message-time">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="chat-input">
                    <textarea
                        value={currentMessage}
                        onChange={(e) => setCurrentMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        disabled={lobby}
                    />
                    <button onClick={sendMessage} disabled={lobby}>Send</button>
                </div>
            </div>
        </div>
    );
};

