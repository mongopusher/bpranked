import {ChatErrorMessage} from "@webserver/bot/chat-error-message.constant";

export class ChatError extends Error {
    public option: any;

    public constructor(message: ChatErrorMessage, option?: any) {
        super();
        this.option = option;
    }
}