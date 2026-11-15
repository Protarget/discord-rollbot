const ALPHABETICAL_REGEX = /^[a-zA-Z]+$/

export default class WordleUtils {
    public static normalizeWord(word: string): string {
        return word.toUpperCase().trim()
    }

    public static isAlphabetical(word: string): boolean {
        return ALPHABETICAL_REGEX.test(word)
    }
}
