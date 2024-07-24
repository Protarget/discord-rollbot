import { ChatInputCommandInteraction, Client, Events, Guild, GuildMember, PermissionFlagsBits, Role, SlashCommandBuilder } from "discord.js"
import * as fs from "fs"
import Module, { ModuleCommand } from "./Module"

type AutoRoleGroupData = string[]
type AutoRoleGuildData = {[key: string]: AutoRoleGroupData}
type AutoRoleRootData = {[key: string]: AutoRoleGuildData}

interface SerializedAutoRoleData {
    [guild: string]: {[group: string]: string[]}
}

class AutoRoleData {
    private data: Map<string, Map<string, Set<string>>>

    public constructor(data?: Map<string, Map<string, Set<string>>>) {
        if (data) {
            this.data = data
        }
        else {
            this.data = new Map()
        }
    }

    public createGroup(groupId: string, guild: Guild): string {
        const guildData = this.getOrCreateGuildData(guild)

        if (guildData.has(groupId)) {
            return `Group ${groupId} already exists`
        }
        else {
            guildData.set(groupId, new Set())
            return `Group ${groupId} created`
        }
    }

    public deleteGroup(groupId: string, guild: Guild): string {
        const guildData = this.getOrCreateGuildData(guild)

        if (!guildData.has(groupId)) {
            return `Group ${groupId} doesn't exist`
        }
        else {
            guildData.delete(groupId)
            return `Group ${groupId} deleted`
        }
    }

    public addRoleToGroup(groupId: string, role: Role): string {
        const guildData = this.getOrCreateGuildData(role.guild)

        if (!guildData.has(groupId)) {
            return `Group ${groupId} doesn't exist`
        }
        else {
            guildData.get(groupId)?.add(role.id)
            return `Role <@&${role.id}> added to group ${groupId}`
        }
    }

    public removeRoleFromGroup(groupId: string, role: Role): string {
        const guildData = this.getOrCreateGuildData(role.guild)

        if (!guildData.has(groupId)) {
            return `Group ${groupId} doesn't exist`
        }
        else {
            guildData.get(groupId)?.delete(role.id)
            return `Role <@&${role.id}> deleted from group ${groupId}`
        }
    }

    public getGroups(guild: Guild): Map<string, Set<string>> {
        return this.getOrCreateGuildData(guild)
    }

    public async apply(guildMember: GuildMember) {
        const guildData = this.getOrCreateGuildData(guildMember.guild)

        for (const [groupId, roles] of guildData.entries()) {
            const roleArray = [...roles.values()]
            if (!guildMember.roles.cache.hasAny(...roleArray)) {
                const role = roleArray[Math.floor(Math.random() * roleArray.length)]
                console.log(`Applying role ${role} from group ${groupId} to ${guildMember.displayName}`)
                await guildMember.roles.add(role)
            }
        }
    }

    public async cleanAndValidate(client: Client): Promise<void> {
        for (const [guildId, guildData] of this.data.entries()) {
            try {
                const guild = await client.guilds.fetch(guildId)

                for (const [groupId, roles] of guildData.entries()) {
                    const rolesToDelete: string[] = []

                    for (const roleId of roles.values()) {
                        try {
                            const role = await guild.roles.fetch(roleId)
                            if (!role) {
                                rolesToDelete.push(roleId)
                            }
                        }
                        catch (e) {
                            rolesToDelete.push(roleId)
                        }
                    }

                    if (rolesToDelete.length > 0) {
                        console.warn(`Deleting the following invalid rules: ${rolesToDelete.join(", ")}`)
                        for (const roleToDelete of rolesToDelete) {
                            roles.delete(roleToDelete)
                        }
                    }
                }
            }
            catch (e) {
                // We can't fetch the guild information?! Leave everything intact in case of ephemeral failure
            }
        }
    }

    public removeRole(role: Role) {
        const guild = this.data.get(role.guild.id)

        if (guild) {
            for (const group of guild.values()) {
                group.delete(role.id)
            }
        }
    }

    public toJSON(): SerializedAutoRoleData {
        const result: SerializedAutoRoleData = {}

        for (const [guildId, group] of this.data.entries()) {
            const guildData: {[group: string]: string[]} = {}

            for (const [groupId, roles] of group.entries()) {
                guildData[groupId] = [...roles.values()]
            }

            result[guildId] = guildData
        }

        return result
    }

