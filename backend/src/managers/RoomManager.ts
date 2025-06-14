import { User } from "./UserManger";

export interface Room {
    user1: User;
    user2: User;
}

export class RoomManager {
    private rooms: Map<string, Room>;
    private roomId: number;

    constructor() {
        this.rooms = new Map();
        this.roomId = 1;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    createRoom(user1: User, user2: User): string {
        const roomId = String(this.roomId++);
        this.rooms.set(roomId, { user1, user2 });
        
        // Only user1 should initiate the offer
        user1.socket.emit("send-offer", { roomId });

        return roomId;
    }

    onOffer(roomId: string, sdp: string, senderSocketid: string) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2: room.user1;
        receivingUser?.socket.emit("offer", {
            sdp,
            roomId
        })
    }
    
    onAnswer(roomId: string, sdp: string, senderSocketid: string) {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2: room.user1;

        receivingUser?.socket.emit("answer", {
            sdp,
            roomId
        });
    }

    onIceCandidates(roomId: string, senderSocketid: string, candidate: any, type: "sender" | "receiver") {
        const room = this.rooms.get(roomId);
        if (!room) {
            return;
        }
        const receivingUser = room.user1.socket.id === senderSocketid ? room.user2: room.user1;
        receivingUser.socket.emit("add-ice-candidate", ({candidate, type}));
    }

    sendChatMessage(roomId: string, senderSocketId: string, message: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const receivingUser = room.user1.socket.id === senderSocketId ? room.user2 : room.user1;
        receivingUser.socket.emit("chat-message", { message });
    }

    removeUserFromRoom(socketId: string): User | null {
        for (const [roomId, room] of this.rooms.entries()) {
            if (room.user1.socket.id === socketId || room.user2.socket.id === socketId) {
                const otherUser = room.user1.socket.id === socketId ? room.user2 : room.user1;
                otherUser.socket.emit("peer-disconnected");
                this.rooms.delete(roomId);
                return otherUser;
            }
        }
        return null;
    }
}