import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import openai from "../shared/OpenAiClient"

export default class CompleteModule extends Module {
    public readonly name = "complete"

    private readonly boundListener = this.onCompletion.bind(this)

    public async onCompletion(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply()
        const prompt = interaction.options.getString("prompt")
        const completion = await openai.complete(prompt)
        const boldPrompt = bold(completion.prompt)
        await interaction.followUp(boldPrompt + completion.response)
    }
    
    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("complete")
                    .setDescription("Generate an AI completion for the specified text")
                    .addStringOption(option => 
                        option
                            .setName("prompt")
                            .setDescription("The text to complete")
                            .setRequired(true)),
                execute: this.boundListener
            }
        ]
    }
}