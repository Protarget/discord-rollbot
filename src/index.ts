import Rollbot from "./Rollbot"
import CompleteModule from "./modules/CompleteModule"
import RollModule from "./modules/RollModule"
import AutoRoleModule from "./modules/AutoRoleModule"
import * as fs from "fs"
import JebModule from "./modules/JebModule"
import DilemmaModule from "./modules/DilemmaModule"
import RandomLineModule from "./modules/RandomLineModule"
import FrcModule from "./modules/FrcModule"
import WeatherModule from "./modules/WeatherModule"
import ConnectionsScoreModule from "./modules/ConnectionsScoreModule"

async function launchBot() {
    const rollbot = new Rollbot(
            fs.readFileSync("secrets/discord_token").toString("utf-8").trim(), 
            fs.readFileSync("secrets/discord_client_id").toString("utf-8").trim(), [
        new RollModule(),
        new CompleteModule(),
        new AutoRoleModule("roles.json"),
        new JebModule(),
        new DilemmaModule(),
        new RandomLineModule("oppa", "./data/words.txt", "Abbet a pitch-perfect Korean style dance!", line => `Opp. Opp Opp... Oppa ${line} style!`),
        new RandomLineModule("mao", "./data/mao.txt", "Reply with a random Mao quotation."),
        new RandomLineModule("gd", "./data/gd.txt", "Fetch a random Graey Dave tweet."),
        new RandomLineModule("mikef", "./data/mikef.txt", "Fetch a random Mike F tweet."),
        new FrcModule("./data/frc_days.txt", "./data/frc_months.txt"),
        new WeatherModule(),
        new ConnectionsScoreModule()
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