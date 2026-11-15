import WordleBoard from "./WordleBoard"
import WordleDictionary from "./WordleDictionary"
import WordleWordScore from "./WordleScore"
import WordleUtils from "./WordleUtils"
import WordleWord from "./WordleWord"

enum WordleGameState {
    Ongoing,
    Victory,
    Loss
}

export enum WordleGameGuessResultType {
    Invalid,
    Unsafe,
    Valid,
    Victory,
    Loss
}

export class WordleGameGuessResult {
    private readonly type: WordleGameGuessResultType
    private readonly score: WordleWordScore | null
    private readonly reason: string | null

    public constructor(type: WordleGameGuessResultType, score?: WordleWordScore, reason?: string) {
        this.type = type
        this.score = score ?? null
        this.reason = reason ?? null
    }

    public getType(): WordleGameGuessResultType {
        return this.type
    }

    public getReason(): string | null {
        return this.reason
    }

    public getScore(): WordleWordScore | null {
        return this.score
    }
}

export default class WordleGame {
    private readonly dictionary: WordleDictionary
    private readonly maximumGuesses: number
    private readonly correctWord: WordleWord
    private readonly board: WordleBoard
    private state: WordleGameState

    public constructor(dictionary: WordleDictionary, maximumGuesses: number) {
        this.dictionary = dictionary
        this.maximumGuesses = maximumGuesses
        this.correctWord = this.dictionary.getRandomWord()
        this.board = new WordleBoard()
        this.state = WordleGameState.Ongoing
    }

    public guess(guessWord: string, enforceSafety: boolean = true): WordleGameGuessResult {
        switch (this.state) {
            case WordleGameState.Loss: return new WordleGameGuessResult(WordleGameGuessResultType.Loss)
            case WordleGameState.Victory: return new WordleGameGuessResult(WordleGameGuessResultType.Victory)
            case WordleGameState.Ongoing:
                if (!WordleUtils.isAlphabetical(guessWord)) {
                    return new WordleGameGuessResult(WordleGameGuessResultType.Invalid, null, "A guess must be alphabetical")
                }

                const word = new WordleWord(guessWord)

                if (word.getLength() !== this.correctWord.getLength()) {
                    return new WordleGameGuessResult(WordleGameGuessResultType.Invalid, null, `A guess should be ${this.correctWord.getLength()} letters long`)
                }

                if (!this.dictionary.containsWord(word)) {
                    return new WordleGameGuessResult(WordleGameGuessResultType.Invalid, null, `The word ${word.toString()} is not in the dictionary`)
                }

                if (enforceSafety) {
                    const unsafeReason = this.board.checkSafety(word)
                    if (unsafeReason) {
                        return new WordleGameGuessResult(WordleGameGuessResultType.Unsafe, null, unsafeReason)
                    }
                }

                const score = new WordleWordScore(word, this.correctWord)
                this.board.addGuess(score)

                if (score.isCorrect()) {
                    this.state = WordleGameState.Victory
                    return new WordleGameGuessResult(WordleGameGuessResultType.Victory, score)
                }
                else if (this.board.getGuessCount() >= this.maximumGuesses) {
                    this.state = WordleGameState.Loss
                    return new WordleGameGuessResult(WordleGameGuessResultType.Loss, score)
                }
                else {
                    return new WordleGameGuessResult(WordleGameGuessResultType.Valid, score)
                }
        }
    }

    public getBoard(): WordleBoard {
        return this.board
    }

    public getCorrectWord(): WordleWord {
        return this.correctWord
    }

    public getGuessCount(): number {
        return this.board.getGuessCount()
    }

    public getMaximumGuesses(): number {
        return this.maximumGuesses
    }

    public toProgressString(): string {
        return `${this.getGuessCount()}/${this.getMaximumGuesses()}`
    }

    public toLetterGroupString(): string {
        const outputGroups: string[] = []
        const correctGroup = this.board.getCorrectLetters()
        const partiallyCorrectGroup = this.board.getPartiallyCorrectLetters()
        const incorrectGroup = this.board.getIncorrectLetters()
        const unknownGroup = this.board.getUnknownLetters()

        if (correctGroup.length > 0) {
            outputGroups.push(`🟩 \`${correctGroup.join("")}\``)
        }

        if (partiallyCorrectGroup.length > 0) {
            outputGroups.push(`🟨 \`${partiallyCorrectGroup.join("")}\``)
        }

        if (incorrectGroup.length > 0) {
            outputGroups.push(`⬛ \`${incorrectGroup.join("")}\``)
        }

        const lines: string[] = []

        if (outputGroups.length > 0) {
            lines.push(outputGroups.join(" "))
        }

        if (unknownGroup.length > 0) {
            lines.push(`Unused: \`${unknownGroup.join("")}\``)
        }

        return lines.join("\n")
    }

    public toPrettyString(showAdditionalInfo: boolean = false): string {
        let boardString = this.board.toPrettyString()

        if (showAdditionalInfo) {
            boardString = `${boardString}\n\n${this.toLetterGroupString()}`
        }

        return boardString
    }
}
