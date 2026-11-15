import * as fs from "fs"

export class TriviaQuestion {
    public readonly question: string
    public readonly answers: string[]
    public readonly additional: string[]

    public constructor(question: string, answers: string[], additional: string[] = []) {
        this.question = question
        this.answers = answers
        this.additional = additional
    }
}

export interface TriviaQuestionGenerator {
    getQuestions(count: number): Promise<TriviaQuestion[]>
}

export class TriviaFileQuestionGenerator implements TriviaQuestionGenerator {
    private readonly questions: TriviaQuestion[]

    public constructor(filename: string) {
        this.questions = this.loadQuestions(filename)
    }

    public loadQuestions(filename: string): TriviaQuestion[] {
        return fs.readFileSync(filename, "utf-8")
            .split("\n")
            .filter(Boolean)
            .map(line => {
                const values = line.split("~")
                const question = values.shift()
                return new TriviaQuestion(question, values)
            })
    }

    public async getQuestions(count: number): Promise<TriviaQuestion[]> {
        return new Array(count).fill(null).map(() => this.getQuestion())
    }

    private getQuestion(): TriviaQuestion {
        return this.questions[Math.floor(Math.random() * this.questions.length)]
    }
}

export class TriviaJeopardyFileQuestionGenerator extends TriviaFileQuestionGenerator {
    public loadQuestions(filename: string): TriviaQuestion[] {
        return JSON.parse(fs.readFileSync(filename, "utf-8")).map(x => {
            const value = x.value ? `, ${formatValue(x.value)}` : ""
            const year = x.year ? `, ${x.year}` : ""
            const category = x.category ?? "unknown category"
            return new TriviaQuestion(`(${category}${value}${year}) ${x.question}`, x.answer, x.media ?? [])
        })
    }
}

function formatValue(value: string | number): string {
    const text = String(value).trim()
    return text.startsWith("$") ? text : `$${text}`
}
