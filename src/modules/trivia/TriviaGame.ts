import { TextBasedChannel } from "discord.js"
import * as removeAccents from "remove-accents"
import { TriviaQuestion } from "./TriviaQuestions"

export enum TriviaGameState {
    Idle,
    Asking,
    Hinting,
    Finished
}

export interface TriviaGameOptions {
    channel: TextBasedChannel
    questions: TriviaQuestion[]
    questionDurationMs: number
    hintDurationMs: number
    hintCount: number
}

interface TriviaScore {
    userId: string
    points: number
}

const PARENTHETICAL_REGEX = /\(|\)/g
const PARENTHETICAL_CONTENT_REGEX = /\(.+?\)/g
const MULTIPLE_SPACES_REGEX = /  +/g
const NON_ALPHANUMERIC_REGEX = /[^a-zA-Z0-9 ]/g
const MARKDOWN_SPECIAL_REGEX = /[\\*_~`|>#\-[\]()]/g

/**
 * Escapes Discord markdown characters so that literal text (such as a hint made
 * of underscores) renders as-is instead of being interpreted as formatting.
 */
function escapeMarkdown(value: string): string {
    return value.replace(MARKDOWN_SPECIAL_REGEX, "\\$&")
}

/**
 * Wraps text in an inline code span. Backticks cannot be escaped inside a code
 * span, so they are replaced with a lookalike to keep the span intact.
 */
function codeSpan(value: string): string {
    return `\`${value.replace(/`/g, "'")}\``
}

/**
 * Normalizes free-form text so that answers can be compared loosely: accents are
 * stripped, case is ignored, punctuation and parentheticals are removed, and
 * leading articles ("a", "an", "the") are dropped.
 */
function normalizeAnswer(value: string): string {
    const accentsRemoved = removeAccents(value)
    const lower = accentsRemoved.toLowerCase()
    const noBrackets = lower.replace(PARENTHETICAL_CONTENT_REGEX, "")
    const noDashes = noBrackets.replace(/-/g, " ")
    const compactSpaces = noDashes.replace(MULTIPLE_SPACES_REGEX, " ")
    const normalizedAnd = compactSpaces.replace(/&/g, "and")
    const noPunctuation = normalizedAnd.replace(NON_ALPHANUMERIC_REGEX, "")
    const noPrefixA = noPunctuation.replace(/^a /g, "")
    const noPrefixAn = noPrefixA.replace(/^an /g, "")
    const noPrefixThe = noPrefixAn.replace(/^the /g, "")
    return noPrefixThe.trim()
}

/**
 * A single trivia game, driven by an asynchronous state machine.
 *
 * The game advances through `Idle -> Asking -> Hinting -> Asking -> ... -> Finished`.
 * Each transition is performed by `run()`, which awaits the timer for the current
 * state. Answers arriving from chat are delivered through `submitAnswer()` and are
 * only accepted while the game is in the `Asking` or `Hinting` state.
 */
export default class TriviaGame {
    private readonly channel: TextBasedChannel
    private readonly questions: TriviaQuestion[]
    private readonly questionDurationMs: number
    private readonly hintDurationMs: number
    private readonly hintCount: number

    private readonly scores: Map<string, number> = new Map()

    private state: TriviaGameState = TriviaGameState.Idle
    private questionIndex: number = 0
    private currentQuestion: TriviaQuestion | null = null
    private currentHints: string[] = []
    private hintIndex: number = 0
    private timer: NodeJS.Timeout | null = null
    private resolveTimer: (() => void) | null = null
    private finished: Promise<void> | null = null

    public constructor(options: TriviaGameOptions) {
        this.channel = options.channel
        this.questions = options.questions
        this.questionDurationMs = options.questionDurationMs
        this.hintDurationMs = options.hintDurationMs
        this.hintCount = options.hintCount
    }

    public getState(): TriviaGameState {
        return this.state
    }

    public isActive(): boolean {
        return this.state !== TriviaGameState.Finished
    }

    public getQuestionCount(): number {
        return this.questions.length
    }

    /**
     * Runs the game to completion. Safe to call more than once; subsequent calls
     * return the same promise.
     */
    public run(): Promise<void> {
        if (!this.finished) {
            this.finished = this.runStateMachine()
        }
        return this.finished
    }

    /**
     * Stops the game immediately, cancelling any pending timer.
     */
    public stop(): void {
        if (this.state === TriviaGameState.Finished) {
            return
        }

        this.state = TriviaGameState.Finished
        this.cancelTimer()
    }

