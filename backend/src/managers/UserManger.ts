import { RoomManager } from "./RoomManager";
import { Socket } from "socket.io";

export interface User {
    name: string;
    socket: Socket;
}

export class UserManager {
    public users: Map<string, User>;
    public queue: string[];
    public roomManager: RoomManager;

    constructor() {
        this.users = new Map();
        this.queue = [];
        this.roomManager = new RoomManager();
    }

    addUser(name: string, socket: Socket) {
        this.users.set(socket.id, {name, socket});
        this.addToQueue(socket.id);
    }

    removeUser(socketId: string) {
        this.users.delete(socketId);
        this.queue = this.queue.filter(id => id !== socketId);
    }

    addToQueue(socketId: string) {
        this.queue.push(socketId);
        this.processQueue();
    }

    private processQueue() {
        if (this.queue.length < 2) return;

        const user1 = this.users.get(this.queue[0]);
        const user2 = this.users.get(this.queue[1]);

        if (!user1 || !user2) return;

        // Remove users from queue
        this.queue = this.queue.slice(2);

        const roomId = this.roomManager.createRoom(user1, user2);
        
        user1.socket.emit("send-offer", { roomId });
    }
}