    private getOrCreateGuildData(guild: Guild): Map<string, Set<string>> {
        if (!this.data.has(guild.id)) {
            this.data.set(guild.id, new Map())
        }

        return this.data.get(guild.id) as Map<string, Set<string>>
    }

    public static fromJSON(data: SerializedAutoRoleData): AutoRoleData {
        const constructorData = new Map()

        for (const guildId in data) {
            const guildData = data[guildId]
            const guildConstructorData: Map<string, Set<string>> = new Map()

            for (const groupId in guildData) {
                const roles: Set<string> = new Set()
                const groupData = guildData[groupId]
                for (const role of groupData) {
                    roles.add(role)
                }
                guildConstructorData.set(groupId, roles)
            }

            constructorData.set(guildId, guildConstructorData)
        }

        return new AutoRoleData(constructorData)
    }
}

export default class AutoRoleModule implements Module {
    public readonly name = "autorole"

    private data: AutoRoleData
    private dataFile: string

    private readonly boundGuildMemberAdded = this.onGuildMemberAdded.bind(this)
    private readonly boundRoleDeleted = this.onRoleDeleted.bind(this)

    constructor(dataFile: string) {
        this.dataFile = dataFile
    }

    public async onStart(client: Client): Promise<void> {
        await this.loadData()
        await this.data.cleanAndValidate(client)
        client.on(Events.GuildMemberAdd, this.boundGuildMemberAdded)
        client.on(Events.GuildRoleDelete, this.boundRoleDeleted)
    }

    public async onStop(client: Client): Promise<void> {
        client.off(Events.GuildMemberAdd, this.boundGuildMemberAdded)
        client.off(Events.GuildRoleDelete, this.boundRoleDeleted)
    }

    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
                    .setName("autorole")
                    .setDescription("Manage roles assigned to joining users automatically")
                    .addSubcommand(subcommand => subcommand
                        .setName("create")
                        .setDescription("Create a role group to apply to joining members")
                        .addStringOption(option => option
                            .setRequired(true)
                            .setName("group")
                            .setDescription("The name of the group to create")
                            .setMinLength(1)
                            .setMaxLength(256)))
                    .addSubcommand(subcommand => subcommand
                        .setName("delete")
                        .setDescription("Delete a role group")
                        .addStringOption(option => option
                            .setRequired(true)
                            .setName("group")
                            .setDescription("The name of the group to delete")
                            .setMinLength(1)
                            .setMaxLength(256)))
                    .addSubcommand(subcommand => subcommand
                        .setName("add")
                        .setDescription("Add a role to a role group")
                        .addStringOption(option => option
                            .setRequired(true)
                            .setName("group")
                            .setDescription("The name of the group to add the role to")
                            .setMinLength(1)
                            .setMaxLength(256))
                        .addRoleOption(option => option
                            .setRequired(true)
                            .setName("role")
                            .setDescription("The role to add to the group")))
                    .addSubcommand(subcommand => subcommand
                        .setName("remove")
                        .setDescription("Remove a role from a role group")
                        .addStringOption(option => option
                            .setRequired(true)
                            .setName("group")
                            .setDescription("The name of the group to remove the role from")
                            .setMinLength(1)
                            .setMaxLength(256))
                        .addRoleOption(option => option
                            .setRequired(true)
                            .setName("role")
                            .setDescription("The role to remove from the group")))
                    .addSubcommand(subcommand => subcommand
                        .setName("list")
                        .setDescription("List all groups, along with their roles")),

