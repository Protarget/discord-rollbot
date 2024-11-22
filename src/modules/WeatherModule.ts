import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import * as fs from "fs"
import * as roman from "roman-numerals"
import * as seasons from "seasons-dates"

export default class WeatherModule extends Module {
    public readonly name = "weather"

    public async onWeather(interaction: ChatInputCommandInteraction) {
        try {
            const weatherLocation = interaction.options.getString("location")
            await interaction.deferReply()
            if (weatherLocation.match(/^[\ a-zA-Z0-9\-_,~]+$/)) {
                const page = await fetch("http://wttr.in/" + weatherLocation + "?m?0?T", {
                        headers: { "User-Agent": "curl" }
                    })
                const pageText = await page.text()
                const weather = pageText

                if (weather.startsWith("ERROR: Unknown location") === true) {
                    await interaction.followUp({content: "Unknown location: " + weatherLocation})
                }
                else {
                    await interaction.followUp({content: "```" + weather + "```"})
                }
            }
            else {
                await interaction.followUp({content: "Please do not use special characters in location names"})
            }
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

    public async onMetar(interaction: ChatInputCommandInteraction) {
        try {
            const metarLocation = interaction.options.getString("location")
            await interaction.deferReply()
    
            if (metarLocation.match(/^[A-Z0-9]{4}$/)) {
                const page = await fetch("http://tgftp.nws.noaa.gov/data/observations/metar/stations/" + metarLocation + ".TXT")
                const pageText = await page.text()
                const metar = pageText

                if (metar.includes("404 Not Found") === true) {
                    await interaction.followUp({content: "Error: Unknown ICAO code: " + metarLocation})
                }
                else {
                    await interaction.followUp({content: "```" + metar.split("\n")[1] + "```"})
                }
            }
            else {
                await interaction.followUp({content: "Error: Please specify a four-character ICAO code"})
            }
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
                    .setName("weather")
                    .setDescription("Retrieve the weather from a specific location")
                    .addStringOption(option => option
                        .setName("location")
                        .setMinLength(1)
                        .setDescription("A location, such as a city name or three-letter airport code")
                    .setRequired(true)),
                execute: this.onWeather.bind(this)
            },
            {
                data: new SlashCommandBuilder()
                    .setName("metar")
                    .setDescription("Retrieve a METAR report from a specific ICAO code")
                    .addStringOption(option => option
                        .setName("location")
                        .setMinLength(4)
                        .setMaxLength(4)
                        .setDescription("A four letter ICAO code")
                    .setRequired(true)),
                execute: this.onMetar.bind(this)
            }
        ]
    }
}