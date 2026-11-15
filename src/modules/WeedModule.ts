import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import * as fs from "fs"
import Module, { ModuleCommand } from "./Module"

interface WeedStrain {
    flavors?: string[]
}

type WeedStrains = {[name: string]: WeedStrain}

export default class WeedModule extends Module {
    public readonly name = "weed"

    private readonly strainNames: string[]
    private readonly strains: WeedStrains

    public constructor(filename: string) {
        super()
        this.strains = JSON.parse(fs.readFileSync(filename, "utf-8")) as WeedStrains
        this.strainNames = Object.keys(this.strains)
    }

    public async onWeed(interaction: ChatInputCommandInteraction) {
        try {
            if (this.strainNames.length === 0) {
                await interaction.reply({content: "No strains are available"})
                return
            }

            const name = this.strainNames[Math.floor(Math.random() * this.strainNames.length)]
            const flavors = this.strains[name].flavors ?? []

            await interaction.reply({content: `${name} (${flavors.join(", ")})`})
        }
        catch (e) {
            console.error("Encountered an error fetching a random strain", e)
            try {
                await interaction.reply({content: "Something went wrong!"})
            }
            catch (e2) {
                console.error(e2)
            }
        }
    }

    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("weed")
                    .setDescription("Fetch a random strain, along with its flavors"),
                execute: this.onWeed.bind(this)
            }
        ]
    }
}
