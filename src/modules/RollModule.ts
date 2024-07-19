import { Client, Events, Message } from "discord.js";
import Module, { ModuleCommand } from "./Module";

export default class RollModule extends Module {
    public readonly name = "roll"

    private readonly boundListener = this.onMessage.bind(this)

    public async onStart(client: Client): Promise<void> {
        client.on(Events.MessageCreate, this.boundListener)
    }

    public async onStop(client: Client): Promise<void> {
        client.off(Events.MessageCreate, this.boundListener)
    }
    
    public getCommands(): ModuleCommand[] {
        return []
    }

    public async onMessage(message: Message<boolean>) {
        if (message.content === "!roll") {
            const r1 = Math.floor(Math.random() * 6) + 1
            const r2 = Math.floor(Math.random() * 6) + 1
            message.channel.send(`<@${message.author.id}> rolled 2 6-sided dice: ${r1} ${r2}`)
        }
    } 
}