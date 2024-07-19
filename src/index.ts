import Rollbot from "./Rollbot"
import CompleteModule from "./modules/CompleteModule"
import RollModule from "./modules/RollModule"
import * as fs from "fs"

async function launchBot() {
    const rollbot = new Rollbot(
            fs.readFileSync("secrets/discord_token").toString("utf-8").trim(), 
            fs.readFileSync("secrets/discord_client_id").toString("utf-8").trim(), [
        new RollModule(),
        new CompleteModule()
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