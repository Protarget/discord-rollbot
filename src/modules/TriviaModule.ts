import { ChatInputCommandInteraction, Client, Events, Message, SlashCommandBuilder } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import TriviaGame from "./trivia/TriviaGame"
import { TriviaQuestionGenerator } from "./trivia/TriviaQuestions"

const MIN_QUESTIONS = 1
const MAX_QUESTIONS = 20
const DEFAULT_QUESTIONS = 1
const QUESTION_DURATION_MS = 15000
const HINT_DURATION_MS = 15000
const HINT_COUNT = 3

export default class TriviaModule extends Module {
    public readonly name = "trivia"

    private readonly questionGenerators: {[key: string]: TriviaQuestionGenerator}
    private readonly games: Map<string, TriviaGame> = new Map()
    private currentGenerator: string

    private readonly boundListener = this.onMessage.bind(this)

    public constructor(questionGenerators: {[key: string]: TriviaQuestionGenerator}) {
        super()
        this.questionGenerators = questionGenerators
        this.currentGenerator = Object.keys(questionGenerators)[0]
    }

    public async onStart(client: Client): Promise<void> {
        client.on(Events.MessageCreate, this.boundListener)
    }

    public async onStop(client: Client): Promise<void> {
        client.off(Events.MessageCreate, this.boundListener)

        for (const game of this.games.values()) {
            game.stop()
        }
        this.games.clear()
    }

    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("trivia")
                    .setDescription("Play a game of trivia in this channel")
                    .addSubcommand(subcommand => subcommand
                        .setName("start")
                        .setDescription("Start a new trivia game in this channel")
                        .addIntegerOption(option => option
                            .setName("questions")
                            .setDescription(`The number of questions to ask (default ${DEFAULT_QUESTIONS})`)
                            .setMinValue(MIN_QUESTIONS)
                            .setMaxValue(MAX_QUESTIONS)
                            .setRequired(false)))
                    .addSubcommand(subcommand => subcommand
                        .setName("stop")
                        .setDescription("Stop the trivia game in this channel"))
                    .addSubcommand(subcommand => subcommand
                        .setName("mode")
                        .setDescription("View or change the question source used for new games")
                        .addStringOption(option => option
                            .setName("mode")
                            .setDescription("The question source to use")
                            .setRequired(false)
                            .addChoices(...Object.keys(this.questionGenerators).map(name => ({name, value: name}))))),
                execute: this.onTrivia.bind(this)
            }
        ]
    }

    public async onTrivia(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand(true)

        if (subcommand === "start") {
            await this.startGame(interaction)
        }
        else if (subcommand === "stop") {
            await this.stopGame(interaction)
        }
        else {
            await this.setMode(interaction)
        }
    }

    private async startGame(interaction: ChatInputCommandInteraction) {
        const channelId = interaction.channelId

        if (this.games.has(channelId)) {
            await interaction.reply({content: "A trivia game is already in progress in this channel. Use `/trivia stop` to end it.", ephemeral: true})
            return
        }

        const questionCount = interaction.options.getInteger("questions") ?? DEFAULT_QUESTIONS
        const generator = this.questionGenerators[this.currentGenerator]

        if (!generator) {
            await interaction.reply({content: "No trivia question source is configured", ephemeral: true})
            return
        }

        await interaction.deferReply()

        let questions
        try {
            questions = await generator.getQuestions(questionCount)
        }
        catch (e) {
            console.error("Unable to fetch trivia questions", e)
            await interaction.followUp({content: "Unable to fetch trivia questions right now"})
            return
        }

        if (!questions || questions.length === 0) {
            await interaction.followUp({content: "Unable to fetch trivia questions right now"})
            return
        }

        const channel = interaction.channel
        if (!channel) {
            await interaction.followUp({content: "Unable to start trivia outside of a channel"})
            return
        }

        const game = new TriviaGame({
            channel,
            questions,
            questionDurationMs: QUESTION_DURATION_MS,
            hintDurationMs: HINT_DURATION_MS,
            hintCount: HINT_COUNT
        })

        this.games.set(channelId, game)

        if (questionCount > 1) {
            await interaction.followUp({content: `Starting trivia session with ${questionCount} questions`})
        }
        else {
            await interaction.followUp({content: "Starting trivia session"})
        }

        game.run()
            .catch(e => console.error("Trivia game failed", e))
            .finally(() => {
                if (this.games.get(channelId) === game) {
                    this.games.delete(channelId)
                }
            })
    }

    private async stopGame(interaction: ChatInputCommandInteraction) {
        const game = this.games.get(interaction.channelId)

        if (!game) {
            await interaction.reply({content: "There is no trivia game in progress in this channel.", ephemeral: true})
            return
        }

        game.stop()
        this.games.delete(interaction.channelId)
        await interaction.reply({content: "Trivia game stopped"})
    }

    private async setMode(interaction: ChatInputCommandInteraction) {
        const mode = interaction.options.getString("mode")

        if (mode) {
            if (!this.questionGenerators[mode]) {
                await interaction.reply({content: "Invalid trivia mode", ephemeral: true})
                return
            }

            this.currentGenerator = mode
            await interaction.reply({content: `Trivia mode changed to: ${mode}`})
        }
        else {
            const modes = Object.keys(this.questionGenerators).join(", ")
            await interaction.reply({content: `Current trivia mode: ${this.currentGenerator}\nValid trivia modes: ${modes}`, ephemeral: true})
        }
    }

    private onMessage(message: Message<boolean>) {
        if (message.author.bot) {
            return
        }

        const game = this.games.get(message.channelId)
        if (!game) {
            return
        }

        try {
            game.submitAnswer(message.author.id, message.content)
        }
        catch (e) {
            console.error("Unable to process trivia answer", e)
        }
    }
}
