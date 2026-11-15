import WordleUtils from "./WordleUtils"

export default class WordleWord {
    private readonly letters: string[]

    public constructor(word: string) {
        this.letters = WordleUtils.normalizeWord(word).split("")
    }

    public getLength(): number {
        return this.letters.length
    }

    public getLetterAt(index: number): string | null {
        return this.letters[index] ?? null
    }

    public getLetters(): ReadonlyArray<string> {
        return this.letters
    }

    public getLetterCounts(): {[letter: string]: number} {
        const letterCounts: {[letter: string]: number} = {}
        for (const letter of this.letters) {
            letterCounts[letter] = letterCounts[letter] ? letterCounts[letter] + 1 : 1
        }
        return letterCounts
    }

    public toString(): string {
        return this.letters.join("")
    }
}
