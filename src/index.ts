import Rollbot from "./Rollbot"
import CompleteModule from "./modules/CompleteModule"
import RollModule from "./modules/RollModule"
import AutoRoleModule from "./modules/AutoRoleModule"
import * as fs from "fs"
import JebModule from "./modules/JebModule"
import DilemmaModule from "./modules/DilemmaModule"

async function launchBot() {
    const rollbot = new Rollbot(
            fs.readFileSync("secrets/discord_token").toString("utf-8").trim(), 
            fs.readFileSync("secrets/discord_client_id").toString("utf-8").trim(), [
        new RollModule(),
        new CompleteModule(),
        new AutoRoleModule("roles.json"),
        new JebModule(),
        new DilemmaModule()
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