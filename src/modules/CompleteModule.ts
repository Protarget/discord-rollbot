import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import openai from "../shared/OpenAiClient"

const MAX_CHUNK_SIZE = 1900;

function message_chunks(input, chunk_size) {
    const chunk_count = Math.ceil(input.length / chunk_size)
    const chunks = []
  
    for (let i = 0; i < chunk_count; i++) {
        const start = chunk_size * i;
        const end = start + chunk_size;
        chunks.push(input.substring(start, end))
    }
  
    return chunks
}

export default class CompleteModule extends Module {
    public readonly name = "complete"

    private readonly boundListener = this.onCompletion.bind(this)

    public async onCompletion(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply()
        const prompt = interaction.options.getString("prompt")
        const size = interaction.options.getInteger("max_tokens") || 128
        const completion = await openai.complete(prompt, size)
        const boldPrompt = bold(completion.prompt)

        const final_response = boldPrompt + completion.response

        const chunks = message_chunks(final_response, MAX_CHUNK_SIZE)

        let prev = await interaction.followUp(chunks[0])

        for (const chunk of chunks.slice(1)) {
            prev = await prev.reply(chunk)
        }
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
                            .setRequired(true))
                        .addIntegerOption(option => 
                            option.setName("max_tokens")
                            .setMinValue(1)
                            .setMaxValue(1000)
                            .setDescription("The maximum number of tokens to generate (default 128)")
                            .setRequired(false)),
                execute: this.boundListener
            }
        ]
    }
}