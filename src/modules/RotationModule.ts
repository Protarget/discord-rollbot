import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import Rotation, { RotationMatch, RotationMode } from "./rotation/Rotation"

const MIN_PLAYERS = 2
const MAX_PLAYERS = 32
const MIN_STATIONS = 1
const MAX_STATIONS = 16
const DEFAULT_STATIONS = 1
const NEXT_BUTTON_PREFIX = "rotation:next"

interface RotationMessage {
    content: string
    components: ActionRowBuilder<ButtonBuilder>[]
}

interface ActiveButton {
    channelId: string
    messageId: string
    round: number
}

const MODE_LABELS: {[mode: string]: string} = {
    [RotationMode.Spread]: "spread (minimize back-to-back games)",
    [RotationMode.Streak]: "streak (maximize back-to-back games)"
}

export default class RotationModule extends Module {
    public readonly name = "rotation"

    private readonly rotations: Map<string, Rotation> = new Map()

    private readonly activeButtons: Map<string, ActiveButton> = new Map()

    private client: Client | null = null

    public async onStart(client: Client): Promise<void> {
        this.client = client
    }

    public async onStop(client: Client): Promise<void> {
        this.client = null
        this.rotations.clear()
        this.activeButtons.clear()
    }

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

        const key = interaction.guildId ?? interaction.channelId
        const rotation = new Rotation({players, stations, mode})
        this.rotations.set(key, rotation)
.
        await this.deactivateButton(key)

        const lines = [
            `Rotation started with ${players.length} players across ${stations} station${stations === 1 ? "" : "s"}`,
            `Mode: ${MODE_LABELS[mode]}`,
            `Rounds: ${rotation.getRoundCount()}`,
            "",
            this.formatRound(rotation),
            "",
            "Full schedule:",
            this.formatSchedule(rotation)
        ]

        const message = await interaction.reply({
            ...this.withNextButton(rotation, lines.join("\n")),
            fetchReply: true
        })

        this.activeButtons.set(key, {
            channelId: message.channelId,
            messageId: message.id,
            round: rotation.getCurrentRound()
        })
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

        if (rotation.getRoundCount() === 0) {
            await interaction.reply({content: "This rotation has no rounds to play.", ephemeral: true})
            return
        }

        const key = interaction.guildId ?? interaction.channelId
        const wrapped = rotation.advance()

        await this.deactivateButton(key)

        const message = await interaction.reply({
            ...this.withNextButton(rotation, this.formatAdvance(rotation, wrapped)),
            fetchReply: true
        })

