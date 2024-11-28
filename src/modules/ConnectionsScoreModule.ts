import { Client, Events, Message } from "discord.js"
import Module, { ModuleCommand } from "./Module"

const CONNECTIONS_REGEX = /^Connections\nPuzzle/

enum LineColor {
    Initial,
    Unknown,
    Yellow,
    Green,
    Blue,
    Purple
}

function squareColor(char: string): LineColor {
    switch (char) {
        case "🟨": return LineColor.Yellow
        case "🟩": return LineColor.Green
        case "🟦": return LineColor.Blue
        case "🟪": return LineColor.Purple
        default: return LineColor.Unknown
    }
}

function colorPoints(color: LineColor): number {
    switch (color) {
        case LineColor.Yellow: return 1000
        case LineColor.Green: return 2000
        case LineColor.Blue: return 3000
        case LineColor.Purple: return 4000
        default: return 0
    }
}

export default class ConnectionsScoreModule extends Module {
    public readonly name = "conscore"

    private readonly boundListener = this.onMessage.bind(this)

    public async onStart(client: Client): Promise<void> {
        client.on(Events.MessageCreate, this.boundListener)
    }

    public async onStop(client: Client): Promise<void> {
        client.off(Events.MessageCreate, this.boundListener)
    }
    
    public getCommands(): ModuleCommand[] {
        return []
    }

    public async onMessage(message: Message<boolean>) {
        try {
            if (CONNECTIONS_REGEX.test(message.content)) {
                let score = 0
                const lines = message.content.split("\n").slice(2)
                let scoreIndex = 4
                let penaltyMultiplier = 1.0
                for (const line of lines) {
                    let success = true
                    let lineColor = LineColor.Initial
                    for (const char of Array.from(line)) {
                        const color = squareColor(char)

                        if (lineColor === LineColor.Initial) {
                            lineColor = color
                        }
                        else if (lineColor !== color) {
                            success = false
                            penaltyMultiplier = Math.max(0, penaltyMultiplier - 0.25)
                            break
                        }
                    }

                    if (success) {
                        score += scoreIndex * colorPoints(lineColor)
                        scoreIndex -= 1
                    }
                }

                score *= penaltyMultiplier

                message.channel.send(`Score: ${score}`)
            }
        }
        catch (e) {
            console.error(e)
        }
    } 
}