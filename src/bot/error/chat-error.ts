import {ChatErrorMessage} from "@webserver/bot/error/chat-error-message.constant";

export class ChatError extends Error {
    public data: any;

    public constructor(message: ChatErrorMessage, data?: any) {
        super(message);
        this.data = data;
    }
}