        this.activeButtons.set(key, {
            channelId: message.channelId,
            messageId: message.id,
            round: rotation.getCurrentRound()
        })
    }

    public async onButton(interaction: ButtonInteraction): Promise<boolean> {
        if (!interaction.customId.startsWith(NEXT_BUTTON_PREFIX)) {
            return false
        }

        const key = interaction.guildId ?? interaction.channelId
        const rotation = this.rotations.get(key)

        if (!rotation) {
            await interaction.reply({content: "There is no rotation in progress. Use `/rotation start` to begin one.", ephemeral: true})
            return true
        }

        const expectedRound = Number(interaction.customId.slice(NEXT_BUTTON_PREFIX.length + 1))

        if (rotation.getCurrentRound() !== expectedRound) {
            await interaction.reply({content: "That button has already been used. Use the button on the latest message, or `/rotation next`.", ephemeral: true})
            return true
        }

        const wrapped = rotation.advance()

        await this.deactivateButton(key)

        const message = await interaction.reply({
            ...this.withNextButton(rotation, this.formatAdvance(rotation, wrapped)),
            fetchReply: true
        })

        this.activeButtons.set(key, {
            channelId: message.channelId,
            messageId: message.id,
            round: rotation.getCurrentRound()
        })
        return true
    }

    private async deactivateButton(key: string): Promise<void> {
        const active = this.activeButtons.get(key)

        if (!active) {
            return
        }

        this.activeButtons.delete(key)

        try {
            const channel = await this.client.channels.fetch(active.channelId)

            if (!channel || !channel.isTextBased() || !("messages" in channel)) {
                return
            }

            const message = await channel.messages.fetch(active.messageId)
            await message.edit({components: []})
        }
        catch (e) {
            // The message may have been deleted, which is fine.
            console.error("Unable to remove the rotation button from the previous message", e)
        }
    }

    private withNextButton(rotation: Rotation, content: string): RotationMessage {
        const button = new ButtonBuilder()
            .setCustomId(`${NEXT_BUTTON_PREFIX}:${rotation.getCurrentRound()}`)
            .setLabel("Next round")
            .setStyle(ButtonStyle.Primary)

        return {
            content,
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)]
        }
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
            `Progress: round ${rotation.getCurrentRound() + 1} of ${rotation.getRoundCount()}`
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
        await this.deactivateButton(key)
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

    private formatAdvance(rotation: Rotation, wrapped: boolean): string {
        const round = this.formatRound(rotation)

        return round
    }

    private formatRound(rotation: Rotation): string {        const round = rotation.getCurrentRound()
        const matches = rotation.getCurrentMatches()
        const sittingOut = rotation.getCurrentSittingOut()
        const multipleStations = rotation.getStations() > 1

        const lines = [`Round ${round + 1}/${rotation.getRoundCount()}`]

        const widths = this.columnWidths(matches)

        for (const match of matches) {
            const prefix = multipleStations ? `Station ${match.station}: ` : ""
            lines.push((prefix + this.formatMatch(match, widths)).trimEnd())
        }

        if (sittingOut.length > 0 && multipleStations) {
            lines.push(`Sitting out: ${sittingOut.join(", ")}`)
        }

        return codeBlock(lines.join("\n"))
    }

    private formatMatch(match: RotationMatch, widths: ColumnWidths): string {
        return `${match.playerA.padEnd(widths.first)} vs ${match.playerB.padEnd(widths.second)}`
    }

    private formatSchedule(rotation: Rotation): string {
        const lines: string[] = []
        const multipleStations = rotation.getStations() > 1
        const roundWidth = String(rotation.getRoundCount()).length

        const widths = this.scheduleColumnWidths(rotation)

        for (let round = 0; round < rotation.getRoundCount(); round++) {
            const matches = rotation.getMatchesForRound(round)
            const sittingOut = rotation.getSittingOutForRound(round)

            const parts = matches.map(match => {
                const pair = this.formatMatch(match, widths)
                return multipleStations ? `S${match.station}: ${pair}` : pair
            })

            const label = `R${String(round + 1).padStart(roundWidth)}:`
            let line = `${label} ${parts.join(" | ")}`

            if (sittingOut.length > 0 && multipleStations) {
                line += ` (out: ${sittingOut.join(", ")})`
            }

            lines.push(line.trimEnd())
        }

        return codeBlock(lines.join("\n"))
    }

    private columnWidths(matches: RotationMatch[]): ColumnWidths {
        let first = 0
        let second = 0

        for (const match of matches) {
            first = Math.max(first, match.playerA.length)
            second = Math.max(second, match.playerB.length)
        }

        return {first, second}
    }

    private scheduleColumnWidths(rotation: Rotation): ColumnWidths {
        const perStation: ColumnWidths[] = []

        for (let round = 0; round < rotation.getRoundCount(); round++) {
            for (const match of rotation.getMatchesForRound(round)) {
                const index = match.station - 1
                const widths = perStation[index] ?? {first: 0, second: 0}
                widths.first = Math.max(widths.first, match.playerA.length)
                widths.second = Math.max(widths.second, match.playerB.length)
                perStation[index] = widths
            }
        }

        return {
            first: perStation.reduce((width, x) => Math.max(width, x.first), 0),
            second: perStation.reduce((width, x) => Math.max(width, x.second), 0)
        }
    }
}

interface ColumnWidths {
    first: number
    second: number
}

function codeBlock(text: string): string {
    return "```\n" + text + "\n```"
}