    /**
     * Offers an answer to the current question. Returns true when the answer was
     * correct and the game advanced.
     */
    public submitAnswer(userId: string, message: string): boolean {
        if (this.state !== TriviaGameState.Asking && this.state !== TriviaGameState.Hinting) {
            return false
        }

        const question = this.currentQuestion
        if (!question) {
            return false
        }

        const normalizedAnswer = normalizeAnswer(message)
        const acceptableAnswers = this.preserveParentheticals(question.answers)

        if (!acceptableAnswers.some(answer => normalizeAnswer(answer) === normalizedAnswer)) {
            return false
        }

        this.scores.set(userId, (this.scores.get(userId) ?? 0) + 1)
        this.say(`Correct <@${userId}>, the answer was: ${escapeMarkdown(question.answers[0])}`)
        this.advance()
        return true
    }

    private async runStateMachine(): Promise<void> {
        while (this.state !== TriviaGameState.Finished) {
            switch (this.state) {
                case TriviaGameState.Idle:
                    this.beginQuestion()
                    break
                case TriviaGameState.Asking:
                    await this.wait(this.questionDurationMs)
                    if (this.state === TriviaGameState.Asking) {
                        this.state = TriviaGameState.Hinting
                    }
                    break
                case TriviaGameState.Hinting:
                    if (this.hintIndex < this.currentHints.length) {
                        this.say(`Hint (${this.hintIndex + 1}/${this.currentHints.length}): ${codeSpan(this.currentHints[this.hintIndex])}`)
                        this.hintIndex++
                        await this.wait(this.hintDurationMs)
                    }
                    else {
                        this.revealAnswer()
                    }
                    break
            }
        }
    }

    private beginQuestion(): void {
        const question = this.questions[this.questionIndex]
        this.currentQuestion = question
        this.currentHints = this.generateHints(question.answers[0], this.hintCount)
        this.hintIndex = 0

        const prefix = this.questions.length > 1
            ? `Q (${this.questionIndex + 1}/${this.questions.length}): `
            : "Q: "

        this.say(prefix + question.question)
        for (const additional of question.additional) {
            this.say(additional)
        }

        this.state = TriviaGameState.Asking
    }

    private revealAnswer(): void {
        const question = this.currentQuestion
        if (question) {
            this.say(`Times Up! Answer: ${escapeMarkdown(question.answers[0])}`)
        }
        this.advance()
    }

    private advance(): void {
        this.cancelTimer()
        this.questionIndex++

        if (this.questionIndex >= this.questions.length) {
            this.finish()
        }
        else {
            this.state = TriviaGameState.Idle
        }
    }

    private finish(): void {
        this.state = TriviaGameState.Finished
        this.cancelTimer()

        if (this.questions.length > 1) {
            this.say("Session over")
            this.announceScore()
        }
    }

    private announceScore(): void {
        const entries: TriviaScore[] = [...this.scores.entries()]
            .map(([userId, points]) => ({ userId, points }))
            .sort((a, b) => b.points - a.points)

        if (entries.length === 0) {
            this.say("Nobody answered any questions. Wow. Sad")
            return
        }

        let rank = 0
        let previousPoints = -1
        for (const entry of entries) {
            if (entry.points !== previousPoints) {
                rank++
                previousPoints = entry.points
            }
            this.say(`${rank}. <@${entry.userId}> with ${entry.points} points`)
        }
    }

    private generateHints(answer: string, count: number): string[] {
        const hiddenIndices: number[] = []
        const hints: string[] = []

        for (let index = 0; index < answer.length; index++) {
            hiddenIndices.push(index)
        }

        for (let remaining = count; remaining > 0; remaining--) {
            const max = Math.ceil(remaining / (count + 1) * answer.length)
            while (hiddenIndices.length > max) {
                hiddenIndices.splice(Math.floor(Math.random() * hiddenIndices.length), 1)
            }

            let hint = ""
            for (let index = 0; index < answer.length; index++) {
                hint += hiddenIndices.indexOf(index) !== -1 ? "_" : answer.charAt(index)
            }
            hints.push(hint)
        }

        return hints
    }

    private preserveParentheticals(answers: string[]): string[] {
        const result: string[] = []
        for (const answer of answers) {
            result.push(answer, answer.replace(PARENTHETICAL_REGEX, ""))
        }
        return result
    }

    private say(message: string): void {
        this.channel.send(message).catch(e => console.error("Unable to send trivia message", e))
    }

    private wait(milliseconds: number): Promise<void> {
        return new Promise(resolve => {
            this.resolveTimer = resolve
            this.timer = setTimeout(() => {
                this.timer = null
                this.resolveTimer = null
                resolve()
            }, milliseconds)
        })
    }

    private cancelTimer(): void {
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }

        if (this.resolveTimer) {
            const resolve = this.resolveTimer
            this.resolveTimer = null
            resolve()
        }
    }
}