                execute: this.onCommand.bind(this)
            }
        ]
    }

    public async onCommand(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand(true)

        if (subcommand === "create") {
            this.onCreateGroup(interaction)
        }
        else if (subcommand === "delete") {
            this.onDeleteGroup(interaction)
        }
        else if (subcommand === "add") {
            this.onAddRoleToGroup(interaction)
        }
        else if (subcommand === "remove") {
            this.onRemoveRoleFromGroup(interaction)
        }
        else {
            this.onListGroups(interaction)
        }
    }

    public async onCreateGroup(interaction: ChatInputCommandInteraction) {
        try {
            const group = interaction.options.getString("group", true)
            const result = await this.data.createGroup(group, interaction.guild as Guild)
            await this.saveData()

            console.log(result)

            await interaction.reply({
                content: result,
                ephemeral: true
            })
        }
        catch (e) {
            console.error("Encountered an error whilst creating a group", e)
            await interaction.reply({
                "content": `Encountered an error whilst creating a group: ${e.message}`,
                "ephemeral": true
            })
        }
    }

    public async onDeleteGroup(interaction: ChatInputCommandInteraction) {
        try {
            const group = interaction.options.getString("group", true)
            const result = await this.data.deleteGroup(group, interaction.guild as Guild)
            await this.saveData()

            console.log(result)

            await interaction.reply({
                content: result,
                ephemeral: true
            })
        }
        catch (e) {
            console.error("Encountered an error whilst deleting a group", e)
            await interaction.reply({
                "content": `Encountered an error whilst deleting a group: ${e.message}`,
                "ephemeral": true
            })
        }
    }

    public async onAddRoleToGroup(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const group = interaction.options.getString("group", true)
            const role = interaction.options.getRole("role", true)
            const result = await this.data.addRoleToGroup(group, role as Role)
            await this.saveData()

            console.log(result)

            await interaction.reply({
                content: result,
                ephemeral: true
            })
        }
        catch (e) {
            console.error("Encountered an error whilst adding a role to a group", e)
            await interaction.reply({
                "content": `Encountered an error whilst adding a role to a group: ${e.message}`,
                "ephemeral": true
            })
        }
    }

    public async onRemoveRoleFromGroup(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const group = interaction.options.getString("group", true)
            const role = interaction.options.getRole("role", true)
            const result = await this.data.removeRoleFromGroup(group, role as Role)
            await this.saveData()

            console.log(result)

            await interaction.reply({
                content: result,
                ephemeral: true
            })
        }
        catch (e) {
            console.error("Encountered an error whilst removing a role from a group", e)
            await interaction.reply({
                "content": `Encountered an error whilst removing a role from a group: ${e.message}`,
                "ephemeral": true
            })
        }
    }

    public async onListGroups(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const groups = this.data.getGroups(interaction.guild as Guild)
            const listings: string[] = []

            for (const [groupName, group] of groups.entries()) {
                if (group.size === 0) {
                    listings.push(`${groupName}: <no roles>`)
                }
                else {
                    const joinedGroups = [...group.values()].map(x => `<@&${x}>`).join(", ")
                    listings.push(`${groupName}: ${joinedGroups}`)
                }
            }

            await interaction.reply({
                content: listings.join("\n"),
                ephemeral: true
            })
        }
        catch (e) {
            console.error("Encountered an error whilst listing groups", e)
            await interaction.reply({
                "content": `Encountered an error whilst listing groups: ${e.message}`,
                "ephemeral": true
            })
        }
    }

    public async onGuildMemberAdded(guildMember: GuildMember): Promise<void> {
        try {
            console.log(`Applying roles to new member ${guildMember.displayName}`)
            await this.data.apply(guildMember)
        }
        catch (e) {
            console.error("Encountered an error applying autoroles", e)
        }
    }

    public async onRoleDeleted(role: Role): Promise<void> {
        try {
            console.log(`Roles ${role.name} deleted, purging from data`)
            await this.data.removeRole(role)
            await this.saveData()
        }
        catch (e) {
            console.error("Encountered an error deleting roles", e)
        }
    }

    private async loadData(): Promise<void> {
        if (fs.existsSync(this.dataFile)) {
            return new Promise((resolve, reject) => {
                fs.readFile(this.dataFile, (err, data) => {
                    if (err != null) {
                        reject(err);
                    }
                    else {
                        try {
                            const parsedData = JSON.parse(data.toString("utf-8")) as SerializedAutoRoleData
                            this.data = AutoRoleData.fromJSON(parsedData)
                            resolve()
                        }
                        catch (err2) {
                            reject(err2)
                        }
                    }
                })
            })
        }
        else {
            return new Promise((resolve, reject) => {
                this.data = new AutoRoleData()
                resolve()
            })
        }
    }

    private async saveData(): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.dataFile, JSON.stringify(this.data.toJSON()), (err) => {
                if (err != null) {
                    reject(err);
                }
                else {
                    resolve();
                }
            })
        })
    }
}