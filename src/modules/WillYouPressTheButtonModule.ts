import { SlashCommandBuilder, ChatInputCommandInteraction, bold, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import { parse } from 'node-html-parser'

export default class WillYouPressTheButtonModule extends Module {
    public readonly name = "wyptb"

    private readonly boundListener = this.onWouldYouPressTheButton.bind(this)

    public async onWouldYouPressTheButton(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply()
            const completion = await fetch("https://willyoupressthebutton.com/")
            const htmlContent = await completion.text()
            const parsedHtmlContent = parse(htmlContent)

            const value1 = parsedHtmlContent.getElementById("cond").innerText
            const value2 = parsedHtmlContent.getElementById("res").innerText

            const content = value1 + "\n\n" + bold("BUT") + "\n\n" + value2 + "\n"

            const yesButton = new ButtonBuilder()
                .setCustomId("yes")
                .setLabel("Yes")
                .setStyle(ButtonStyle.Success)

            const noButton = new ButtonBuilder()
                .setCustomId("no")
                .setLabel("No")
                .setStyle(ButtonStyle.Danger)

            const buttons = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(yesButton, noButton)

            const response = await interaction.followUp({
                content: content,
                components: [buttons]
            })

            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 3600000 })

            let users = new Map()

            collector.on("collect", async i => {
                try {
                    users.set(i.user.id, [i.user.displayName, i.customId])

                    const yesAnswers = []
                    const noAnswers = []

                    for (const [username, answer] of users.values()) {
                        if (answer === "yes") {
                            yesAnswers.push(username)
                        }
                        else {
                            noAnswers.push(username)
                        }
                    }

                    const contentSegments = [content]

                    if (yesAnswers.length > 0) {
                        contentSegments.push(bold("Yes: ") + yesAnswers.join(", "))
                    }

                    if (noAnswers.length > 0) {
                        contentSegments.push(bold("No: ") + noAnswers.join(", "))
                    }

                    if (contentSegments.length > 1) {
                        contentSegments.push("")
                    }

                    await i.update({content: contentSegments.join("\n"), components: [buttons]})
                }
                catch (e) {
                    console.error(e)
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
                    .setName("wyptb")
                    .setDescription("Fetch a random 'will you press the button' dilemma."),
                execute: this.boundListener
            }
        ]
    }
}