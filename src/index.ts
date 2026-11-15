import Rollbot from "./Rollbot"
import RollModule from "./modules/RollModule"
import AutoRoleModule from "./modules/AutoRoleModule"
import * as fs from "fs"
import JebModule from "./modules/JebModule"
import DilemmaModule from "./modules/DilemmaModule"
import RandomLineModule from "./modules/RandomLineModule"
import FrcModule from "./modules/FrcModule"
import WeatherModule from "./modules/WeatherModule"
import ConnectionsScoreModule from "./modules/ConnectionsScoreModule"
import WeedModule from "./modules/WeedModule"
import WordleModule from "./modules/WordleModule"
import TriviaModule from "./modules/TriviaModule"
import RotationModule from "./modules/RotationModule"
import { TriviaFileQuestionGenerator, TriviaJeopardyFileQuestionGenerator } from "./modules/trivia/TriviaQuestions"

async function launchBot() {
    const rollbot = new Rollbot(
            fs.readFileSync("secrets/discord_token").toString("utf-8").trim(), 
            fs.readFileSync("secrets/discord_client_id").toString("utf-8").trim(), [
        new RollModule(),
        new AutoRoleModule("roles.json"),
        new JebModule(),
        new DilemmaModule(),
        new RandomLineModule("oppa", "./data/words.txt", "Abbet a pitch-perfect Korean style dance!", line => `Opp. Opp Opp... Oppa ${line} style!`),
        new RandomLineModule("mao", "./data/mao.txt", "Reply with a random Mao quotation."),
        new RandomLineModule("gd", "./data/gd.txt", "Fetch a random Graey Dave tweet."),
        new RandomLineModule("mikef", "./data/mikef.txt", "Fetch a random Mike F tweet."),
        new RandomLineModule("bard", "./data/the_complete_works_of_william_shakespeare.txt", "Reply with a random Shakespeare.", quote => quote.replaceAll(`/`, `\n`)),
        new RandomLineModule("recipe", "./data/recipes.txt", "Reply with a random recipe.",
            recipe => recipe.replaceAll("[b]","**")
                            .replaceAll("[/b]", "**")
                            .replaceAll("[i]", "*")
                            .replaceAll("[/i]", "*")
                            .replaceAll("\\n", "\n")
                            .replaceAll("\\t", "\t")),
        new FrcModule("./data/frc_days.txt", "./data/frc_months.txt"),
        new WeatherModule(),
        new ConnectionsScoreModule(),
        new WeedModule("./data/Weed/strains.json"),
        new WordleModule("./data/scrabble.txt"),
        new TriviaModule({
            jeopardy: new TriviaJeopardyFileQuestionGenerator("./data/Trivia/jeopardy.json"),
            triviaqa: new TriviaFileQuestionGenerator("./data/Trivia/questions.txt")
        }),
        new RotationModule()
    ])

    process.on("beforeExit", async () => {
        await rollbot.stop()
    })

    process.on("SIGTERM", () => {
        rollbot.stop().finally(() => process.exit(0));
    })
    
    process.on("SIGINT", () => {
        rollbot.stop().finally(() => process.exit(0));
    })
    
    await rollbot.start()
}

launchBot()
