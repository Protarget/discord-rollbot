import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import * as fs from "fs"
import * as roman from "roman-numerals"
import * as seasons from "seasons-dates"

export default class FrcModule extends Module {
    public readonly name = "frc"
    private dayNames: string[] = []
    private monthNames: string[] = []

    public constructor(dayFilename: string, monthFilename: string) {
        super()
        this.dayNames = fs.readFileSync(dayFilename, "utf-8").split("\n")
        this.monthNames = fs.readFileSync(monthFilename, "utf-8").split("\n")
    }


    public async onFrc(interaction: ChatInputCommandInteraction) {
        try {
            const equinox = (equinoxYear) => {
                equinoxYear += 1791
                const equinoxDate = new Date(Date.UTC(equinoxYear, 8, seasons(equinoxYear).autumn.getUTCDate(), 0, 0, 0, 0))
                return equinoxDate
            }
            const date = new Date()
            let year = date.getFullYear() - 1792
            if (date.getMonth() > 8) {
                year += 1
            }
            if (date.getMonth() === 8 && date >= equinox(year + 1)) {
                year += 1
            }
            const dayOfYear = Math.floor((+date - +equinox(year)) / 86400000)
            const month = Math.floor((dayOfYear) / 30)
            const dayOfMonth = ((dayOfYear) % 30) + 1
            const content = `Today is ${this.dayNames[dayOfYear]} -- ${dayOfMonth} ${this.monthNames[month]} ${roman.toRoman(year)}`
            await interaction.reply({content})
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
    
    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("frc")
                    .setDescription("Retrieve the current date on the French Republican Calendar."),
                execute: this.onFrc.bind(this)
            }
        ]
    }
}