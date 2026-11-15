import WordleWordScore, { WordleLetterScore } from "./WordleScore"
import WordleWord from "./WordleWord"

export default class WordleBoard {
    private readonly guesses: WordleWordScore[]
    private readonly letterState: {[letter: string]: WordleLetterScore}

    public constructor() {
        this.guesses = []
        this.letterState = {}
    }

    public addGuess(guess: WordleWordScore): void {
        this.guesses.push(guess)
        for (const [letter, score] of guess.getLettersAndScores()) {
            this.letterState[letter] = this.letterState[letter] ? Math.max(this.letterState[letter], score) : score
        }
    }

    public getGuessCount(): number {
        return this.guesses.length
    }

    public getCorrectLetters(): string[] {
        return Object.keys(this.letterState).filter(x => this.letterState[x] === WordleLetterScore.Correct).sort()
    }

    public getPartiallyCorrectLetters(): string[] {
        return Object.keys(this.letterState).filter(x => this.letterState[x] === WordleLetterScore.PartiallyCorrect).sort()
    }

    public getIncorrectLetters(): string[] {
        return Object.keys(this.letterState).filter(x => this.letterState[x] === WordleLetterScore.Incorrect).sort()
    }

    public getUnknownLetters(): string[] {
        return "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(x => !this.letterState[x])
    }

    public checkSafety(word: WordleWord): string | null {
        for (let index = 0; index < word.getLength(); index++) {
            const letter = word.getLetterAt(index)
            if (this.letterState[letter] === WordleLetterScore.Incorrect) {
                return `The letter '${letter}' has already been ruled out`
            }
            else {
                for (const guess of this.guesses) {
                    if (guess.getLetterAt(index) === letter) {
                        const guessScore = guess.getLetterScoreAt(index)
                        if (guessScore === WordleLetterScore.PartiallyCorrect || guessScore === WordleLetterScore.Incorrect) {
                            return `The letter '${letter}' has already been tried in position ${index + 1}`
                        }
                    }
                }
            }
        }

        return null
    }

    public toPrettyString(): string {
        return this.guesses.map(x => x.toPrettyString()).join("\n")
    }
}
