import * as fs from "fs"

export interface OpenAiCompletionResult {
    prompt: string,
    response: string
}

export class OpenAiClient {
    private readonly apiKey: string

    public constructor(apiKey: string) {
        this.apiKey = apiKey
    }

    public async complete(prompt: string, size: number = 128): Promise<OpenAiCompletionResult> {
        const trimmedMessage = prompt.trim().replace(/\\n/g, "\n")

        const completeData = await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo-instruct",
                prompt: trimmedMessage,
                max_tokens: size,
                temperature: 0.9,
            })
        })

        const completeJson = await completeData.json()

        return {prompt: trimmedMessage, response: completeJson.choices[0].text}
    }
}

const openAiClient: OpenAiClient = new OpenAiClient(fs.readFileSync("secrets/openai").toString("utf-8").trim())

export default openAiClient
