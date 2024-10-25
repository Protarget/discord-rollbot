import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import { parse } from 'node-html-parser'

export default class DilemmaModule extends Module {
    public readonly name = "dilemma"

    private readonly boundListener = this.onDilemma.bind(this)

    public async onDilemma(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply()
            const completion = await fetch("https://willyoupressthebutton.com/")
            const htmlContent = await completion.text()
            const parsedHtmlContent = parse(htmlContent)

            const value1 = parsedHtmlContent.getElementById("cond").text
            const value2 = parsedHtmlContent.getElementById("res").text

            const content = value1 + "\n\n" + bold("BUT") + "\n\n" + value2 + "\n"

            await interaction.followUp({
                poll: {
                    question: {text: content},
                    answers: [{text: "Yes"}, {text: "No"}],
                    allowMultiselect: false,
                    duration: 24
                }
            })
        }
        catch (e) {
            console.error(e)
        }
    }
    
    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("dilemma")
                    .setDescription("Fetch a random dilemma."),
                execute: this.boundListener
            }
        ]
    }
}