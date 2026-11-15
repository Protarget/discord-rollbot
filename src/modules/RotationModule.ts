import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import Rotation, { RotationMatch, RotationMode } from "./rotation/Rotation"

const MIN_PLAYERS = 2
const MAX_PLAYERS = 32
const MIN_STATIONS = 1
const MAX_STATIONS = 16
const DEFAULT_STATIONS = 1

const MODE_LABELS: {[mode: string]: string} = {
    [RotationMode.Spread]: "spread (minimize back-to-back games)",
    [RotationMode.Streak]: "streak (maximize back-to-back games)"
}

export default class RotationModule extends Module {
    public readonly name = "rotation"

    private readonly rotations: Map<string, Rotation> = new Map()

    public async onRotation(interaction: ChatInputCommandInteraction) {
        try {
            const subcommand = interaction.options.getSubcommand(true)

            switch (subcommand) {
                case "start":
                    await this.startRotation(interaction)
                    return
                case "current":
                    await this.showCurrent(interaction)
                    return
                case "next":
                    await this.advance(interaction)
                    return
                case "status":
                    await this.showStatus(interaction)
                    return
                case "stop":
                    await this.stopRotation(interaction)
                    return
            }
        }
        catch (e) {
            console.error("Encountered an error managing a rotation", e)
            try {
                await interaction.reply({content: "Something went wrong managing the rotation"})
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
                    .setName("rotation")
                    .setDescription("Plan and track a round robin rotation for fighting games")
                    .addSubcommand(subcommand => subcommand
                        .setName("start")
                        .setDescription("Start a new rotation for this server, replacing any existing one")
                        .addStringOption(option => option
                            .setName("players")
                            .setDescription("Comma separated list of player names")
                            .setRequired(true))
                        .addIntegerOption(option => option
                            .setName("stations")
                            .setDescription(`The number of simultaneous stations (default ${DEFAULT_STATIONS})`)
                            .setMinValue(MIN_STATIONS)
                            .setMaxValue(MAX_STATIONS)
                            .setRequired(false))
                        .addStringOption(option => option
                            .setName("mode")
                            .setDescription("How to order the rotation (default spread)")
                            .setRequired(false)
                            .addChoices(
                                {name: "spread", value: RotationMode.Spread},
                                {name: "streak", value: RotationMode.Streak})))
                    .addSubcommand(subcommand => subcommand
                        .setName("current")
                        .setDescription("Show the matches for the current round"))
                    .addSubcommand(subcommand => subcommand
                        .setName("next")
                        .setDescription("Advance to the next round"))
                    .addSubcommand(subcommand => subcommand
                        .setName("status")
                        .setDescription("Show the rotation settings and progress"))
                    .addSubcommand(subcommand => subcommand
                        .setName("stop")
                        .setDescription("End the rotation for this server")),
                execute: this.onRotation.bind(this)
            }
        ]
    }

    private async startRotation(interaction: ChatInputCommandInteraction) {
        const rawPlayers = interaction.options.getString("players", true)
        const stations = interaction.options.getInteger("stations") ?? DEFAULT_STATIONS
        const mode = (interaction.options.getString("mode") ?? RotationMode.Spread) as RotationMode

        const players = this.parsePlayers(rawPlayers)

        if (players.length < MIN_PLAYERS) {
            await interaction.reply({content: `A rotation needs at least ${MIN_PLAYERS} players`, ephemeral: true})
            return
        }

        if (players.length > MAX_PLAYERS) {
            await interaction.reply({content: `A rotation supports at most ${MAX_PLAYERS} players`, ephemeral: true})
            return
        }

        const rotation = new Rotation({players, stations, mode})
        this.rotations.set(interaction.guildId ?? interaction.channelId, rotation)

        const lines = [
            `Rotation started with ${players.length} players across ${stations} station${stations === 1 ? "" : "s"}`,
            `Mode: ${MODE_LABELS[mode]}`,
            `Rounds: ${rotation.getRoundCount()}`,
            "",
            this.formatRound(rotation),
            "",
            "Full schedule:",
            ...this.formatSchedule(rotation)
        ]

        await interaction.reply({content: lines.join("\n")})
    }

