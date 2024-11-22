import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import * as fs from "fs"
import Module, { ModuleCommand } from "./Module"

export default class RandomLineModule extends Module {
    private command: string
    private description: string
    private lines: string[] = []
    private processor: (line: string) => string

    public constructor(command: string, filename: string, description: string, processor?: (line: string) => string) {
        super()
        this.command = command
        this.description = description
        this.processor = processor
        this.lines = fs.readFileSync(filename, "utf-8").split("\n")
    }

    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName(this.command)
                    .setDescription(this.description),
                execute: this.replyWithRandomLine.bind(this)
            }
        ]
    }

    private async replyWithRandomLine(interaction: ChatInputCommandInteraction) {
        try {
            let line = this.lines[Math.floor(Math.random() * this.lines.length)].replace("<br />", "\n")
            
            if (this.processor) {
                line = this.processor(line)
            }

            await interaction.reply({content: line})
        }
        catch (e) {
            console.error(e)
            try {
                await interaction.reply({content: "Something went wrong!"})
            }
            catch (e2) {
                console.error(e2)
            }
        }
    }

    public getName(): string {
        return this.command
    }
}