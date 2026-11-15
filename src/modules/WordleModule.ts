import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js"
import * as fs from "fs"
import Module, { ModuleCommand } from "./Module"
import WordleDictionary from "./wordle/WordleDictionary"
import WordleGame, { WordleGameGuessResult, WordleGameGuessResultType } from "./wordle/WordleGame"

const MIN_LETTERS = 1
const MAX_LETTERS = 20
const MIN_GUESSES = 1
const MAX_GUESSES = 20
const DEFAULT_LETTERS = 5
const DEFAULT_GUESSES = 6

export default class WordleModule extends Module {
    public readonly name = "wordle"

    private readonly dictionary: WordleDictionary
    private readonly games: Map<string, WordleGame> = new Map()

    public constructor(filename: string) {
        super()
        this.dictionary = new WordleDictionary(fs.readFileSync(filename, "utf-8").split("\n"))
    }

    public async onWordle(interaction: ChatInputCommandInteraction) {
        const channelId = interaction.channelId

        try {
            const subcommand = interaction.options.getSubcommand(true)

            switch (subcommand) {
                case "start":
                    await this.startGame(interaction, channelId)
                    return
                case "guess":
                    await this.makeMove(interaction, channelId)
                    return
                case "show":
                    await this.showGameState(interaction, channelId)
                    return
                case "stop":
                    await this.stopGame(interaction, channelId)
                    return
            }
        }
        catch (e) {
            console.error("Encountered an error playing Wordle", e)
            this.games.delete(channelId)
            try {
                await interaction.reply({content: "Uhh, something went wrong? I'm going to reset everything instead of crashing"})
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
                    .setName("wordle")
                    .setDescription("Play a game of Wordle in this channel")
                    .addSubcommand(subcommand => subcommand
                        .setName("start")
                        .setDescription("Start a new game in this channel")
                        .addIntegerOption(option => option
                            .setName("letters")
                            .setDescription(`The number of letters in the word (default ${DEFAULT_LETTERS})`)
                            .setMinValue(MIN_LETTERS)
                            .setMaxValue(MAX_LETTERS)
                            .setRequired(false))
                        .addIntegerOption(option => option
                            .setName("guesses")
                            .setDescription(`The number of guesses allowed (default ${DEFAULT_GUESSES})`)
                            .setMinValue(MIN_GUESSES)
                            .setMaxValue(MAX_GUESSES)
                            .setRequired(false)))
                    .addSubcommand(subcommand => subcommand
                        .setName("guess")
                        .setDescription("Make a guess in the ongoing game")
                        .addStringOption(option => option
                            .setName("word")
                            .setDescription("The word to guess")
                            .setMinLength(MIN_LETTERS)
                            .setMaxLength(MAX_LETTERS)
                            .setRequired(true))
                        .addBooleanOption(option => option
                            .setName("confirm")
                            .setDescription("Override the safety checks that prevent obviously wasted guesses")
                            .setRequired(false)))
                    .addSubcommand(subcommand => subcommand
                        .setName("show")
                        .setDescription("Show the state of the ongoing game"))
                    .addSubcommand(subcommand => subcommand
                        .setName("stop")
                        .setDescription("Abandon the ongoing game")),
                execute: this.onWordle.bind(this)
            }
        ]
    }

    private async startGame(interaction: ChatInputCommandInteraction, channelId: string) {
        if (this.games.has(channelId)) {
            await interaction.reply({content: "A game is already in progress in this channel. Use `/wordle show` to see it, or `/wordle stop` to abandon it."})
            return
        }

        const letterCount = interaction.options.getInteger("letters") ?? DEFAULT_LETTERS
        const guessMaximum = interaction.options.getInteger("guesses") ?? DEFAULT_GUESSES

        const subDictionary = this.dictionary.filter(x => x.length === letterCount)

        if (subDictionary.isEmpty()) {
            await interaction.reply({content: `No words with ${letterCount} letters were found`})
            return
        }

        this.games.set(channelId, new WordleGame(subDictionary, guessMaximum))
        await interaction.reply({content: `Wordle game started (${letterCount} letters, ${guessMaximum} guesses)`})
    }

    private async makeMove(interaction: ChatInputCommandInteraction, channelId: string) {
        const game = this.games.get(channelId)

        if (!game) {
            await interaction.reply({content: "There is no game in progress in this channel. Use `/wordle start` to begin one."})
            return
        }

        const move = interaction.options.getString("word", true)
        const enforceSafety = !(interaction.options.getBoolean("confirm") ?? false)
        const result = game.guess(move, enforceSafety)

        switch (result.getType()) {
            case WordleGameGuessResultType.Victory:
                this.games.delete(channelId)
                await interaction.reply({content: this.formatEndOfGame(game, true)})
                return
            case WordleGameGuessResultType.Loss:
                this.games.delete(channelId)
                await interaction.reply({content: this.formatEndOfGame(game, false)})
                return
            case WordleGameGuessResultType.Valid:
                await interaction.reply({content: this.formatMove(game, result)})
                return
            case WordleGameGuessResultType.Invalid:
                await interaction.reply({content: `Invalid move: ${result.getReason()}`, ephemeral: true})
                return
            case WordleGameGuessResultType.Unsafe:
                await interaction.reply({content: `Unsafe move: ${result.getReason()}\nUse \`/wordle guess\` with \`confirm\` set to override safety checks`, ephemeral: true})
                return
        }
    }

    private async showGameState(interaction: ChatInputCommandInteraction, channelId: string) {
        const game = this.games.get(channelId)

        if (!game) {
            await interaction.reply({content: "There is no game in progress in this channel. Use `/wordle start` to begin one.", ephemeral: true})
            return
        }

        const lines = [`Wordle Currently Playing ${game.toProgressString()}`]

        if (game.getGuessCount() > 0) {
            lines.push(game.toPrettyString(true))
        }

        await interaction.reply({content: lines.join("\n")})
    }

    private async stopGame(interaction: ChatInputCommandInteraction, channelId: string) {
        const game = this.games.get(channelId)

        if (!game) {
            await interaction.reply({content: "There is no game in progress in this channel.", ephemeral: true})
            return
        }

        this.games.delete(channelId)
        await interaction.reply({content: `Game abandoned. The word was ${game.getCorrectWord()}`})
    }

    private formatMove(game: WordleGame, result: WordleGameGuessResult): string {
        return `${result.getScore().toPrettyString()} (${game.toProgressString()}) ${game.toLetterGroupString()}`
    }

    private formatEndOfGame(game: WordleGame, victory: boolean): string {
        const outcome = victory ? "Victory" : "Failure"
        return `Wordle ${outcome} (${game.getCorrectWord()}) ${game.toProgressString()}\n${game.toPrettyString(true)}`
    }
}