    private async showCurrent(interaction: ChatInputCommandInteraction) {
        const rotation = this.getRotation(interaction)

        if (!rotation) {
            await interaction.reply({content: "There is no rotation in progress. Use `/rotation start` to begin one.", ephemeral: true})
            return
        }

        await interaction.reply({content: this.formatRound(rotation)})
    }

    private async advance(interaction: ChatInputCommandInteraction) {
        const rotation = this.getRotation(interaction)

        if (!rotation) {
            await interaction.reply({content: "There is no rotation in progress. Use `/rotation start` to begin one.", ephemeral: true})
            return
        }

        if (rotation.isFinished()) {
            await interaction.reply({content: `The rotation is already complete after ${rotation.getRoundCount()} rounds. Use \`/rotation start\` to begin a new one.`, ephemeral: true})
            return
        }

        rotation.advance()

        if (rotation.isFinished()) {
            await interaction.reply({content: `Rotation complete after ${rotation.getRoundCount()} rounds. Use \`/rotation start\` to begin a new one.`})
            return
        }

        await interaction.reply({content: this.formatRound(rotation)})
    }

    private async showStatus(interaction: ChatInputCommandInteraction) {
        const rotation = this.getRotation(interaction)

        if (!rotation) {
            await interaction.reply({content: "There is no rotation in progress. Use `/rotation start` to begin one.", ephemeral: true})
            return
        }

        const lines = [
            `Players (${rotation.getPlayers().length}): ${rotation.getPlayers().join(", ")}`,
            `Stations: ${rotation.getStations()}`,
            `Mode: ${MODE_LABELS[rotation.getMode()]}`,
            `Progress: round ${Math.min(rotation.getCurrentRound() + 1, rotation.getRoundCount())} of ${rotation.getRoundCount()}`
        ]

        await interaction.reply({content: lines.join("\n")})
    }

    private async stopRotation(interaction: ChatInputCommandInteraction) {
        const key = interaction.guildId ?? interaction.channelId

        if (!this.rotations.has(key)) {
            await interaction.reply({content: "There is no rotation in progress.", ephemeral: true})
            return
        }

        this.rotations.delete(key)
        await interaction.reply({content: "Rotation ended"})
    }

    private getRotation(interaction: ChatInputCommandInteraction): Rotation | null {
        return this.rotations.get(interaction.guildId ?? interaction.channelId) ?? null
    }

    private parsePlayers(raw: string): string[] {
        const seen = new Set<string>()
        const players: string[] = []

        for (const part of raw.split(",")) {
            const name = part.trim()
            if (name.length === 0) {
                continue
            }

            const key = name.toLowerCase()
            if (seen.has(key)) {
                continue
            }

            seen.add(key)
            players.push(name)
        }

        return players
    }

    private formatRound(rotation: Rotation): string {
        const round = rotation.getCurrentRound()
        const matches = rotation.getCurrentMatches()
        const sittingOut = rotation.getCurrentSittingOut()

        const lines = [`Round ${round + 1}/${rotation.getRoundCount()}`]

        for (const match of matches) {
            lines.push(`Station ${match.station}: ${this.formatMatch(match)}`)
        }

        // With a single station everyone else is obviously waiting, so the
        // list adds noise rather than information.
        if (sittingOut.length > 0 && rotation.getStations() > 1) {
            lines.push(`Sitting out: ${sittingOut.join(", ")}`)
        }

        return lines.join("\n")
    }

    private formatMatch(match: RotationMatch): string {
        return `${match.playerA} vs ${match.playerB}`
    }

    /** Renders every round of the schedule, one line per round. */
    private formatSchedule(rotation: Rotation): string[] {
        const lines: string[] = []

        for (let round = 0; round < rotation.getRoundCount(); round++) {
            const matches = rotation.getMatchesForRound(round)
            const sittingOut = rotation.getSittingOutForRound(round)

            const parts = matches.map(match => `S${match.station}: ${this.formatMatch(match)}`)
            let line = `R${round + 1}: ${parts.join(" | ")}`

            if (sittingOut.length > 0 && rotation.getStations() > 1) {
                line += ` (out: ${sittingOut.join(", ")})`
            }

            lines.push(line)
        }

        return lines
    }
}
