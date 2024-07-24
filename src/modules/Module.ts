import { ChatInputCommandInteraction, Client, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandGroupBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js"

export interface ModuleCommand {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>
}

export default class Module {
    readonly name: string = "unknown module"

    public async onStart(client: Client): Promise<void> {

    }

    public async onStop(client: Client): Promise<void> {

    }

    public getCommands(): ModuleCommand[] {
        return []
    }
}