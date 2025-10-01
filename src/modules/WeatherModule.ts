import { SlashCommandBuilder, ChatInputCommandInteraction, bold } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import {parseMetar}  from "metar-taf-parser"
import en from "metar-taf-parser/locale/en"

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
            const metarLocation = interaction.options.getString("location").toUpperCase()
            await interaction.deferReply()
    
            if (metarLocation.match(/^[A-Z0-9]{4}$/)) {
                const page = await fetch("http://tgftp.nws.noaa.gov/data/observations/metar/stations/" + metarLocation + ".TXT")
                const pageText = await page.text()

                if (pageText.includes("404 Not Found") === true) {
                    await interaction.followUp({content: "Error: Unknown ICAO code: " + metarLocation})
                }
                else {
                    const metarRaw = pageText.split("\n")[1]
                    const metar = parseMetar(metarRaw, {locale: en})
                    let metarOut = "```" + metarRaw + "\n\n"
                    metarOut += `Station: ${metar.station}\n`
                    metarOut += `Time: ${metar.hour.toString().padStart(2,'0')}:${metar.minute.toString().padStart(2,'0')} UTC (Day of month: ${metar.day})\n`
                    if (metar.wind.speed > 0) {
                        metarOut += `Wind: ${en.Converter[metar.wind.direction]} at ${metar.wind.speed} ${metar.wind.unit}`
                        if (metar.wind.gust !== undefined) {
                            metarOut += ` (gusts at ${metar.wind.gust} ${metar.wind.unit})\n`
                        } else {
                            metarOut += "\n"
                        }
                    } else {
                        metarOut += `Wind: none\n`
                    }
                    metarOut += `Visibility: ${metar.visibility.value} ${metar.visibility.unit}\n`
                    if (metar.weatherConditions.length > 0) {
                        metarOut += "Weather conditions: \n"
                        metar.weatherConditions.forEach(condition => {
                            metarOut += "  "
                            if (condition.intensity !== undefined) {
                                if (condition.intensity === "+") {
                                    metarOut += `${en["intensity-plus"]} `
                                } else {
                                    metarOut += `${en.Intensity[condition.intensity]} `
                                }
                            }
                            if (condition.descriptive !== undefined) {
                                metarOut += `${en.Descriptive[condition.descriptive]} `
                            }
                            if (condition.phenomenons.length > 0) {
                                condition.phenomenons.forEach(phenomenon => {
                                    metarOut += `${en.Phenomenon[phenomenon]}`
                                });
                            }
                            metarOut += "\n"
                        })
                    }
                    if (metar.clouds.length > 0) {
                        metarOut += "Clouds:\n"
                        metar.clouds.forEach(cloud => {
                            metarOut += `  ${en.CloudQuantity[cloud.quantity]} at ${cloud.height}`
                            if (cloud.type !== undefined) {
                                metarOut += ` (${en.CloudType[cloud.type]})`
                            }
                            metarOut += "\n"
                        });
                    }
                    metarOut += `Temperature: ${metar.temperature}°C\n`
                    metarOut += `Dew Point: ${metar.dewPoint}°C\n`
                    metarOut += `Pressure: ${metar.altimeter.value} ${metar.altimeter.unit}\n`
                    if (metar.remarks.length > 0) {
                        metarOut += "\nRemarks:\n"
                        metar.remarks.forEach(remark => {
                            if (remark.description !== undefined) {
                                metarOut += remark.description + "\n"
                            }
                        })
                    }
                    metarOut += "```"
                    await interaction.followUp({content: metarOut})
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