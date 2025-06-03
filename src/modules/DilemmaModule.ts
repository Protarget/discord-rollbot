import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import { parse } from 'node-html-parser'

function shuffle(array) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex != 0) {

    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

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

            const comments = []

            const commentRoots = parsedHtmlContent.querySelectorAll(".content")

            for (const commentRoot of commentRoots) {
                const username = commentRoot.querySelector(".has-text-primary > strong").text
                const quote = commentRoot.querySelector(".commentText > span").text

                if (username && quote) {
                    comments.push(`"${quote}" -${username}`)
                }
            }

            shuffle(comments)

            const selectComments = []

            while (comments.length > 0 && selectComments.length < 3) {
                selectComments.push(comments.pop())
            }

            await interaction.followUp(selectComments.join("\n"))
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