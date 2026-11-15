import WordleWord from "./WordleWord"
import WordleUtils from "./WordleUtils"

export default class WordleDictionary {
    private readonly words: string[]
    private wordSet: Set<string> | null = null

    public constructor(words: string[]) {
        this.words = words.map(WordleUtils.normalizeWord).filter(WordleUtils.isAlphabetical)
    }

    public isEmpty(): boolean {
        return this.words.length === 0
    }

    public filter(filterFunction: (word: string) => boolean): WordleDictionary {
        return new WordleDictionary(this.words.filter(filterFunction))
    }

    public getRandomWord(): WordleWord {
        return new WordleWord(this.words[Math.floor(Math.random() * this.words.length)])
    }

    public containsWord(word: WordleWord): boolean {
        if (!this.wordSet) {
            this.wordSet = new Set(this.words)
        }
        return this.wordSet.has(word.toString())
    }
}
