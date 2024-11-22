import { Client, Events, GatewayIntentBits, REST, Routes } from "discord.js"
import Module, { ModuleCommand } from "./modules/Module"

enum RollbotState {
    STOPPING,
    STOPPED,
    STARTING,
    STARTED
}

export default class Rollbot {
    private readonly token: string
    private readonly clientId: string
    private readonly modules: Array<Module>
    private readonly client: Client
    private state: RollbotState = RollbotState.STOPPED
    private commands: Map<String, ModuleCommand>

    public constructor(token: string, clientId: string, modules: Array<Module>) {
        this.token = token
        this.clientId = clientId
        this.modules = modules
        this.commands = new Map()
        this.client = new Client({intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessagePolls, 
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers
        ]})

        this.registerCommands()

        this.client.on(Events.InteractionCreate, async interaction => {
            if (!interaction.isChatInputCommand()) {
                return
            }

            const command = this.commands.get(interaction.commandName)

            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`)
                return
            }

            try {
                await command.execute(interaction)
            } catch (e) {
                console.error(`Error while executing command '${interaction.commandName}'`, e)
                try {
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                    }
                }
                catch (e2) {
                    console.error("Error replying with error", e2);
                }
            }
        })
    }

    public async start(): Promise<void> {
        if (this.state === RollbotState.STOPPED) {
            this.state = RollbotState.STARTING
            this.client.once(Events.ClientReady, async client => {
                const moduleStartPromises: Array<{"module": Module, "promise": Promise<void>}> = []
                for (const module of this.modules) {
                    moduleStartPromises.push({"module": module, "promise": module.onStart(client)})
                }

                for (const moduleStartPromise of moduleStartPromises) {
                    try {
                        await moduleStartPromise.promise
                        console.log(`Started module '${moduleStartPromise.module.getName()}'`)
                    }
                    catch (e) {
                        console.log(`Failed to start module '${moduleStartPromise.module.getName()}' due to error`, e) 
                    }
                }

                this.state = RollbotState.STARTED
            })
    
            this.client.login(this.token)
        }
    }

    public async stop(): Promise<void> {
        if (this.state === RollbotState.STARTED) {
            this.state = RollbotState.STOPPING
            const moduleStopPromises = []

            for (const module of this.modules) {
                moduleStopPromises.push({"module": module, "promise": module.onStop(this.client)})
            }

            for (const moduleStopPromise of moduleStopPromises) {
                try {
                    await moduleStopPromise.promise
                    console.log(`Stopped module '${moduleStopPromise.module.getName()}'`)
                }
                catch (e) {
                    console.log(`Failed to stop module '${moduleStopPromise.module.getName()}' due to error`, e) 
                }
            }

            this.client.destroy()

            this.state = RollbotState.STOPPED
        }
    }

    private async registerCommands(): Promise<void> {
        const rest = new REST().setToken(this.token)

        const allModuleCommands = []

        for (const module of this.modules) {
            const moduleCommands = module.getCommands()

            for (const moduleCommand of moduleCommands) {
                this.commands.set(moduleCommand.data.name, moduleCommand)
                allModuleCommands.push(moduleCommand.data.toJSON())
            }
        }

        try {
            const result: any = await rest.put(Routes.applicationCommands(this.clientId), { body: allModuleCommands })
            console.log(`Registered ${result.length} commands`)
        }
        catch (e) {
            console.error("Unable to register commands, terminating!", e)
            process.exit(1)
        }
    }
}