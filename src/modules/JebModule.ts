import { SlashCommandBuilder, ChatInputCommandInteraction, bold, Client, AttachmentBuilder, Attachment, Embed } from "discord.js"
import Module, { ModuleCommand } from "./Module"
import * as fs from "fs"
import * as sharp from "sharp"

export default class JebModule extends Module {
    public readonly name = "jeb"

    private readonly boundOnJeb = this.onJeb.bind(this)
    private readonly boundOnJebUpload = this.onJebUpload.bind(this)

    private jebImage: sharp.Sharp

    public async onStart(client: Client): Promise<void> {
        this.jebImage = await sharp("data/jeb.png")
    }

    public async onJeb(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply()
            const messages = await interaction.channel.messages.fetch({
                limit: 100
            })

            for (const message of messages.filter(x => x.attachments.size > 0 || x.embeds.length > 0).values()) {
                for (const imageEmbed of message.embeds.filter(x => x.data.type === "image")) {
                    const attachment = await this.doJeb(imageEmbed)
                    if (attachment) {
                        const message = await interaction.followUp({files: [attachment], fetchReply: true})
                        await message.react("❗")
                        return
                    }
                }
                for (const imageAttachment of message.attachments.reverse().values()) {
                    const attachment = await this.doJeb(imageAttachment)
                    if (attachment) {
                        const message = await interaction.followUp({files: [attachment], fetchReply: true})
                        await message.react("❗")
                        return
                    }
                }
            }

            await interaction.followUp({
                content: "Unable to find jebbable image within the last 100 messages",
                ephemeral: true
            })

        } catch (e) {
            console.error("Something went wrong jebbing", e)
            try {
                await interaction.followUp({
                    content: "Unexpected error occured whilst jebbing",
                    ephemeral: true
                })
            }
            catch (e2) {
                console.error("Something went wrong replying due to eror", e)
            }
        }
    }

    public async onJebUpload(interaction: ChatInputCommandInteraction) {
        try {
            await interaction.deferReply()
            const imageAttachment = interaction.options.getAttachment("image", true)
            const attachment = await this.doJeb(imageAttachment)

            if (attachment) {
                const message = await interaction.followUp({files: [attachment], fetchReply: true})
                await message.react("❗")
            }
            else {
                await interaction.followUp({
                    content: "Unable to jebbify attachment, please make sure it is an image",
                    ephemeral: true
                })
            }
        }
        catch (e) {
            console.error("Something went wrong jebbing", e)
            try {
                await interaction.followUp({
                    content: "Unexpected error occured whilst jebbing",
                    ephemeral: true
                })
            }
            catch (e2) {
                console.error("Something went wrong replying due to eror", e)
            }
        }
    }

    public getCommands(): ModuleCommand[] {
        return [
            {
                data: new SlashCommandBuilder()
                    .setName("jeb")
                    .setDescription("Jeb!"),
                execute: this.boundOnJeb
            },
            {
                data: new SlashCommandBuilder()
                .setName("jebupload")
                .setDescription("Jeb! an uploaded image")
                .addAttachmentOption(option =>
                    option
                    .setName("image")
                    .setDescription("Image to Jeb!")
                    .setRequired(true)),
                execute: this.boundOnJebUpload
            }
        ]
    }

    private async doJeb(attachment: Attachment | Embed): Promise<AttachmentBuilder> {
        try {
            if (attachment.url) {
                const data = await fetch(attachment.url)
                const dataBuffer = await data.arrayBuffer()
                const image = await sharp(dataBuffer)
                const imageMetadata = await image.metadata()

                const jeb = this.jebImage.clone()
                await jeb.resize(imageMetadata.width, imageMetadata.height, {fit: "inside"})
                
                await image.composite([{
                    input: await jeb.toBuffer(),
                    gravity: "southwest"
                }])
                
                return new AttachmentBuilder(await image.toBuffer())
            }
            else {
                return null
            }
        }
        catch (e) {
            return null;
        }
    }
}