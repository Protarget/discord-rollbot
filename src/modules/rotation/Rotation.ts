export enum RotationMode {
    Spread = "spread",
    Streak = "streak"
}

export interface RotationMatch {
    round: number
    station: number
    playerA: string
    playerB: string
}

export interface RotationOptions {
    players: string[]
    stations: number
    mode: RotationMode
}

type Pair = [string, string]

export default class Rotation {
    private readonly players: string[]
    private readonly stations: number
    private readonly mode: RotationMode
    private readonly matches: RotationMatch[]
    private readonly roundCount: number

    private currentRound: number = 0

    public constructor(options: RotationOptions) {
        this.players = [...options.players]
        this.stations = options.stations
        this.mode = options.mode

        const roster = Rotation.shuffle(this.players)
        const rounds = Rotation.buildRounds(roster, this.stations, this.mode)

        this.matches = []
        for (let round = 0; round < rounds.length; round++) {
            const pairs = rounds[round]
            for (let index = 0; index < pairs.length; index++) {
                this.matches.push({
                    round,
                    station: index + 1,
                    playerA: pairs[index][0],
                    playerB: pairs[index][1]
                })
            }
        }

        this.roundCount = rounds.length
    }

    public getPlayers(): ReadonlyArray<string> {
        return this.players
    }

    public getStations(): number {
        return this.stations
    }

    public getMode(): RotationMode {
        return this.mode
    }

    public getRoundCount(): number {
        return this.roundCount
    }

    public getCurrentRound(): number {
        return this.currentRound
    }

    public isLastRound(): boolean {
        return this.currentRound >= this.roundCount - 1
    }

    public getCurrentMatches(): RotationMatch[] {
        return this.getMatchesForRound(this.currentRound)
    }

    public getMatchesForRound(round: number): RotationMatch[] {
        return this.matches.filter(x => x.round === round)
    }

    public getCurrentSittingOut(): string[] {
        return this.getSittingOutForRound(this.currentRound)
    }

    public getSittingOutForRound(round: number): string[] {
        const playing = new Set<string>()
        for (const match of this.getMatchesForRound(round)) {
            playing.add(match.playerA)
            playing.add(match.playerB)
        }
        return this.players.filter(x => !playing.has(x))
    }

    public advance(): boolean {
        if (this.roundCount === 0) {
            return false
        }

        this.currentRound = (this.currentRound + 1) % this.roundCount
        return this.currentRound === 0
    }

    public reset(): void {
        this.currentRound = 0
    }

    private static buildRounds(players: string[], stations: number, mode: RotationMode): Pair[][] {
        const slots = Math.min(stations, Math.floor(players.length / 2))
        if (slots < 1) {
            return []
        }

        const totalPairs = (players.length * (players.length - 1)) / 2
        const roundCount = Math.ceil(totalPairs / slots)

        const gamesPlayed = new Map<string, number>()
        const lastPlayed = new Map<string, number>()
        const playedPairs = new Set<string>()
        for (const player of players) {
            gamesPlayed.set(player, 0)
            lastPlayed.set(player, -1)
        }

        const rounds: Pair[][] = []

        for (let round = 0; round < roundCount; round++) {
            const pairs: Pair[] = []
            const used = new Set<string>()

            for (let station = 0; station < slots; station++) {
                const pair = Rotation.pickPair(
                    players,
                    used,
                    gamesPlayed,
                    lastPlayed,
                    playedPairs,
                    round,
                    mode,
                    roundCount
                )

                if (pair === null) {
                    break
                }

                pairs.push(pair)
                used.add(pair[0])
                used.add(pair[1])
                gamesPlayed.set(pair[0], (gamesPlayed.get(pair[0]) as number) + 1)
                gamesPlayed.set(pair[1], (gamesPlayed.get(pair[1]) as number) + 1)
                lastPlayed.set(pair[0], round)
                lastPlayed.set(pair[1], round)
                playedPairs.add(Rotation.pairKey(pair[0], pair[1]))
            }

            if (pairs.length === 0) {
                break
            }

            rounds.push(pairs)
        }

        return Rotation.rotateToBestStart(rounds, mode)
    }

    private static pickPair(
        players: string[],
        used: Set<string>,
        gamesPlayed: Map<string, number>,
        lastPlayed: Map<string, number>,
        playedPairs: Set<string>,
        round: number,
        mode: RotationMode,
        roundCount: number
    ): Pair | null {
        const available = players.filter(x => !used.has(x))
        if (available.length < 2) {
            return null
        }

        let best: Pair | null = null
        let bestScore = Number.POSITIVE_INFINITY

        for (let i = 0; i < available.length; i++) {
            for (let j = i + 1; j < available.length; j++) {
                const first = available[i]
                const second = available[j]

                const score = Rotation.pairScore(
                    first,
                    second,
                    gamesPlayed,
                    lastPlayed,
                    playedPairs,
                    round,
                    mode,
                    roundCount
                )

                if (score < bestScore) {
                    bestScore = score
                    best = [first, second]
                }
            }
        }

        return best
    }

    private static pairScore(
        first: string,
        second: string,
        gamesPlayed: Map<string, number>,
        lastPlayed: Map<string, number>,
        playedPairs: Set<string>,
        round: number,
        mode: RotationMode,
        roundCount: number
    ): number {
        const repeatPenalty = playedPairs.has(Rotation.pairKey(first, second)) ? 1000 : 0

        const firstLast = lastPlayed.get(first) as number
        const secondLast = lastPlayed.get(second) as number

        const firstWait = firstLast < 0 ? Number.MAX_SAFE_INTEGER : round - firstLast
        const secondWait = secondLast < 0 ? Number.MAX_SAFE_INTEGER : round - secondLast
        const wait = Math.min(firstWait, secondWait)

        const recencyScore = mode === RotationMode.Spread ? -wait : wait

        const gamesScore = (gamesPlayed.get(first) as number) + (gamesPlayed.get(second) as number)

        return repeatPenalty + recencyScore * 10 + gamesScore
    }


    private static rotateToBestStart(rounds: Pair[][], mode: RotationMode): Pair[][] {
        if (rounds.length <= 2) {
            return rounds
        }

        let bestIndex = 0
        let bestScore = Number.POSITIVE_INFINITY

        for (let index = 0; index < rounds.length; index++) {
            const last = rounds[(index - 1 + rounds.length) % rounds.length]
            const first = rounds[index]
            const overlap = Rotation.overlapScore(Rotation.playersIn(last), first)

            const score = mode === RotationMode.Spread ? overlap : -overlap

            if (score < bestScore) {
                bestScore = score
                bestIndex = index
            }
        }

        return [...rounds.slice(bestIndex), ...rounds.slice(0, bestIndex)]
    }

    private static overlapScore(previous: Set<string>, pairs: Pair[]): number {
        let score = 0
        for (const player of Rotation.playersIn(pairs)) {
            if (previous.has(player)) {
                score++
            }
        }
        return score
    }

    private static playersIn(pairs: Pair[]): Set<string> {
        const players = new Set<string>()
        for (const [first, second] of pairs) {
            players.add(first)
            players.add(second)
        }
        return players
    }

    private static shuffle(players: string[]): string[] {
        const shuffled = [...players]

        for (let index = shuffled.length - 1; index > 0; index--) {
            const swap = Math.floor(Math.random() * (index + 1))
            const temp = shuffled[index]
            shuffled[index] = shuffled[swap]
            shuffled[swap] = temp
        }

        return shuffled
    }

    private static pairKey(first: string, second: string): string {
        return first < second ? `${first}\u0000${second}` : `${second}\u0000${first}`
    }
}
